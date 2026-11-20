import type { Candle, ChartData, Quote } from "./types";
import { yahooSymbol } from "./types";

const HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];
const UA = "Mozilla/5.0";

const cache = new Map<string, { value: unknown; at: number }>();

function cached<T>(key: string, ttl: number, load: () => Promise<T | null>): Promise<T | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.value as T);
  return load().then((value) => {
    if (value !== null) cache.set(key, { value, at: Date.now() });
    return value;
  });
}

async function getJson(path: string): Promise<Record<string, unknown> | null> {
  for (const host of HOSTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(`${host}${path}`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) continue;
      return (await response.json()) as Record<string, unknown>;
    } catch {
      continue;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

interface RawSeries {
  meta?: Record<string, unknown>;
  timestamp?: number[];
  indicators?: {
    quote?: {
      open?: (number | null)[];
      high?: (number | null)[];
      low?: (number | null)[];
      close?: (number | null)[];
      volume?: (number | null)[];
    }[];
  };
}

export interface ChartRequest {
  symbol: string;
  range: string;
  interval: string;
}

function metaText(meta: Record<string, unknown>, keys: string[], fallback: string): string {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value) return value;
  }
  return fallback;
}

function buildChart(
  request: ChartRequest,
  series: RawSeries,
  source: string,
  synthesize: boolean,
): ChartData | null {
  const meta = series.meta;
  if (!meta) return null;
  const timestamps = series.timestamp ?? [];
  const quote = series.indicators?.quote?.[0];
  const closes = quote?.close ?? [];
  const candles: Candle[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const close = num(closes[i]);
    if (close === null) continue;
    if (synthesize) {
      const open = i > 0 ? (num(closes[i - 1]) ?? close) : close;
      candles.push({
        time: timestamps[i],
        open,
        high: Math.max(open, close),
        low: Math.min(open, close),
        close,
        volume: 0,
      });
      continue;
    }
    const open = num(quote?.open?.[i]);
    const high = num(quote?.high?.[i]);
    const low = num(quote?.low?.[i]);
    if (open === null || high === null || low === null) continue;
    candles.push({
      time: timestamps[i],
      open,
      high,
      low,
      close,
      volume: num(quote?.volume?.[i]) ?? 0,
    });
  }
  if (candles.length === 0) return null;

  const price = num(meta.regularMarketPrice) ?? candles[candles.length - 1].close;
  const reportedPercent = num(meta.regularMarketChangePercent);
  const previousClose =
    num(meta.previousClose) ??
    (reportedPercent !== null && price !== null
      ? price / (1 + reportedPercent / 100)
      : num(meta.chartPreviousClose));
  const change =
    num(meta.regularMarketChange) ??
    (reportedPercent !== null && price !== null
      ? price - price / (1 + reportedPercent / 100)
      : price !== null && previousClose !== null
        ? price - previousClose
        : null);
  const changePercent =
    reportedPercent ?? (change !== null && previousClose ? (change / previousClose) * 100 : null);

  return {
    symbol: request.symbol.toUpperCase(),
    name: metaText(meta, ["longName", "shortName"], request.symbol.toUpperCase()),
    currency: metaText(meta, ["currency"], "USD"),
    exchange: metaText(meta, ["fullExchangeName", "exchangeName"], ""),
    range: request.range,
    interval: request.interval,
    price,
    change,
    changePercent,
    previousClose,
    dayHigh: num(meta.regularMarketDayHigh),
    dayLow: num(meta.regularMarketDayLow),
    yearHigh: num(meta.fiftyTwoWeekHigh),
    yearLow: num(meta.fiftyTwoWeekLow),
    candles,
    source,
    updatedAt: new Date().toISOString(),
  };
}

function sparkInterval(interval: string): string {
  return interval === "1h" ? "60m" : interval;
}

