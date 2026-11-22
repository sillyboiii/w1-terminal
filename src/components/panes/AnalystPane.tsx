"use client";

import { useEffect, useRef, useState } from "react";
import { formatShortDate } from "@/lib/format";
import type { FundamentalsData, NewsItem } from "@/lib/types";

interface Props {
  symbol: string;
}

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  mode?: "ai" | "fallback";
}

type View = "financials" | "chat";
type Period = "annual" | "quarterly";

const SUGGESTIONS = [
  "Summarise the latest results",
  "What changed in the margins?",
  "What does the balance sheet say?",
  "How does recent news affect the thesis?",
];

function money(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `$${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value)}`;
}

function pct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function decimal(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="border-b border-r border-border/60 px-3 py-2">
      <p className="label !text-[8px]">{label}</p>
      <p className={`num mt-1 text-[12px] ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-ink"}`}>{value}</p>
    </div>
  );
}

export function AnalystPane({ symbol }: Props) {
  const [requestedSymbol, setRequestedSymbol] = useState(symbol.toUpperCase());
  const [ticker, setTicker] = useState(symbol.toUpperCase());
  const [tickerInput, setTickerInput] = useState(symbol.toUpperCase());
  const [view, setView] = useState<View>("financials");
  const [period, setPeriod] = useState<Period>("annual");
  const [data, setData] = useState<FundamentalsData | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [thinking, setThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messageIdRef = useRef(0);

  const nextSymbol = symbol.toUpperCase();
  if (nextSymbol !== requestedSymbol) {
    setRequestedSymbol(nextSymbol);
    setTicker(nextSymbol);
    setTickerInput(nextSymbol);
    setLoading(true);
    setError(null);
    setMessages([]);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/fundamentals?symbol=${encodeURIComponent(ticker)}`, { cache: "no-store" })
        .then((response) => (response.ok ? (response.json() as Promise<{ fundamentals: FundamentalsData }>) : Promise.reject()))
        .catch(() => null),
      fetch(`/api/news?q=${encodeURIComponent(ticker)}`, { cache: "no-store" })
        .then((response) => response.json() as Promise<{ items?: NewsItem[] }>)
        .catch(() => ({ items: [] })),
    ]).then(([fundamentals, headlines]) => {
      if (cancelled) return;
      setData(fundamentals?.fundamentals ?? null);
      setNews(headlines.items ?? []);
      setError(fundamentals ? null : "Company financials unavailable for this symbol.");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const changeSymbol = () => {
    const next = tickerInput.trim().toUpperCase();
    if (!next) return;
    setTicker(next);
    setTickerInput(next);
    setLoading(true);
    setError(null);
    setMessages([]);
  };

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    const userMessage: Message = { id: ++messageIdRef.current, role: "user", text: trimmed };
    const history = messages.map((message) => ({ role: message.role, content: message.text }));
    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setThinking(true);
    try {
      const response = await fetch("/api/analyst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: ticker, question: trimmed, history }),
      });
      const payload = (await response.json()) as { text?: string; mode?: "ai" | "fallback"; error?: string };
      setMessages((current) => [
        ...current,
        {
          id: ++messageIdRef.current,
          role: "assistant",
          text: payload.text ?? payload.error ?? "Analyst unavailable.",
          mode: payload.mode,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        { id: ++messageIdRef.current, role: "assistant", text: "Analyst unavailable. Try again.", mode: "fallback" },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const rows = [
    { label: "Revenue", key: "revenue", format: money },
    { label: "Gross profit", key: "grossProfit", format: money },
    { label: "Operating income", key: "operatingIncome", format: money },
    { label: "EBITDA", key: "ebitda", format: money },
    { label: "Net income", key: "netIncome", format: money },
    { label: "Diluted EPS", key: "eps", format: decimal },
    { label: "Free cash flow", key: "freeCashFlow", format: money },
  ] as const;
  const columns = data?.[period].slice(0, 4) ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
        <span className="label !text-ink">Company</span>
        <input
          value={tickerInput}
          onChange={(event) => setTickerInput(event.target.value.toUpperCase())}
          onKeyDown={(event) => {
            if (event.key === "Enter") changeSymbol();
          }}
          aria-label="Company ticker"
          className="num h-8 w-28 border border-border bg-transparent px-2 text-[11px] text-ink outline-none focus:border-ink"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={changeSymbol}
          className="label border border-border px-2 py-1 !text-ink transition-colors hover:border-ink"
        >
          Load
        </button>
        <div className="ml-auto flex items-center border border-border p-0.5">
          {(["financials", "chat"] as View[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              className={`label px-2 py-1 !text-[8px] transition-colors ${view === item ? "bg-ink !text-background" : "!text-muted hover:!text-ink"}`}
            >
              {item === "financials" ? "Financials" : "Ask analyst"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-1.5">
        <span className="num text-[11px] font-semibold text-ink">{ticker}</span>
        <span className="truncate text-[10px] text-muted">{data?.name ?? (loading ? "Loading company data" : "—")}</span>
        {data?.price !== null && data?.price !== undefined ? (
          <span className="num text-[10px] text-ink">{money(data.price)}</span>
        ) : null}
        <span className="num ml-auto text-[9px] text-muted">{data?.source ?? "—"}</span>
      </div>

      {view === "financials" ? (
        <div className="pane-scroll min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-2 p-3">
              {[0, 1, 2, 3, 4].map((item) => (
                <div key={item} className="h-8 animate-pulse bg-border/25" />
              ))}
            </div>
          ) : null}
          {!loading && error ? <p className="p-4 text-[11px] text-down">{error}</p> : null}
          {!loading && data ? (
            <>
              <div className="grid grid-cols-2 border-b border-border sm:grid-cols-3 lg:grid-cols-4">
                <Metric label="Revenue" value={money(data.metrics.revenue)} />
                <Metric label="Revenue YoY" value={pct(data.metrics.revenueGrowth)} tone={data.metrics.revenueGrowth !== null && data.metrics.revenueGrowth >= 0 ? "up" : "down"} />
                <Metric label="Gross margin" value={pct(data.metrics.grossMargin)} />
                <Metric label="Operating margin" value={pct(data.metrics.operatingMargin)} />
                <Metric label="Net margin" value={pct(data.metrics.netMargin)} />
                <Metric label="Free cash flow" value={money(data.metrics.freeCashFlow)} />
                <Metric label="Diluted EPS" value={decimal(data.metrics.dilutedEps)} />
                <Metric label="P/E" value={decimal(data.metrics.priceToEarnings)} />
                <Metric label="Est. market cap" value={money(data.metrics.marketCap)} />
                <Metric label="Cash" value={money(data.metrics.cash)} />
                <Metric label="Debt" value={money(data.metrics.debt)} />
                <Metric label="Equity" value={money(data.metrics.equity)} />
              </div>

              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="label !text-ink">Financial statements</span>
                <div className="flex items-center border border-border p-0.5">
                  {(["annual", "quarterly"] as Period[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPeriod(item)}
                      className={`num px-2 py-0.5 text-[9px] capitalize transition-colors ${period === item ? "bg-ink text-background" : "text-muted hover:text-ink"}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {columns.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="label px-3 py-2 text-left !text-[8px]">Metric</th>
                        {columns.map((column) => (
                          <th key={column.date} className="num px-3 py-2 text-right text-[9px] text-ink">
                            {formatShortDate(column.date)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.key} className="border-b border-border/60">
                          <td className="label px-3 py-1.5 !text-[8px]">{row.label}</td>
                          {columns.map((column) => (
                            <td key={column.date} className="num px-3 py-1.5 text-right text-[10px] text-foreground">
                              {row.format(column[row.key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-4 text-[11px] text-muted">No statement history available.</p>
              )}

              {news.length > 0 ? (
                <div className="border-t border-border">
                  <p className="label border-b border-border px-3 py-2 !text-ink">Recent headlines</p>
                  {news.slice(0, 4).map((item) => (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block border-b border-border/60 px-3 py-2 transition-colors hover:bg-border/25"
                    >
                      <span className="num text-[9px] text-muted">{formatShortDate(item.publishedAt)} · {item.publisher}</span>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-foreground">{item.title}</p>
                    </a>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="pane-scroll min-h-0 flex-1 overflow-y-auto">
            <div className="border-b border-border px-3 py-3">
              <p className="label !text-ink">W1 analyst · {ticker}</p>
              <p className="mt-1 max-w-2xl text-[10px] leading-relaxed text-muted">
                Ask about the numbers, margins, balance sheet or recent headlines. Answers are grounded in the live company data loaded in this pane.
              </p>
            </div>
            {messages.length === 0 ? (
              <div className="grid gap-2 p-3 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void ask(suggestion)}
                    className="border border-border px-3 py-2 text-left text-[10px] text-foreground transition-colors hover:border-ink"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="space-y-3 p-3">
              {messages.map((message) => (
                <div key={message.id} className="border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="label !text-[8px]">{message.role === "user" ? "You" : "W1 analyst"}</span>
                    {message.mode === "fallback" ? <span className="label !text-[8px] !text-muted">rule-based</span> : null}
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {message.text.split("\n").filter(Boolean).map((line, index) => (
                      <p
                        key={index}
                        className={`text-[11px] leading-relaxed ${message.role === "user" ? "text-ink" : "text-foreground"}`}
                      >
                        {line.replace(/^-\s*/, "")}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
              {thinking ? <p className="label animate-pulse !text-ink">Analyst is reading the filings and tape…</p> : null}
              <div ref={chatEndRef} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-2">
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void ask(question);
              }}
              placeholder={`Ask about ${ticker}`}
              aria-label="Analyst question"
              className="h-9 min-w-0 flex-1 border border-border bg-transparent px-2 text-[11px] text-ink outline-none focus:border-ink"
            />
            <button
              type="button"
              onClick={() => void ask(question)}
              disabled={thinking || !question.trim()}
              className="label border border-border px-3 py-2 !text-ink transition-colors hover:border-ink disabled:opacity-40"
            >
              Ask
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
