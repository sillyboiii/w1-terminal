export interface Quote {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  previousClose: number | null;
  currency: string;
  exchange: string;
  spark: number[];
  source?: string;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartData {
  symbol: string;
  name: string;
  currency: string;
  exchange: string;
  range: string;
  interval: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  previousClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  yearHigh: number | null;
  yearLow: number | null;
  candles: Candle[];
  source: string;
  updatedAt: string;
}

export interface NewsItem {
  id: string;
  title: string;
  publisher: string;
  url: string;
  publishedAt: number;
  tickers: string[];
  thumbnail: string | null;
}

export interface ResearchItem {
  id: string;
  title: string;
  slug: string;
  category: string;
  analyst: string | null;
  ticker: string | null;
  publishedAt: string | null;
  abstract: string | null;
}

export interface FinancialStatement {
  date: string;
  period: string;
  currency: string | null;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  ebitda: number | null;
  netIncome: number | null;
  eps: number | null;
  freeCashFlow: number | null;
}

export interface BalanceSheet {
  date: string;
  cash: number | null;
  debt: number | null;
  assets: number | null;
  liabilities: number | null;
  equity: number | null;
  shares: number | null;
  source: string;
}

export interface FundamentalsData {
  symbol: string;
  name: string;
  currency: string;
  exchange: string;
  price: number | null;
  changePercent: number | null;
  metrics: Record<string, number | null>;
  annual: FinancialStatement[];
  quarterly: FinancialStatement[];
  balanceSheet: BalanceSheet | null;
  source: string;
  updatedAt: string;
}

export interface Position {
  id: string;
  ticker: string;
  name: string;
  shares: number;
  costBasis: number;
  purchaseDate: string | null;
  notes: string | null;
  researchSlug: string | null;
  status: string;
  closePrice: number | null;
  price: number | null;
  previousClose: number | null;
  marketValue: number | null;
  costTotal: number;
  unrealized: number | null;
  unrealizedPct: number | null;
  dayChangePct: number | null;
  weight: number;
}

export interface PortfolioData {
  ok: boolean;
  settings: { name: string; cash: number; startingBalance: number } | null;
  positions: Position[];
  totals: {
    totalValue: number;
    cash: number;
    deployed: number;
    openMarketValue: number;
    unrealizedTotal: number;
    totalReturnPct: number;
    dayChangePct: number | null;
  };
  updatedAt: string;
}

export type PaneKind = "chart" | "news" | "watchlist" | "research" | "analyst" | "holdings" | "help";

export interface PaneConfig {
  id: string;
  kind: PaneKind;
  symbol?: string;
}

export const WATCHLIST = [
  "FTSE",
  "SPX",
  "NDX",
  "AAPL",
  "MSFT",
  "NVDA",
  "AMZN",
  "GOOGL",
  "META",
  "TSLA",
  "V",
  "MA",
  "AZN",
  "SHEL",
  "BP",
  "RIO",
];

export const YAHOO_SYMBOLS: Record<string, string> = {
  FTSE: "^FTSE",
  SPX: "^GSPC",
  NDX: "^NDX",
  COMP: "^IXIC",
};

export const SYMBOL_LABELS: Record<string, string> = {
  FTSE: "FTSE 100",
  SPX: "S&P 500",
  NDX: "NASDAQ 100",
  COMP: "NASDAQ Comp",
};

export function yahooSymbol(symbol: string): string {
  return YAHOO_SYMBOLS[symbol.toUpperCase()] ?? symbol.toUpperCase();
}

export function validSymbol(symbol: string): boolean {
  return /^[A-Za-z0-9.^=-]{1,24}$/.test(symbol);
}
