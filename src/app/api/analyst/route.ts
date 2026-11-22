import { NextResponse } from "next/server";
import { fetchFundamentals } from "@/lib/fundamentals";
import { fetchNews } from "@/lib/news";
import { fetchResearch } from "@/lib/sanity";
import { fetchQuote } from "@/lib/yahoo";
import { formatShortDate } from "@/lib/format";
import { validSymbol } from "@/lib/types";

export const dynamic = "force-dynamic";

const MODEL = "anthropic/claude-sonnet-5.5";
const GATEWAY = "https://ai-gateway.vercel.sh/v1/chat/completions";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  symbol?: string;
  question?: string;
  history?: ChatMessage[];
}

function money(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

function pct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(1)}%`;
}

function num(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return value.toFixed(digits);
}

function buildContext(
  symbol: string,
  fundamentals: Awaited<ReturnType<typeof fetchFundamentals>>,
  quote: Awaited<ReturnType<typeof fetchQuote>>,
  news: Awaited<ReturnType<typeof fetchNews>>,
  research: Awaited<ReturnType<typeof fetchResearch>>,
): string {
  if (!fundamentals) return `No financial data is available for ${symbol}. Say so plainly.`;
  const metrics = fundamentals.metrics;
  const annual = fundamentals.annual
    .slice(0, 4)
    .map((row) => `${formatShortDate(row.date)}: revenue ${money(row.revenue)}, gross profit ${money(row.grossProfit)}, EBITDA ${money(row.ebitda)}, net income ${money(row.netIncome)}, diluted EPS ${num(row.eps)}, FCF ${money(row.freeCashFlow)}`)
    .join("\n");
  const quarterly = fundamentals.quarterly
    .slice(0, 4)
    .map((row) => `${formatShortDate(row.date)}: revenue ${money(row.revenue)}, EBITDA ${money(row.ebitda)}, net income ${money(row.netIncome)}, diluted EPS ${num(row.eps)}, FCF ${money(row.freeCashFlow)}`)
    .join("\n");
  const balance = fundamentals.balanceSheet
    ? `${formatShortDate(fundamentals.balanceSheet.date)}: cash ${money(fundamentals.balanceSheet.cash)}, debt ${money(fundamentals.balanceSheet.debt)}, assets ${money(fundamentals.balanceSheet.assets)}, liabilities ${money(fundamentals.balanceSheet.liabilities)}, equity ${money(fundamentals.balanceSheet.equity)}`
    : "not available";
  const headlines = news
    .slice(0, 6)
    .map((item) => `${formatShortDate(item.publishedAt)} · ${item.publisher}: ${item.title}`)
    .join("\n");
  const notes = research
    .filter((item) => !item.ticker || item.ticker === symbol)
    .slice(0, 3)
    .map((item) => `${formatShortDate(item.publishedAt)} · ${item.title}: ${item.abstract ?? ""}`)
    .join("\n");

  return `
COMPANY
${fundamentals.name} (${symbol}) · ${fundamentals.exchange} · ${fundamentals.currency}

MARKET SNAPSHOT
Price ${num(quote?.price ?? fundamentals.price)} · day ${pct(quote?.changePercent ?? fundamentals.changePercent)} · P/E ${num(metrics.priceToEarnings)} · est. market cap ${money(metrics.marketCap)}

LATEST ANNUAL FINANCIALS
Revenue ${money(metrics.revenue)} · YoY ${pct(metrics.revenueGrowth)}
Gross margin ${pct(metrics.grossMargin)} · operating margin ${pct(metrics.operatingMargin)} · EBITDA margin ${pct(metrics.ebitdaMargin)} · net margin ${pct(metrics.netMargin)} · FCF margin ${pct(metrics.freeCashFlowMargin)}
Net income ${money(metrics.netIncome)} · YoY ${pct(metrics.netIncomeGrowth)} · diluted EPS ${num(metrics.dilutedEps)} · free cash flow ${money(metrics.freeCashFlow)}

ANNUAL HISTORY
${annual || "not available"}

QUARTERLY HISTORY
${quarterly || "not available"}

BALANCE SHEET (${fundamentals.balanceSheet?.source ?? "unavailable"})
${balance}

RECENT HEADLINES
${headlines || "not available"}

PUBLISHED W1 CONTEXT
${notes || "none"}

