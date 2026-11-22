"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import type { PaneConfig } from "@/lib/types";

const META: Record<PaneConfig["kind"], { code: string; title: string }> = {
  chart: { code: "CHART", title: "Price Chart" },
  news: { code: "NEWS", title: "Live News Wire" },
  watchlist: { code: "WEI", title: "Watchlist" },
  research: { code: "WIRE", title: "W1 Research" },
  analyst: { code: "ANALYST", title: "Analyst Desk" },
  holdings: { code: "HP", title: "Portfolio Holdings" },
  help: { code: "HELP", title: "Command Reference" },
};

interface Props {
  config: PaneConfig;
  maximized: boolean;
  active?: boolean;
  onActivate?: () => void;
  onMaximize: (id: string) => void;
  onClose: (id: string) => void;
  children: ReactNode;
  style?: React.CSSProperties;
}

export function Pane({ config, maximized, active = false, onActivate, onMaximize, onClose, children, style }: Props) {
  const meta = META[config.kind];
  const code = config.kind === "chart" && config.symbol ? config.symbol : meta.code;

  return (
    <motion.section
      layout
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.985 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      style={style}
      data-pane
      onMouseDown={() => onActivate?.()}
      className={`relative flex min-h-0 min-w-0 flex-col overflow-hidden border bg-background transition-colors ${
        active ? "border-ink/40" : "border-border"
      }`}
    >
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="num text-sm text-muted">/</span>
          <span className="num shrink-0 font-semibold text-ink">{code}</span>
          <span className="truncate font-serif text-base italic text-foreground/80">{meta.title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {config.kind === "chart" && config.symbol ? (
            <span className="label mr-1 !text-ink">{config.symbol}</span>
          ) : null}
          <button
            type="button"
            onClick={() => onMaximize(config.id)}
            className="num flex h-7 w-7 items-center justify-center text-xs text-muted transition-colors hover:bg-border/40 hover:text-ink"
            title={maximized ? "Restore pane" : "Maximise pane"}
            aria-label={maximized ? "Restore pane" : "Maximise pane"}
          >
            {maximized ? "▤" : "▢"}
          </button>
          <button
            type="button"
            onClick={() => onClose(config.id)}
            className="num flex h-7 w-7 items-center justify-center text-sm text-muted transition-colors hover:bg-border/40 hover:text-ink"
            title="Close pane"
            aria-label="Close pane"
          >
            ×
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </motion.section>
  );
}
