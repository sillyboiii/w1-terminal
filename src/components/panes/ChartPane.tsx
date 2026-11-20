"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import { AnimatedNumber } from "../AnimatedNumber";
import { formatPct, formatPrice } from "@/lib/format";
import type { Candle, ChartData } from "@/lib/types";

const RANGES = ["1d", "5d", "1mo", "3mo", "1y", "5y", "max"];
const RANGE_LABELS: Record<string, string> = {
  "1d": "1D", "5d": "5D", "1mo": "1M", "3mo": "3M", "1y": "1Y", "5y": "5Y", max: "MAX",
};
const DEFAULT_INTERVAL: Record<string, string> = {
  "1d": "1m", "5d": "15m", "1mo": "1h", "3mo": "1d", "1y": "1d", "5y": "1d", max: "1d",
};
const INTERVALS = ["1m", "5m", "15m", "1h", "1d"];

interface Props {
  symbol: string;
}

export function ChartPane({ symbol }: Props) {
  const [range, setRange] = useState("1d");
  const [interval, setInterval] = useState("1m");
  const [chartState, setChartState] = useState<{ data: ChartData | null; loading: boolean; error: boolean }>({
    data: null,
    loading: true,
    error: false,
  });
  const [hover, setHover] = useState<Candle | null>(null);
  const [ready, setReady] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const data = chartState.data;
  const loading = chartState.loading;
  const error = chartState.error;

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const candleMapRef = useRef<Map<number, Candle>>(new Map());

  useEffect(() => {
    let disposed = false;
    let chart: IChartApi | null = null;
    const cleanupRef: { observer: ResizeObserver | null } = { observer: null };

    (async () => {
      const { createChart, ColorType, CrosshairMode, LineStyle } = await import("lightweight-charts");
      const element = containerRef.current;
      if (disposed || !element) return;

      chart = createChart(element, {
        width: element.clientWidth,
        height: element.clientHeight,
        layout: {
          background: { type: ColorType.Solid, color: "#fbf6ec" },
          textColor: "#6b6b6b",
          fontFamily: "monospace",
          fontSize: 10,
        },
        grid: {
          vertLines: { color: "#e8dfd2", style: LineStyle.Dotted },
          horzLines: { color: "#e8dfd2", style: LineStyle.Dotted },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: "#94a3b8", labelBackgroundColor: "#0f0f0f" },
          horzLine: { color: "#94a3b8", labelBackgroundColor: "#0f0f0f" },
        },
        rightPriceScale: { borderColor: "#e8dfd2", scaleMargins: { top: 0.1, bottom: 0.24 } },
        timeScale: { borderColor: "#e8dfd2", timeVisible: true, secondsVisible: false, rightOffset: 3 },
        localization: { priceFormatter: (price: number) => price.toFixed(2) },
      });

      const candles = chart.addCandlestickSeries({
        upColor: "#fbf6ec",
        downColor: "#9b3535",
        borderUpColor: "#1d6b4f",
        borderDownColor: "#9b3535",
        wickUpColor: "#1d6b4f",
        wickDownColor: "#9b3535",
        priceLineColor: "#0f0f0f",
        priceLineStyle: LineStyle.Dotted,
      });
      const volume = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "" });
      volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

      chart.subscribeCrosshairMove((param) => {
        if (!param.time || !param.point) {
          setHover(null);
          return;
        }
        setHover(candleMapRef.current.get(param.time as number) ?? null);
      });

      cleanupRef.observer = new ResizeObserver(() => {
        if (!chart || !containerRef.current) return;
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      });
      cleanupRef.observer.observe(element);

      chartRef.current = chart;
      candleRef.current = candles;
      volumeRef.current = volume;
      setReady(true);
    })();

    return () => {
      disposed = true;
      cleanupRef.observer?.disconnect();
      setReady(false);
      chart?.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/chart?symbol=${encodeURIComponent(symbol)}&range=${range}&interval=${interval}`, {
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json() as Promise<{ chart: ChartData }>;
      })
      .then((payload) => {
        if (!cancelled) setChartState({ data: payload.chart, loading: false, error: false });
      })
      .catch(() => {
        if (!cancelled) setChartState({ data: null, loading: false, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, range, interval, reloadKey]);

  useEffect(() => {
    if (!data || !ready || !candleRef.current || !volumeRef.current) return;
    candleMapRef.current = new Map(data.candles.map((candle) => [candle.time, candle]));
    setHover(null);
    const candleSeries = candleRef.current;
    const volumeSeries = volumeRef.current;
    candleSeries.setData([]);
    volumeSeries.setData([]);

    let index = 0;
    const step = Math.max(1, Math.ceil(data.candles.length / 45));
    const timer = window.setInterval(() => {
      const slice = data.candles.slice(0, index + step);
      candleSeries.setData(
        slice.map((candle) => ({
          time: candle.time as UTCTimestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        })),
      );
      volumeSeries.setData(
        slice.map((candle) => ({
          time: candle.time as UTCTimestamp,
          value: candle.volume,
          color: candle.close >= candle.open ? "rgba(29,107,79,0.16)" : "rgba(155,53,53,0.16)",
        })),
      );
      index += step;
      if (index >= data.candles.length) {
        window.clearInterval(timer);
        chartRef.current?.timeScale().fitContent();
      }
    }, 16);
    return () => window.clearInterval(timer);
  }, [data, ready]);

  const shown = hover ?? (data?.candles[data.candles.length - 1] ?? null);
  const change = data?.changePercent ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="num text-sm font-semibold tracking-tight text-ink">{symbol}</span>
          <span className="hidden truncate text-[11px] text-muted sm:inline">{data?.name ?? "—"}</span>
          <AnimatedNumber value={data?.price ?? null} format={(v) => formatPrice(v)} className="text-sm text-ink" />
          <span className={`num text-[11px] ${change === null ? "text-muted" : change >= 0 ? "text-up" : "text-down"}`}>
            {formatPct(change)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border p-0.5">
            {RANGES.map((item) => (
              <button
                key={item}
                type="button"
                  onClick={() => {
                    setRange(item);
                    setInterval(DEFAULT_INTERVAL[item]);
                    setReloadKey((value) => value + 1);
                    setChartState({ data: null, loading: true, error: false });
                  }}
                className={`num px-1.5 py-0.5 text-[9px] transition-colors ${range === item ? "bg-ink text-background" : "text-muted hover:text-ink"}`}
              >
                {RANGE_LABELS[item]}
              </button>
            ))}
          </div>
          <div className="hidden items-center gap-0.5 md:flex">
            {INTERVALS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setInterval(item);
                  setReloadKey((value) => value + 1);
                  setChartState({ data: null, loading: true, error: false });
                }}
                className={`num px-1 py-0.5 text-[9px] transition-colors ${interval === item ? "text-ink underline underline-offset-2" : "text-muted hover:text-ink"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4 border-b border-border px-3 py-1.5">
        {[
          ["O", shown?.open], ["H", shown?.high], ["L", shown?.low], ["C", shown?.close],
        ].map(([label, value]) => (
          <span key={String(label)} className="num flex items-center gap-1.5 text-[10px]">
            <span className="text-muted">{label}</span>
            <span className="text-ink">{formatPrice(value as number | null)}</span>
          </span>
        ))}
        <span className="num ml-auto hidden text-[10px] text-muted sm:inline">
          VOL {shown ? Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(shown.volume) : "—"}
        </span>
      </div>

      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="absolute inset-0" />
        <AnimatePresence>
          {(loading || error) && (
            <motion.div
              key={error ? "error" : "loading"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/70"
            >
              <span className="label !text-ink">{error ? "Chart unavailable" : "Loading candles"}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex h-6 shrink-0 items-center justify-between border-t border-border px-3">
        <span className="label !text-[8px]">{data?.source ?? "Yahoo Finance"} · {interval}</span>
        <span className="label !text-[8px]">{data?.candles.length ?? 0} bars</span>
      </div>
    </div>
  );
}
