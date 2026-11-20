"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { formatWireTime } from "@/lib/format";
import type { NewsItem } from "@/lib/types";

export function NewsPane() {
  const [query, setQuery] = useState("markets");
  const [draft, setDraft] = useState("markets");
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback((q: string) => {
    fetch(`/api/news?q=${encodeURIComponent(q)}`, { cache: "no-store" })
      .then((response) => response.json() as Promise<{ items?: NewsItem[] }>)
      .then((payload) => setItems(payload.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(query);
    const timer = setInterval(() => load(query), 30_000);
    return () => clearInterval(timer);
  }, [query, load]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-2.5">
        <span className="label !text-ink">Query</span>
        <form
          className="flex flex-1 items-center"
          onSubmit={(event) => {
            event.preventDefault();
            const next = draft.trim() || "markets";
            setLoading(true);
            setQuery(next);
            setDraft(next);
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="num w-full min-w-0 bg-transparent text-[11px] uppercase text-ink outline-none"
            aria-label="News query"
          />
          <button type="submit" className="label !text-[9px] hover:!text-ink">Go</button>
        </form>
        <span className="label !text-[8px] !text-ink">Live</span>
      </div>

      <div className="pane-scroll min-h-0 flex-1 overflow-y-auto">
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((item, index) => (
            <motion.a
              key={item.id}
              layout
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.42, delay: Math.min(index * 0.025, 0.3), ease: [0.16, 1, 0.3, 1] }}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="group flex gap-3 border-b border-border/60 px-3 py-2.5 transition-colors hover:bg-border/25"
            >
              <span className="num mt-0.5 shrink-0 text-[10px] text-muted">{formatWireTime(item.publishedAt)}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] leading-snug text-ink group-hover:underline">{item.title}</span>
                <span className="mt-1 flex items-center gap-2">
                  <span className="label !text-[8px] !tracking-[0.18em]">{item.publisher}</span>
                  {item.tickers.slice(0, 3).map((ticker) => (
                    <span key={ticker} className="num text-[9px] text-muted">{ticker}</span>
                  ))}
                </span>
              </span>
            </motion.a>
          ))}
        </AnimatePresence>
        {loading && items.length === 0 ? (
          <div className="space-y-3 p-3">
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="space-y-2">
                <div className="h-3 w-full animate-pulse bg-border/40" />
                <div className="h-2 w-1/3 animate-pulse bg-border/30" />
              </div>
            ))}
          </div>
        ) : null}
        {!loading && items.length === 0 ? (
          <p className="p-4 text-[11px] text-muted">Headlines unavailable for this query.</p>
        ) : null}
      </div>

      <div className="flex h-6 shrink-0 items-center justify-between border-t border-border px-3">
        <span className="label !text-[8px]">7 live sources</span>
        <span className="num text-[9px] text-muted">{items.length} stories</span>
      </div>
    </div>
  );
}