SOURCES
${fundamentals.source}; Yahoo Finance quote; live news wire; W1 research wire.
`.trim();
}

function fallbackAnswer(
  symbol: string,
  fundamentals: Awaited<ReturnType<typeof fetchFundamentals>>,
  quote: Awaited<ReturnType<typeof fetchQuote>>,
  news: Awaited<ReturnType<typeof fetchNews>>,
  question: string,
): string {
  if (!fundamentals) {
    return `- No financial data is available for ${symbol} from Yahoo Finance right now.\n- Watch: retry after the market data provider refreshes.`;
  }

  const q = question.toLowerCase();
  const m = fundamentals.metrics;
  const latest = fundamentals.annual[0];
  const latestQuarter = fundamentals.quarterly[0];
  const has = (...terms: string[]) => terms.some((term) => q.includes(term));
  const lines: string[] = [];
  const contextLines: string[] = [];
  const add = (line: string) => {
    if (!lines.includes(line)) lines.push(line);
  };
  const addContext = (line: string) => {
    add(line);
    contextLines.push(line);
  };

  if (has("should i", "buy", "sell", "recommend", "advice", "price target", "target price")) {
    add(`- I cannot give personalised advice or a price target. The data below is the decision-relevant context I can verify.`);
  }
  if (has("guidance", "forecast", "management", "moat", "competitor", "peer", "dividend")) {
    add(`- Guidance, peer comparisons, dividend policy and management claims are not loaded in this pane, so I will not invent them.`);
  }
  if (has("why", "down", "up", "tape", "news", "headline", "catalyst", "sentiment", "stock move")) {
    addContext(`- Tape: ${pct(quote?.changePercent ?? fundamentals.changePercent)} today. Latest wire headline: ${news[0]?.title?.slice(0, 150) ?? "no fresh headline available"}.`);
    add(`- The data does not prove a cause for the move; treat the headline as context, not attribution.`);
  }
  if (has("balance sheet", "debt", "liabilit", "equity", "solvency", "leverage", "cash position")) {
    addContext(`- Balance sheet (${formatShortDate(fundamentals.balanceSheet?.date ?? null)}): cash ${money(m.cash)}, debt ${money(m.debt)}, liabilities ${money(m.liabilities)}, equity ${money(m.equity)}.`);
  }
  if (has("cash flow", "fcf", "free cash", "cash generation", "conversion")) {
    addContext(`- Cash generation: net income ${money(m.netIncome)}, free cash flow ${money(m.freeCashFlow)}, FCF margin ${pct(m.freeCashFlowMargin)}.`);
  }
  if (has("margin", "profit", "gross", "operating", "ebitda", "net income", "earnings", "eps")) {
    addContext(`- Profitability: gross margin ${pct(m.grossMargin)}, operating margin ${pct(m.operatingMargin)}, EBITDA margin ${pct(m.ebitdaMargin)}, net margin ${pct(m.netMargin)}, diluted EPS ${num(m.dilutedEps)}.`);
  }
  if (has("revenue", "sales", "top line", "growth", "growing", "grew")) {
    addContext(`- Revenue: ${money(m.revenue)} in the latest annual period (${pct(m.revenueGrowth)} YoY, ${formatShortDate(latest?.date ?? null)}).`);
  }
  if (has("quarter", "latest results", "recent results", "q1", "q2", "q3", "q4")) {
    addContext(`- Latest quarter (${formatShortDate(latestQuarter?.date ?? null)}): revenue ${money(latestQuarter?.revenue ?? null)}, net income ${money(latestQuarter?.netIncome ?? null)}, EPS ${num(latestQuarter?.eps ?? null)}, FCF ${money(latestQuarter?.freeCashFlow ?? null)}.`);
  }
  if (has("valuation", "p/e", "pe ratio", "expensive", "cheap", "market cap", "price", "worth")) {
    addContext(`- Valuation: price ${num(quote?.price ?? fundamentals.price)}, indicated P/E ${num(m.priceToEarnings)}, estimated market cap ${money(m.marketCap)}.`);
  }
  if (has("risk", "watch", "concern", "problem", "bear", "thesis")) {
    addContext(`- Watch: revenue growth and free cash flow conversion are the cleanest checks on the current narrative.`);
  }

  if (contextLines.length === 0) {
    add(`- I cannot answer that from the loaded data alone; no verified qualitative source is available for "${question.slice(0, 120)}".`);
    add(`- What I can verify: revenue ${money(m.revenue)} (${pct(m.revenueGrowth)} YoY), net margin ${pct(m.netMargin)}, free cash flow ${money(m.freeCashFlow)}, P/E ${num(m.priceToEarnings)}.`);
  }

  add(`- Data: ${fundamentals.source}. Rule-based answer — the AI model is unavailable on this deployment.`);
  return lines.slice(0, 8).join("\n");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RequestBody;
  const symbol = (body.symbol ?? "").trim().toUpperCase();
  const question = (body.question ?? "").trim().slice(0, 500);

  if (!validSymbol(symbol) || !question) {
    return NextResponse.json({ error: "symbol and question are required" }, { status: 400 });
  }

  const token = request.headers.get("x-vercel-oidc-token") || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;

  const [fundamentals, quote, news, research] = await Promise.all([
    fetchFundamentals(symbol),
    fetchQuote(symbol),
    fetchNews(symbol),
    fetchResearch().catch(() => []),
  ]);
  const context = buildContext(symbol, fundamentals, quote, news, research);
  const history = (body.history ?? [])
    .filter((message): message is ChatMessage => (message?.role === "user" || message?.role === "assistant") && typeof message.content === "string")
    .slice(-6)
    .map((message) => ({ role: message.role, content: message.content.slice(0, 800) }));

  let text: string | null = null;
  if (token) {
    try {
      const response = await fetch(GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 700,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: `You are the W1 Investments analyst inside a market terminal. Answer the question in at most five compact bullets, in a dry institutional tone, using only the supplied data. Cite figures with their period labels. If a figure is unavailable, say so. Do not invent facts, make price targets, publish a report, or give personalised advice. End with one short "Watch:" line naming the main risk or thing to monitor.`,
            },
            ...history,
            { role: "user", content: `${context}\n\nQUESTION: ${question}` },
          ],
        }),
      });
      if (response.ok) {
        const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
        text = payload.choices?.[0]?.message?.content?.trim() ?? null;
      }
    } catch {
      text = null;
    }
  }

  const sources = fundamentals?.source ?? "Yahoo Finance";
  if (!text) {
    return NextResponse.json({
      text: fallbackAnswer(symbol, fundamentals, quote, news, question),
      mode: "fallback",
      symbol,
      sources,
    });
  }

  return NextResponse.json({ text, mode: "ai", symbol, model: MODEL, sources });
}
