"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { CommandBar } from "./CommandBar";
import { Pane } from "./Pane";
import { StatusBar } from "./StatusBar";
import { TickerTape } from "./TickerTape";
import { AnalystPane } from "./panes/AnalystPane";
import { ChartPane } from "./panes/ChartPane";
import { HelpPane } from "./panes/HelpPane";
import { HoldingsPane } from "./panes/HoldingsPane";
import { NewsPane } from "./panes/NewsPane";
import { ResearchPane } from "./panes/ResearchPane";
import { WatchlistPane } from "./panes/WatchlistPane";
import { FUNCTION_KEYS } from "@/lib/commands";
import { validSymbol, type PaneConfig, type PaneKind } from "@/lib/types";

const DEFAULT_PANES: PaneConfig[] = [
  { id: "chart-AAPL", kind: "chart", symbol: "AAPL" },
  { id: "news", kind: "news" },
  { id: "watchlist", kind: "watchlist" },
];

type GridVars = React.CSSProperties & { "--col"?: string; "--row"?: string };

export function Terminal() {
  const [panes, setPanes] = useState<PaneConfig[]>(DEFAULT_PANES);
  const [activeId, setActiveId] = useState(DEFAULT_PANES[0].id);
  const [maximizedId, setMaximizedId] = useState<string | null>(null);

  const openChart = useCallback((symbol: string) => {
    if (!validSymbol(symbol)) return;
    const ticker = symbol.toUpperCase();
    const id = `chart-${ticker}`;
    setPanes((current) => {
      const index = current.findIndex((pane) => pane.kind === "chart");
      if (index === -1) return [{ id, kind: "chart", symbol: ticker }, ...current];
      const next = [...current];
      next[index] = { id, kind: "chart", symbol: ticker };
      return next;
    });
    setActiveId(id);
  }, []);

  const openPane = useCallback((kind: PaneKind) => {
    const existing = panes.find((pane) => pane.kind === kind);
    if (existing) {
      setActiveId(existing.id);
      return;
    }
    const id = `${kind}-${Date.now()}`;
    setPanes((current) => [...current, { id, kind }]);
    setActiveId(id);
  }, [panes]);

  const openAnalyst = useCallback((symbol: string) => {
    const ticker = validSymbol(symbol) ? symbol.toUpperCase() : "AAPL";
    const id = `analyst-${ticker}`;
    setPanes((current) => {
      const existing = current.find((pane) => pane.kind === "analyst");
      if (!existing) return [...current, { id, kind: "analyst", symbol: ticker }];
      return current.map((pane) => (pane.kind === "analyst" ? { id, kind: "analyst", symbol: ticker } : pane));
    });
    setActiveId(id);
    setMaximizedId((current) => (current && panes.some((pane) => pane.kind === "analyst") ? id : current));
  }, [panes]);

  const closePane = useCallback((id: string) => {
    setPanes((current) => {
      const next = current.filter((pane) => pane.id !== id);
      if (next.length === 0) return DEFAULT_PANES;
      return next;
    });
    setActiveId((current) => (current === id ? panes.find((pane) => pane.id !== id)?.id ?? DEFAULT_PANES[0].id : current));
    setMaximizedId((current) => (current === id ? null : current));
  }, [panes]);

  const toggleMaximize = useCallback((id: string) => {
    setMaximizedId((current) => (current === id ? null : id));
    setActiveId(id);
  }, []);

  const handleCommand = useCallback((raw: string) => {
    const cleaned = raw.trim().toUpperCase().replace(/<GO>/g, "").replace(/\s+/g, " ").trim();
    const code = cleaned.split(" ")[0];
    if (!code) return;

    if (code === "DESK") {
      setPanes(DEFAULT_PANES);
      setActiveId(DEFAULT_PANES[0].id);
      setMaximizedId(null);
      return;
    }
    if (code === "MAX") {
      toggleMaximize(activeId);
      return;
    }
    if (code === "NEWS" || code === "WIRE") {
      openPane(code === "NEWS" ? "news" : "research");
      return;
    }
    if (code === "ANALYST" || code === "RES") {
      openAnalyst(cleaned.split(" ")[1] ?? "AAPL");
      return;
    }
    if (code === "WEI") {
      openPane("watchlist");
      return;
    }
    if (code === "GP" || code === "HP") {
      openPane("holdings");
      return;
    }
    if (code === "HELP") {
      openPane("help");
      return;
    }
    if (validSymbol(code)) openChart(code);
  }, [activeId, openAnalyst, openChart, openPane, toggleMaximize]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (event.key === "/" && !typing) {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('input[aria-label="Terminal command"]')?.focus();
        return;
      }
      if (event.key === "Escape" && maximizedId) {
        setMaximizedId(null);
        return;
      }
      const command = FUNCTION_KEYS[event.key];
      if (command && !typing) {
        event.preventDefault();
        handleCommand(command);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleCommand, maximizedId]);

  const visible = maximizedId ? panes.filter((pane) => pane.id === maximizedId) : panes;
  const rows = Math.max(2, visible.length - 1);

  const gridVars = (index: number): GridVars => {
    if (maximizedId || visible.length === 1) return { "--col": "1 / -1", "--row": "1 / -1" };
    if (visible.length === 2) {
      return index === 0
        ? { "--col": "1 / 8", "--row": "1 / -1" }
        : { "--col": "8 / -1", "--row": "1 / -1" };
    }
    return index === 0
      ? { "--col": "1 / 8", "--row": "1 / -1" }
      : { "--col": "8 / -1", "--row": String(index) };
  };

  const renderPane = (pane: PaneConfig) => {
    switch (pane.kind) {
      case "chart":
        return <ChartPane key={pane.symbol ?? "AAPL"} symbol={pane.symbol ?? "AAPL"} />;
      case "news":
        return <NewsPane />;
      case "watchlist":
        return <WatchlistPane onSelect={openChart} />;
      case "research":
        return <ResearchPane />;
      case "analyst":
        return <AnalystPane symbol={pane.symbol ?? "AAPL"} />;
      case "holdings":
        return <HoldingsPane />;
      case "help":
        return <HelpPane onCommand={handleCommand} />;
    }
  };

  return (
    <main className="relative flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <div className="grid-backdrop" />
      <div className="scanline" />
      <StatusBar />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col p-1.5 md:p-2">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            layout
            key={maximizedId ?? "desk"}
            className="terminal-grid min-h-0 flex-1"
            style={{ "--rows": rows } as GridVars}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {visible.map((pane, index) => (
                <Pane
                  key={pane.id}
                  config={pane}
                  style={gridVars(index)}
                  maximized={maximizedId === pane.id}
                  active={activeId === pane.id}
                  onActivate={() => setActiveId(pane.id)}
                  onMaximize={toggleMaximize}
                  onClose={closePane}
                >
                  {renderPane(pane)}
                </Pane>
              ))}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>

      <TickerTape />
      <CommandBar onCommand={handleCommand} />
      <span className="sr-only" aria-live="polite">
        {visible.length} panes open. Active pane: {panes.find((pane) => pane.id === activeId)?.kind ?? "none"}.
      </span>
    </main>
  );
}
