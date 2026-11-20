import type { PortfolioData, Position, ResearchItem } from "./types";
import { fetchQuotes } from "./yahoo";

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const API_VERSION = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2026-10-08";
const TOKEN = process.env.SANITY_API_READ_TOKEN;

export const isSanityConfigured = Boolean(PROJECT_ID);

async function sanityQuery<T>(groq: string): Promise<T | null> {
  if (!PROJECT_ID) return null;
  const url = `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/query/${DATASET}?query=${encodeURIComponent(groq)}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, { headers, signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!response.ok) return null;
    const payload = (await response.json()) as { result?: T };
    return payload.result ?? null;
  } catch {
    return null;
  }
}

interface RawResearch {
  _id?: string;
  title?: string;
  slug?: string;
  category?: string;
  analyst?: string;
  publishedAt?: string;
  abstract?: string;
  ticker?: string;
}

export async function fetchResearch(): Promise<ResearchItem[]> {
  const rows = await sanityQuery<RawResearch[]>(
    '*[_type == "research" && defined(slug.current)] | order(publishedAt desc)[0...12]{_id,title,"slug":slug.current,category,analyst,publishedAt,abstract,ticker}',
  );
  return (rows ?? []).map((row, index) => ({
    id: row._id ?? `research-${index}`,
    title: row.title ?? "Untitled",
    slug: row.slug ?? "",
    category: row.category ?? "Research",
    analyst: row.analyst ?? null,
    ticker: row.ticker ?? null,
    publishedAt: row.publishedAt ?? null,
    abstract: row.abstract ?? null,
  }));
}

interface RawPosition {
  _id?: string;
  ticker?: string;
  name?: string;
  shares?: number;
  costBasis?: number;
  purchaseDate?: string;
  status?: string;
  closePrice?: number;
  closedAt?: string;
  notes?: string;
  research?: { slug?: string } | null;
}

interface RawSettings {
  name?: string;
  cash?: number;
  startingBalance?: number;
}

export async function fetchPortfolio(): Promise<PortfolioData | null> {
  if (!isSanityConfigured) return null;
  const [settings, rows] = await Promise.all([
    sanityQuery<RawSettings | null>('*[_type == "portfolioSettings"][0]{name,cash,startingBalance}'),
    sanityQuery<RawPosition[]>(
      '*[_type == "portfolioPosition"] | order(status desc,ticker asc){_id,ticker,name,shares,costBasis,purchaseDate,status,closePrice,closedAt,notes,research->{"slug":slug.current}}',
    ),
  ]);
  if (!rows) return null;

  const open = rows.filter((row) => row.status !== "closed");
  const quotes = await fetchQuotes(open.map((row) => row.ticker ?? ""));
  const quoteBySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));

  const positions: Position[] = open.map((row, index) => {
    const ticker = (row.ticker ?? "").toUpperCase();
    const quote = quoteBySymbol.get(ticker);
    const shares = row.shares ?? 0;
    const costBasis = row.costBasis ?? 0;
    const costTotal = shares * costBasis;
    const price = quote?.price ?? null;
    const marketValue = price !== null ? shares * price : costTotal;
    const unrealized = price !== null ? marketValue - costTotal : null;
    return {
      id: row._id ?? `position-${index}`,
      ticker,
      name: row.name ?? quote?.name ?? "",
      shares,
      costBasis,
      purchaseDate: row.purchaseDate ?? null,
      notes: row.notes ?? null,
      researchSlug: row.research?.slug ?? null,
      status: "active",
      closePrice: null,
      price,
      previousClose: quote?.previousClose ?? null,
      marketValue,
      costTotal,
      unrealized,
      unrealizedPct: unrealized !== null && costTotal ? (unrealized / costTotal) * 100 : null,
      dayChangePct: quote?.changePercent ?? null,
      weight: 0,
    };
  });

  const capital = settings?.startingBalance ?? settings?.cash ?? 0;
  const openMarketValue = positions.reduce((sum, position) => sum + (position.marketValue ?? 0), 0);
  const deployed = positions.reduce((sum, position) => sum + position.costTotal, 0);
  const unrealizedTotal = positions.reduce((sum, position) => sum + (position.unrealized ?? 0), 0);
  const totalValue = capital + unrealizedTotal;
  for (const position of positions) {
    position.weight = totalValue > 0 ? ((position.marketValue ?? 0) / totalValue) * 100 : 0;
  }
  let dayChangeTotal = 0;
  let hasDayChange = false;
  for (const position of positions) {
    if (position.dayChangePct !== null && position.price !== null && position.previousClose) {
      dayChangeTotal += (position.price - position.previousClose) * position.shares;
      hasDayChange = true;
    }
  }
  const priorValue = totalValue - dayChangeTotal;

  return {
    ok: true,
    settings: {
      name: settings?.name ?? "W1 Portfolio",
      cash: totalValue - openMarketValue,
      startingBalance: capital,
    },
    positions,
    totals: {
      totalValue,
      cash: totalValue - openMarketValue,
      deployed,
      openMarketValue,
      unrealizedTotal,
      totalReturnPct: capital > 0 ? (unrealizedTotal / capital) * 100 : 0,
      dayChangePct: hasDayChange && priorValue > 0 ? (dayChangeTotal / priorValue) * 100 : null,
    },
    updatedAt: new Date().toISOString(),
  };
}
