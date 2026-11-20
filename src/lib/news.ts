import { XMLParser } from "fast-xml-parser";
import { fetchPortfolio } from "./sanity";
import type { NewsItem } from "./types";

const UA = "Mozilla/5.0";
const CACHE_TTL = 45_000;
const QUORUM = 4;
const QUORUM_MS = 3_000;
const FEED_TIMEOUT_MS = 8_000;
const POSITION_TTL = 300_000;
const cache = new Map<string, { value: NewsItem[]; at: number }>();
const pending = new Map<string, Promise<NewsItem[]>>();
let positionCache: { tickers: string[]; at: number } | null = null;

const STATIC_FEEDS = [
  { url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", publisher: "CNBC" },
  { url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", publisher: "MarketWatch" },
  { url: "https://www.ft.com/rss/home", publisher: "Financial Times" },
  {
    url: "https://www.prnewswire.com/rss/news-releases-list.rss",
    publisher: "PR Newswire",
  },
];

async function liveTickers(): Promise<string[]> {
  if (positionCache && Date.now() - positionCache.at < POSITION_TTL) {
    return positionCache.tickers;
  }
  const portfolio = await fetchPortfolio().catch(() => null);
  const tickers = (portfolio?.positions ?? []).slice(0, 5).map((position) => position.ticker);
  positionCache = { tickers, at: Date.now() };
  return tickers;
}

interface YahooNews {
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: number;
  relatedTickers?: string[];
  thumbnail?: { resolutions?: { url: string }[] };
}

function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return String(record["#text"] ?? "");
  }
  return "";
}

function cleanTitle(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/\s+-\s+[^-]+$/, "")
    .trim();
}

function parseRss(
  xml: string,
  fallbackPublisher: string,
  limit: number,
  tickers: string[] = [],
): NewsItem[] {
  try {
    const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml);
    const raw = parsed?.rss?.channel?.item;
    const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return items
      .slice(0, limit)
      .map((item: Record<string, unknown>, index: number) => {
        const publisher = text(item.source ?? item["News:Source"]) || fallbackPublisher;
        const title = cleanTitle(text(item.title));
        const url = text(item.link);
        return {
          id: `${text(item.guid) || url || text(item.pubDate)}-${index}-${fallbackPublisher}`,
          title,
          publisher,
          url,
          publishedAt: Date.parse(text(item.pubDate)) || Date.now(),
          tickers,
          thumbnail: null,
        };
      })
      .filter((item: NewsItem) => item.title && item.url);
  } catch {
    return [];
  }
}

