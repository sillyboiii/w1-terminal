"use client";

import Image from "next/image";
import { useSyncExternalStore } from "react";
import { formatClock } from "@/lib/format";

const subscribe = (callback: () => void) => {
  const timer = setInterval(callback, 1000);
  return () => clearInterval(timer);
};
const getSnapshot = () => String(Math.floor(Date.now() / 1000));
const getServerSnapshot = () => "server";

export function StatusBar() {
  const tick = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const now = tick === "server" ? null : new Date(Number(tick) * 1000);

  return (
    <header className="relative z-20 flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/90 px-3 backdrop-blur-md md:px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <Image src="/w1-logo.png" alt="W1 Investments" width={24} height={24} className="h-6 w-6 object-contain" />
        <div className="flex items-baseline gap-2">
          <span className="serif text-xl leading-none tracking-tight text-ink">W1</span>
          <span className="text-xs text-border">/</span>
          <span className="label !text-[10px] !tracking-[0.3em] !text-ink">Terminal</span>
        </div>
        <span className="hidden h-3 w-px bg-border md:block" />
        <span className="label hidden md:inline">Equities Desk</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-ink" />
        <span className="label !text-ink">Live</span>
        <span className="hidden text-[10px] text-muted sm:inline">· Yahoo Finance / 15m delay</span>
      </div>

      <div className="flex items-center gap-3 md:gap-5">
        <span className="num hidden text-[11px] text-muted sm:inline">LON {now ? formatClock(now) : "--:--:--"}</span>
        <span className="num text-[11px] text-muted">NYC {now ? formatClock(now, "America/New_York") : "--:--:--"}</span>
        <span className="label hidden md:inline">Desk 01</span>
      </div>
    </header>
  );
}
