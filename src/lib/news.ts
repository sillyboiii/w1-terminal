import { XMLParser } from "fast-xml-parser";
import type { NewsItem } from "./types";

const UA = "Mozilla/5.0";
const cache = new Map<string, { value: NewsItem[]; at: number }>();

interface YahooNews {
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: number;
  relatedTickers?: string[];
  thumbnail?: { resolutions?: { url: string }[] };
}

async function fromYahoo(query: string): Promise<NewsItem[] | null> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=14&quotesCount=0`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
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
      tickers: item.relatedTickers ?? [],
      thumbnail: item.thumbnail?.resolutions?.[0]?.url ?? null,
    }));
  } catch {
    return null;
  }
}

async function fromGoogleNews(query: string): Promise<NewsItem[] | null> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:7d`)}&hl=en-GB&gl=GB&ceid=GB:en`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/rss+xml,text/xml,*/*" },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    const xml = await response.text();
    const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml);
    const raw = parsed?.rss?.channel?.item;
    const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (items.length === 0) return null;
    return items.slice(0, 14).map((item: Record<string, unknown>, index: number) => {
      const source = item.source as { "#text"?: string } | string | undefined;
      const publisher =
        typeof source === "string" ? source : (source?.["#text"] ?? "Google News");
      return {
        id: String(item.guid ?? `${item.pubDate}-${index}`),
        title: String(item.title ?? "").replace(/\s+-\s+[^-]+$/, ""),
        publisher,
        url: String(item.link ?? ""),
        publishedAt: Date.parse(String(item.pubDate ?? "")) || Date.now(),
        tickers: [],
        thumbnail: null,
      };
    });
  } catch {
    return null;
  }
}

export function fetchNews(query: string): Promise<NewsItem[]> {
  const q = query.trim() || "markets";
  const hit = cache.get(q);
  if (hit && Date.now() - hit.at < 120_000) return Promise.resolve(hit.value);
  return fromYahoo(q)
    .then((items) => (items?.length ? items : fromGoogleNews(q)))
    .then((items) => {
      const result = items ?? [];
      if (result.length) cache.set(q, { value: result, at: Date.now() });
      return result;
    });
}
