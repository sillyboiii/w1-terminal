import { fetchQuote } from "./yahoo";
import { yahooSymbol } from "./types";
import type { BalanceSheet, FinancialStatement, FundamentalsData } from "./types";

const HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];
const UA = "Mozilla/5.0";
const SEC_UA = "W1 Terminal research research@w1.investments";
const CACHE_TTL = 600_000;
const SEC_CACHE_TTL = 86_400_000;

const METRICS = [
  "annualTotalRevenue",
  "quarterlyTotalRevenue",
  "annualGrossProfit",
  "quarterlyGrossProfit",
  "annualOperatingIncome",
  "quarterlyOperatingIncome",
  "annualEBIT",
  "quarterlyEBIT",
  "annualEBITDA",
  "quarterlyEBITDA",
  "annualNetIncome",
  "quarterlyNetIncome",
  "annualDilutedEPS",
  "quarterlyDilutedEPS",
  "annualFreeCashFlow",
  "quarterlyFreeCashFlow",
] as const;

type MetricKey = (typeof METRICS)[number];

interface RawPoint {
  asOfDate?: string;
  periodType?: string;
  currencyCode?: string;
  reportedValue?: { raw?: number };
}

interface RawRow {
  meta?: { type?: string[] };
  [key: string]: unknown;
}

interface RawSeries {
  timeseries?: {
    result?: RawRow[] | null;
  };
}

interface SecFact {
  end?: string;
  val?: number;
  form?: string;
  fy?: number;
}

interface SecCompanyFacts {
  facts?: {
    "us-gaap"?: Record<string, { units?: { USD?: SecFact[] } }>;
    dei?: Record<string, { units?: { shares?: SecFact[] } }>;
  };
}

interface SecTickerEntry {
  cik_str: number;
  ticker: string;
  title?: string;
}

const cache = new Map<string, { value: FundamentalsData | null; at: number }>();
const pending = new Map<string, Promise<FundamentalsData | null>>();
let secTickers: { value: Record<string, number>; at: number } | null = null;
const secFactsCache = new Map<string, { value: SecCompanyFacts | null; at: number }>();

async function getJson(url: string, headers: Record<string, string>, timeout = 8000): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", ...headers },
      signal: controller.signal,
      cache: "no-store",
    });
    return response.ok ? ((await response.json()) as Record<string, unknown>) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function valueAt(series: Partial<Record<MetricKey, RawPoint[]>>, key: MetricKey, date: string): number | null {
  const point = series[key]?.find((candidate) => candidate.asOfDate === date);
  return typeof point?.reportedValue?.raw === "number" ? point.reportedValue.raw : null;
}

function datesFor(series: Partial<Record<MetricKey, RawPoint[]>>, keys: readonly MetricKey[], period: string): string[] {
  const dates = new Set<string>();
  for (const key of keys) {
    for (const point of series[key] ?? []) {
      if (point.asOfDate && point.periodType === period) dates.add(point.asOfDate);
    }
  }
  return [...dates].sort((a, b) => b.localeCompare(a)).slice(0, 5);
}

function buildStatements(
  series: Partial<Record<MetricKey, RawPoint[]>>,
  period: string,
): FinancialStatement[] {
  const keys: MetricKey[] = [
    "annualTotalRevenue", "quarterlyTotalRevenue",
    "annualGrossProfit", "quarterlyGrossProfit",
    "annualOperatingIncome", "quarterlyOperatingIncome",
    "annualEBIT", "quarterlyEBIT",
    "annualEBITDA", "quarterlyEBITDA",
    "annualNetIncome", "quarterlyNetIncome",
    "annualDilutedEPS", "quarterlyDilutedEPS",
    "annualFreeCashFlow", "quarterlyFreeCashFlow",
  ];
  const prefix = period === "12M" ? "annual" : "quarterly";
  const dates = datesFor(series, keys, period);
  const currency = series.annualTotalRevenue?.[0]?.currencyCode ?? null;
  return dates.map((date) => ({
    date,
    period,
    currency,
    revenue: valueAt(series, `${prefix}TotalRevenue` as MetricKey, date),
    grossProfit: valueAt(series, `${prefix}GrossProfit` as MetricKey, date),
    operatingIncome: valueAt(series, `${prefix}OperatingIncome` as MetricKey, date),
    ebitda: valueAt(series, `${prefix}EBITDA` as MetricKey, date),
    netIncome: valueAt(series, `${prefix}NetIncome` as MetricKey, date),
    eps: valueAt(series, `${prefix}DilutedEPS` as MetricKey, date),
    freeCashFlow: valueAt(series, `${prefix}FreeCashFlow` as MetricKey, date),
  }));
}

