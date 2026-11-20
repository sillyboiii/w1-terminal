"use client";

import { useEffect, useState } from "react";
import { AnimatedNumber } from "../AnimatedNumber";
import { formatMoney, formatPct, formatPrice } from "@/lib/format";
import type { PortfolioData } from "@/lib/types";

const SITE = "https://w1-investments.vercel.app";

export function HoldingsPane() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      fetch("/api/portfolio", { cache: "no-store" })
        .then((response) => response.json() as Promise<PortfolioData>)
        .then(setData)
        .catch(() => undefined)
        .finally(() => setLoading(false));
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="space-y-3 p-3">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-8 animate-pulse bg-border/25" />
        ))}
      </div>
    );
  }

  if (!data?.ok || data.positions.length === 0) {
    return (
      <div className="p-4">
        <p className="font-serif text-lg text-ink">No open positions</p>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          The paper portfolio has no active holdings, or the Sanity project is not connected.
        </p>
      </div>
    );
  }

  const { totals, positions, settings } = data;
  const stats = [
    { label: "NAV", value: formatMoney(totals.totalValue) },
    { label: "Return", value: formatPct(totals.totalReturnPct) },
    { label: "Cash", value: formatMoney(totals.cash) },
    { label: "Day", value: formatPct(totals.dayChangePct) },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid shrink-0 grid-cols-4 gap-2 border-b border-border px-3 py-2">
        {stats.map((stat) => (
          <div key={stat.label}>
            <p className="label !text-[8px]">{stat.label}</p>
            <p className="num mt-1 text-[11px] text-ink">{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="flex shrink-0 items-center justify-between px-3 py-1.5">
        <span className="font-serif text-sm italic text-ink">{settings?.name ?? "W1 Portfolio"}</span>
        <span className="num text-[9px] text-muted">{positions.length} positions</span>
      </div>
      <div className="pane-scroll min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[520px] border-collapse">
          <thead className="sticky top-0 bg-background">
            <tr className="border-y border-border">
              {["Ticker", "Shares", "Last", "Day", "Weight", "Unreal."].map((header) => (
                <th key={header} className="label px-2 py-1.5 text-right font-normal first:text-left last:pr-3">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => {
              const href = position.researchSlug ? `${SITE}/research/${position.researchSlug}` : null;
              return (
                <tr key={position.id} className="border-b border-border/50 hover:bg-border/20">
                  <td className="px-2 py-1.5">
                    {href ? (
                      <a href={href} target="_blank" rel="noreferrer" className="num text-[11px] font-semibold text-ink underline decoration-border underline-offset-2 hover:decoration-ink">
                        {position.ticker}
                      </a>
                    ) : (
                      <span className="num text-[11px] font-semibold text-ink">{position.ticker}</span>
                    )}
                  </td>
                  <td className="num px-2 py-1.5 text-right text-[10px] text-foreground">{position.shares.toLocaleString()}</td>
                  <td className="px-2 py-1.5 text-right">
                    <AnimatedNumber value={position.price} format={(v) => formatPrice(v)} className="justify-end text-[10px] text-ink" />
                  </td>
                  <td className={`num px-2 py-1.5 text-right text-[10px] ${position.dayChangePct === null ? "text-muted" : position.dayChangePct >= 0 ? "text-up" : "text-down"}`}>
                    {formatPct(position.dayChangePct)}
                  </td>
                  <td className="num px-2 py-1.5 text-right text-[10px] text-foreground">{position.weight.toFixed(1)}%</td>
                  <td className={`num px-2 py-1.5 pr-3 text-right text-[10px] ${position.unrealizedPct === null ? "text-muted" : position.unrealizedPct >= 0 ? "text-up" : "text-down"}`}>
                    {formatPct(position.unrealizedPct)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex h-6 shrink-0 items-center justify-between border-t border-border px-3">
        <span className="label !text-[8px]">Paper portfolio · not investment advice</span>
        <span className="num text-[9px] text-muted">15m delayed</span>
      </div>
    </div>
  );
}