async function fetchFeed(
  url: string,
  headers: Record<string, string>,
  timeout = FEED_TIMEOUT_MS,
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(url, {
      headers: { "User-Agent": UA, ...headers },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  }
}

async function fromYahoo(query: string, fallbackTicker?: string): Promise<NewsItem[] | null> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=14&quotesCount=0`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    const payload = (await response.json()) as { news?: YahooNews[] };
    const items = payload.news ?? [];
    if (items.length === 0) return null;
    return items.map((item, index) => ({
      id: `${item.providerPublishTime}-${index}`,
      title: item.title,
      publisher: item.publisher,
      url: item.link,
      publishedAt: item.providerPublishTime * 1000,
      tickers: item.relatedTickers?.length
        ? item.relatedTickers
        : fallbackTicker
          ? [fallbackTicker]
          : [],
      thumbnail: item.thumbnail?.resolutions?.[0]?.url ?? null,
    }));
  } catch {
    return null;
  }
}

async function fromRss(
  url: string,
  publisher: string,
  limit: number,
  tickers: string[] = [],
): Promise<NewsItem[]> {
  const xml = await fetchFeed(url, { Accept: "application/rss+xml,text/xml,*/*" });
  return xml ? parseRss(xml, publisher, limit, tickers) : [];
}

function relevant(item: NewsItem, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized || ["market", "markets", "stock", "stocks", "finance"].includes(normalized)) {
    return true;
  }
  const tokens = normalized
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2)
    .map((token) => token.replace(/s$/, ""));
  if (tokens.length === 0) return true;
  const haystack = `${item.title} ${item.publisher} ${item.tickers.join(" ")}`.toLowerCase();
  return tokens.some((token) => haystack.includes(token));
}

function unique(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 120) || item.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function latest(items: NewsItem[], limit: number): NewsItem[] {
  return unique(items)
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, limit);
}

async function collect(query: string): Promise<NewsItem[]> {
  const q = query.trim() || "markets";
  const googleUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:7d`)}&hl=en-GB&gl=GB&ceid=GB:en`;
  const bingUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=RSS`;
  const positions = (await liveTickers()).filter(
    (ticker) => ticker.toUpperCase() !== q.toUpperCase(),
  );
  const tasks: {
    promise: Promise<NewsItem[] | null>;
    querySpecific: boolean;
    position?: boolean;
  }[] = [
    { promise: fromYahoo(q), querySpecific: true },
    { promise: fromRss(googleUrl, "Google News", 14), querySpecific: true },
    { promise: fromRss(bingUrl, "Bing News", 10), querySpecific: true },
    ...STATIC_FEEDS.map((feed) => ({
      promise: fromRss(feed.url, feed.publisher, 12),
      querySpecific: false,
    })),
    ...positions.flatMap((ticker) => {
      const tickerGoogleUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(`${ticker} when:7d`)}&hl=en-GB&gl=GB&ceid=GB:en`;
      return [
        { promise: fromYahoo(ticker, ticker), querySpecific: true, position: true },
        {
          promise: fromRss(tickerGoogleUrl, "Google News", 6, [ticker]),
          querySpecific: true,
          position: true,
        },
      ];
    }),
  ];
  const batches: NewsItem[][] = [];
  const priorityBatches: NewsItem[][] = [];
  let queryBatches = 0;
  let positionBatches = 0;
  let finished = 0;
  let done = () => {};
  const complete = new Promise<void>((resolve) => {
    done = resolve;
  });

  for (const task of tasks) {
    void task.promise
      .then((items) => {
        if (items?.length) {
          const filtered = items.filter((item) => relevant(item, q));
          if (filtered.length) {
            batches.push(filtered);
            if (task.position) {
              priorityBatches.push(filtered);
              positionBatches += 1;
            }
            if (task.querySpecific) queryBatches += 1;
          }
        }
        finished += 1;
        const positionsReady = positions.length === 0 || positionBatches >= positions.length;
        if (
          (batches.length >= QUORUM && queryBatches > 0 && positionsReady) ||
          finished === tasks.length
        ) {
          done();
        }
      })
      .catch(() => {
        finished += 1;
        if (finished === tasks.length) done();
      });
  }

  const timer = setTimeout(done, QUORUM_MS);
  await complete;
  clearTimeout(timer);
  const priority = latest(
    priorityBatches.flatMap((batch) => latest(batch, 2)),
    8,
  );
  const priorityIds = new Set(priority.map((item) => item.id));
  const rest = latest(
    batches.flat().filter((item) => !priorityIds.has(item.id)),
    24 - priority.length,
  );
  return [...priority, ...rest].sort((a, b) => b.publishedAt - a.publishedAt);
}

function refresh(q: string): Promise<NewsItem[]> {
  const existing = pending.get(q);
  if (existing) return existing;
  const task = collect(q)
    .then((items) => {
      if (items.length) cache.set(q, { value: items, at: Date.now() });
      return items;
    })
    .finally(() => pending.delete(q));
  pending.set(q, task);
  return task;
}

export function fetchNews(query: string): Promise<NewsItem[]> {
  const q = query.trim() || "markets";
  const hit = cache.get(q);
  if (!hit) return refresh(q);
  if (Date.now() - hit.at < CACHE_TTL) return Promise.resolve(hit.value);
  void refresh(q);
  return Promise.resolve(hit.value);
}
