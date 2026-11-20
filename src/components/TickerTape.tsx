"use client";

import { useEffect, useState } from "react";
import { AnimatedNumber } from "./AnimatedNumber";
import { formatPct, formatPrice } from "@/lib/format";
import { WATCHLIST, type Quote } from "@/lib/types";

export function TickerTape() {
  const [quotes, setQuotes] = useState<Quote[]>([]);

  useEffect(() => {
    const load = () => {
      fetch(`/api/quote?symbols=${WATCHLIST.join(",")}`, { cache: "no-store" })
        .then((response) => response.json() as Promise<{ quotes?: Quote[] }>)
        .then((data) => setQuotes(data.quotes ?? []))
        .catch(() => undefined);
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, []);

  if (quotes.length === 0) return <div className="h-9 shrink-0 border-t border-border bg-background/80" />;

  return (
    <div className="relative z-10 flex h-9 shrink-0 items-center overflow-hidden border-t border-border bg-background/85">
      <div className="label z-10 flex h-full shrink-0 items-center border-r border-border bg-background px-3 !text-ink">
        Tape
      </div>
      <div className="relative flex-1 overflow-hidden">
        <div className="ticker-scroll flex w-max items-center">
          {[...quotes, ...quotes].map((quote, index) => {
            const change = quote.changePercent;
            const tone = change === null ? "text-muted" : change >= 0 ? "text-up" : "text-down";
            return (
              <div key={`${quote.symbol}-${index}`} className="flex shrink-0 items-center gap-2 px-4 text-[11px]">
                <span className="num font-medium text-ink">{quote.symbol}</span>
                <span className="hidden text-muted lg:inline">{quote.name}</span>
                <AnimatedNumber value={quote.price} format={(v) => formatPrice(v)} className="text-[11px] text-ink" />
                <span className={`num ${tone}`}>{formatPct(change)}</span>
                <span className="ml-2 h-3 w-px bg-border" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