function ratio(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return (numerator / denominator) * 100;
}

function growth(latest: number | null, previous: number | null): number | null {
  if (latest === null || previous === null || previous === 0) return null;
  return ((latest - previous) / Math.abs(previous)) * 100;
}

async function loadSecTickers(): Promise<Record<string, number>> {
  if (secTickers && Date.now() - secTickers.at < SEC_CACHE_TTL) return secTickers.value;
  const payload = await getJson("https://www.sec.gov/files/company_tickers.json", { "User-Agent": SEC_UA }, 12_000);
  const entries = Object.values(payload ?? {}) as SecTickerEntry[];
  const value: Record<string, number> = {};
  for (const entry of entries) {
    if (entry.ticker) value[entry.ticker.toUpperCase()] = entry.cik_str;
  }
  if (Object.keys(value).length > 0) secTickers = { value, at: Date.now() };
  return value;
}

function latestSecFact(facts: SecCompanyFacts | null, tags: string[], namespace: "us-gaap" | "dei" = "us-gaap"): SecFact | null {
  if (!facts) return null;
  const source = namespace === "dei" ? facts.facts?.dei : facts.facts?.["us-gaap"];
  for (const tag of tags) {
    const entries = source?.[tag]?.units as { USD?: SecFact[]; shares?: SecFact[] } | undefined;
    const candidates = namespace === "dei" ? entries?.shares ?? [] : entries?.USD ?? [];
    const filtered = candidates.filter((entry) => entry.form === "10-K" || namespace === "dei");
    const chosen = [...(filtered.length > 0 ? filtered : candidates)]
      .filter((entry) => typeof entry.val === "number" && entry.end)
      .sort((a, b) => (b.end ?? "").localeCompare(a.end ?? ""))[0];
    if (chosen) return chosen;
  }
  return null;
}

