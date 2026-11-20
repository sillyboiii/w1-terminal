"use client";

import { useEffect, useState } from "react";
import { AnimatedNumber } from "../AnimatedNumber";
import { Sparkline } from "../Sparkline";
import { formatPct, formatPrice } from "@/lib/format";
import { WATCHLIST, type Quote } from "@/lib/types";

interface Props {
  onSelect: (symbol: string) => void;
}

export function WatchlistPane({ onSelect }: Props) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      fetch(`/api/quote?symbols=${WATCHLIST.join(",")}`, { cache: "no-store" })
        .then((response) => response.json() as Promise<{ quotes?: Quote[] }>)
        .then((payload) => setQuotes(payload.quotes ?? []))
        .catch(() => undefined)
        .finally(() => setLoading(false));
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid shrink-0 grid-cols-[1fr_70px_66px_76px] gap-2 border-b border-border px-3 py-2">
        <span className="label !text-[8px]">Symbol</span>
        <span className="label !text-[8px] text-right">Last</span>
        <span className="label !text-[8px] text-right">Chg</span>
        <span className="label !text-[8px] text-right">1M</span>
      </div>
      <div className="pane-scroll min-h-0 flex-1 overflow-y-auto">
        {quotes.map((quote) => {
          const change = quote.changePercent;
          const positive = change === null || change >= 0;
          return (
            <button
              key={quote.symbol}
              type="button"
              onClick={() => onSelect(quote.symbol)}
              className="grid w-full grid-cols-[1fr_70px_66px_76px] items-center gap-2 border-b border-border/50 px-3 py-1.5 text-left transition-colors hover:bg-border/25"
            >
              <span className="min-w-0">
                <span className="num block truncate text-[11px] font-semibold text-ink">{quote.symbol}</span>
                <span className="block truncate text-[9px] text-muted">{quote.name}</span>
              </span>
              <AnimatedNumber value={quote.price} format={(v) => formatPrice(v)} className="justify-end text-[11px] text-ink" />
              <span className={`num text-right text-[10px] ${change === null ? "text-muted" : change >= 0 ? "text-up" : "text-down"}`}>
                {formatPct(change)}
              </span>
              <span className="flex justify-end">
                <Sparkline data={quote.spark} positive={positive} width={68} height={18} />
              </span>
            </button>
          );
        })}
        {loading && quotes.length === 0 ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="h-7 animate-pulse bg-border/25" />
            ))}
          </div>
        ) : null}
        {!loading && quotes.length === 0 ? (
          <p className="p-4 text-[11px] text-muted">Quotes unavailable.</p>
        ) : null}
      </div>
      <div className="flex h-6 shrink-0 items-center justify-between border-t border-border px-3">
        <span className="label !text-[8px]">15m delayed · select to open chart</span>
        <span className="num text-[9px] text-muted">{quotes.length} symbols</span>
      </div>
    </div>
  );
}