function fromV8(request: ChartRequest): Promise<ChartData | null> {
  const path = `/v8/finance/chart/${encodeURIComponent(yahooSymbol(request.symbol))}?range=${encodeURIComponent(request.range)}&interval=${encodeURIComponent(request.interval)}`;
  return getJson(path).then((payload) => {
    const series = (payload?.chart as { result?: RawSeries[] } | undefined)?.result?.[0];
    return series ? buildChart(request, series, "Yahoo Finance", false) : null;
  });
}

function fromSpark(request: ChartRequest): Promise<ChartData | null> {
  const path = `/v7/finance/spark?symbols=${encodeURIComponent(yahooSymbol(request.symbol))}&range=${encodeURIComponent(request.range)}&interval=${encodeURIComponent(sparkInterval(request.interval))}`;
  return getJson(path).then((payload) => {
    const series = (payload?.spark as { result?: { response?: RawSeries[] }[] } | undefined)?.result?.[0]?.response?.[0];
    return series ? buildChart(request, series, "Yahoo Spark", true) : null;
  });
}

export function fetchChart(request: ChartRequest): Promise<ChartData | null> {
  const key = `chart:${request.symbol}:${request.range}:${request.interval}`;
  const ttl = request.interval === "1m" || request.interval === "5m" ? 30_000 : 120_000;
  return cached(key, ttl, async () => (await fromV8(request)) ?? fromSpark(request));
}

function quoteFromSeries(displaySymbol: string, series: RawSeries): Quote | null {
  const chart = buildChart(
    { symbol: displaySymbol, range: "1mo", interval: "1d" },
    series,
    "Yahoo Spark",
    true,
  );
  if (!chart) return null;
  return {
    symbol: displaySymbol,
    name: chart.name,
    price: chart.price,
    change: chart.change,
    changePercent: chart.changePercent,
    previousClose: chart.previousClose,
    currency: chart.currency,
    exchange: chart.exchange,
    spark: chart.candles.slice(-14).map((candle) => candle.close),
    source: chart.source,
  };
}

function fetchSparkQuotes(symbols: string[]): Promise<Quote[]> {
  if (symbols.length === 0) return Promise.resolve([]);
  const key = `spark-quotes:${symbols.join(",")}`;
  return cached(key, 60_000, async () => {
    const query = symbols.map(yahooSymbol).join(",");
    const payload = await getJson(
      `/v7/finance/spark?symbols=${encodeURIComponent(query)}&range=1mo&interval=1d`,
    );
    const results = (payload?.spark as { result?: { symbol?: string; response?: RawSeries[] }[] } | undefined)?.result ?? [];
    const lookup = new Map(symbols.map((symbol) => [yahooSymbol(symbol), symbol]));
    return results
      .map((entry) => {
        const series = entry.response?.[0];
        if (!series) return null;
        const display = lookup.get(entry.symbol ?? metaText(series.meta ?? {}, ["symbol"], "")) ?? entry.symbol ?? "";
        return display ? quoteFromSeries(display, series) : null;
      })
      .filter((quote): quote is Quote => quote !== null);
  }).then((quotes) => quotes ?? []);
}

export async function fetchQuote(symbol: string): Promise<Quote | null> {
  const quotes = await fetchSparkQuotes([symbol]);
  if (quotes[0]) return quotes[0];
  const chart = await fetchChart({ symbol, range: "1mo", interval: "1d" });
  if (!chart) return null;
  return {
    symbol: chart.symbol,
    name: chart.name,
    price: chart.price,
    change: chart.change,
    changePercent: chart.changePercent,
    previousClose: chart.previousClose,
    currency: chart.currency,
    exchange: chart.exchange,
    spark: chart.candles.slice(-14).map((candle) => candle.close),
    source: chart.source,
  };
}

export async function fetchQuotes(symbols: string[]): Promise<Quote[]> {
  const unique = [...new Set(symbols.filter(Boolean))];
  const quotes = await fetchSparkQuotes(unique);
  if (quotes.length > 0) return quotes;
  const results = await Promise.all(unique.map((symbol) => fetchQuote(symbol)));
  return results.filter((quote): quote is Quote => quote !== null);
}
