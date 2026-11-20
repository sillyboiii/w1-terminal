"use client";

import { useEffect, useState } from "react";
import { formatShortDate } from "@/lib/format";
import type { ResearchItem } from "@/lib/types";

const SITE = "https://w1-investments.vercel.app";

export function ResearchPane() {
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/research", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ items?: ResearchItem[] }>)
      .then((payload) => setItems(payload.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="label !text-ink">Published research</span>
        <span className="num text-[9px] text-muted">{items.length} notes</span>
      </div>
      <div className="pane-scroll min-h-0 flex-1 overflow-y-auto">
        {items.map((item, index) => (
          <a
            key={item.id}
            href={item.slug ? `${SITE}/research/${item.slug}` : SITE}
            target="_blank"
            rel="noreferrer"
            className="wire-enter group block border-b border-border/60 px-3 py-3 transition-colors hover:bg-border/25"
            style={{ animationDelay: `${Math.min(index * 0.04, 0.4)}s` }}
          >
            <div className="flex items-center gap-2">
              <span className="num text-[9px] text-muted">{formatShortDate(item.publishedAt)}</span>
              <span className="h-2.5 w-px bg-border" />
              <span className="label !text-[8px]">{item.category}</span>
              {item.ticker ? (
                <>
                  <span className="h-2.5 w-px bg-border" />
                  <span className="num text-[9px] text-ink">{item.ticker}</span>
                </>
              ) : null}
            </div>
            <p className="mt-1.5 font-serif text-[15px] leading-tight text-ink group-hover:underline">{item.title}</p>
            {item.abstract ? (
              <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted">{item.abstract}</p>
            ) : null}
            {item.analyst ? <p className="label mt-1.5 !text-[8px]">{item.analyst}</p> : null}
          </a>
        ))}
        {loading && items.length === 0 ? (
          <div className="space-y-3 p-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-12 animate-pulse bg-border/25" />
            ))}
          </div>
        ) : null}
        {!loading && items.length === 0 ? (
          <div className="p-4">
            <p className="text-[11px] text-muted">No research wire available.</p>
            <p className="mt-2 text-[10px] text-muted">Connect the Sanity project to publish notes here.</p>
          </div>
        ) : null}
      </div>
      <div className="flex h-6 shrink-0 items-center border-t border-border px-3">
        <span className="label !text-[8px]">W1 Investments · research desk</span>
      </div>
    </div>
  );
}