async function fetchBalanceSheet(symbol: string): Promise<BalanceSheet | null> {
  const tickers = await loadSecTickers();
  const cik = tickers[symbol.toUpperCase()];
  if (!cik) return null;
  const key = String(cik).padStart(10, "0");
  const cached = secFactsCache.get(key);
  let facts = cached && Date.now() - cached.at < SEC_CACHE_TTL ? cached.value : null;
  if (!facts) {
    facts = await getJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${key}.json`, { "User-Agent": SEC_UA }, 12_000) as SecCompanyFacts | null;
    if (facts) secFactsCache.set(key, { value: facts, at: Date.now() });
  }
  const cashFact = latestSecFact(facts, ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"]);
  const debtFact = latestSecFact(facts, ["LongTermDebtNoncurrent", "LongTermDebtCurrent", "ShortTermBorrowings"]);
  const assetsFact = latestSecFact(facts, ["Assets"]);
  const liabilitiesFact = latestSecFact(facts, ["Liabilities"]);
  const equityFact = latestSecFact(facts, ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"]);
  const sharesFact = latestSecFact(facts, ["EntityCommonStockSharesOutstanding"], "dei");
  const date = cashFact?.end ?? assetsFact?.end ?? debtFact?.end ?? "";
  if (!date) return null;
  const cash = cashFact?.val ?? null;
  const debt = debtFact?.val ?? null;
  const shares = sharesFact?.val ?? null;
  return {
    date,
    cash,
    debt,
    assets: assetsFact?.val ?? null,
    liabilities: liabilitiesFact?.val ?? null,
    equity: equityFact?.val ?? null,
    shares,
    source: "SEC EDGAR",
  };
}

async function load(symbol: string): Promise<FundamentalsData | null> {
  const ticker = yahooSymbol(symbol);
  const path = `/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(ticker)}?symbol=${encodeURIComponent(ticker)}&type=${METRICS.join(",")}&period1=0&period2=1999999999`;
  const [payloads, quote] = await Promise.all([
    Promise.all(HOSTS.map((host) => getJson(`${host}${path}`, { "User-Agent": UA }))),
    fetchQuote(symbol).catch(() => null),
  ]);
  const raw = payloads.find((payload) => {
    const timeseries = payload?.timeseries as RawSeries["timeseries"] | undefined;
    return Boolean(timeseries?.result);
  }) as RawSeries | undefined;
  if (!raw) return null;

  const series: Partial<Record<MetricKey, RawPoint[]>> = {};
  for (const row of raw.timeseries?.result ?? []) {
    const key = row.meta?.type?.[0] as MetricKey | undefined;
    if (!key || !METRICS.includes(key)) continue;
    const points = Object.values(row).find(
      (value): value is RawPoint[] => Array.isArray(value) && value.length > 0 && typeof value[0] === "object" && value[0] !== null && "asOfDate" in value[0],
    );
    if (points) series[key] = points;
  }
  if (Object.keys(series).length === 0) return null;

  const annual = buildStatements(series, "12M");
  const quarterly = buildStatements(series, "3M");
  const latest = annual[0] ?? null;
  const previous = annual[1] ?? null;
  const balanceSheet = await fetchBalanceSheet(symbol);
  const shares = balanceSheet?.shares ?? null;
  const debt = balanceSheet?.debt ?? null;
  const cash = balanceSheet?.cash ?? null;
  const marketCap = shares && quote?.price ? shares * quote.price : null;
  const enterpriseValue = marketCap !== null && debt !== null && cash !== null
    ? marketCap + debt - cash
    : null;

  return {
    symbol: symbol.toUpperCase(),
    name: quote?.name ?? symbol.toUpperCase(),
    currency: quote?.currency ?? series.annualTotalRevenue?.[0]?.currencyCode ?? "USD",
    exchange: quote?.exchange ?? "",
    price: quote?.price ?? null,
    changePercent: quote?.changePercent ?? null,
    metrics: {
      revenue: latest?.revenue ?? null,
      revenueGrowth: growth(latest?.revenue ?? null, previous?.revenue ?? null),
      grossProfit: latest?.grossProfit ?? null,
      grossMargin: ratio(latest?.grossProfit ?? null, latest?.revenue ?? null),
      operatingIncome: latest?.operatingIncome ?? null,
      operatingMargin: ratio(latest?.operatingIncome ?? null, latest?.revenue ?? null),
      ebitda: latest?.ebitda ?? null,
      ebitdaMargin: ratio(latest?.ebitda ?? null, latest?.revenue ?? null),
      netIncome: latest?.netIncome ?? null,
      netMargin: ratio(latest?.netIncome ?? null, latest?.revenue ?? null),
      netIncomeGrowth: growth(latest?.netIncome ?? null, previous?.netIncome ?? null),
      dilutedEps: latest?.eps ?? null,
      freeCashFlow: latest?.freeCashFlow ?? null,
      freeCashFlowMargin: ratio(latest?.freeCashFlow ?? null, latest?.revenue ?? null),
      priceToEarnings: quote?.price !== null && quote?.price !== undefined && latest?.eps ? quote.price / latest.eps : null,
      marketCap,
      enterpriseValue,
      cash: balanceSheet?.cash ?? null,
      debt: balanceSheet?.debt ?? null,
      assets: balanceSheet?.assets ?? null,
      liabilities: balanceSheet?.liabilities ?? null,
      equity: balanceSheet?.equity ?? null,
    },
    annual,
    quarterly,
    balanceSheet,
    source: `Yahoo Finance fundamentals${balanceSheet ? " + SEC EDGAR" : ""}`,
    updatedAt: new Date().toISOString(),
  };
}

function refresh(symbol: string): Promise<FundamentalsData | null> {
  const existing = pending.get(symbol);
  if (existing) return existing;
  const task = load(symbol)
    .then((value) => {
      if (value) cache.set(symbol, { value, at: Date.now() });
      return value;
    })
    .finally(() => pending.delete(symbol));
  pending.set(symbol, task);
  return task;
}

export function fetchFundamentals(symbol: string): Promise<FundamentalsData | null> {
  const ticker = symbol.trim().toUpperCase();
  if (!ticker) return Promise.resolve(null);
  const hit = cache.get(ticker);
  if (!hit) return refresh(ticker);
  if (Date.now() - hit.at < CACHE_TTL) return Promise.resolve(hit.value);
  void refresh(ticker);
  return Promise.resolve(hit.value);
}
