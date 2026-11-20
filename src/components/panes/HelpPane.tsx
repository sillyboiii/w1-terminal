"use client";

import { COMMAND_SPECS } from "@/lib/commands";

interface Props {
  onCommand: (command: string) => void;
}

export function HelpPane({ onCommand }: Props) {
  return (
    <div className="pane-scroll h-full overflow-y-auto px-4 py-5">
      <p className="label !text-ink">W1 / Terminal</p>
      <h2 className="serif mt-2 text-3xl leading-none tracking-tight text-ink">Command reference</h2>
      <p className="mt-3 max-w-lg text-[11px] leading-relaxed text-muted">
        Type a command or any ticker into the command line and press Go. The{" "}
        <span className="num text-ink">&lt;GO&gt;</span> suffix is optional. Function keys run the most common functions.
      </p>

      <div className="mt-6 border-t border-border">
        {COMMAND_SPECS.map((spec) => (
          <button
            key={spec.code}
            type="button"
            onClick={() => onCommand(`${spec.code} <GO>`)}
            className="group grid w-full grid-cols-[90px_1fr_40px] items-baseline gap-3 border-b border-border/60 py-2.5 text-left transition-colors hover:bg-border/20"
          >
            <span className="num text-[11px] font-semibold text-ink">{spec.code}</span>
            <span className="min-w-0">
              <span className="block text-[11px] text-foreground">{spec.title}</span>
              <span className="mt-0.5 block text-[10px] text-muted">{spec.description}</span>
            </span>
            <span className="num text-right text-[9px] text-muted">{spec.key ?? "—"}</span>
          </button>
        ))}
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="label !text-ink">Data</p>
          <p className="mt-2 text-[10px] leading-relaxed text-muted">
            Charts and quotes from Yahoo Finance with a Spark fallback when OHLC is rate-limited, delayed by up to 15
            minutes. Headlines from Yahoo Finance with a Google News fallback. The wire reads published W1 research
            from Sanity.
          </p>
        </div>
        <div>
          <p className="label !text-ink">Typography</p>
          <p className="mt-2 text-[10px] leading-relaxed text-muted">
            Cormorant Garamond for the editorial voice, Inter for interface text, Geist Mono for every number. Ink on
            paper, hairline rules, no accent colour.
          </p>
        </div>
      </div>

      <p className="mt-8 label !text-[8px]">
        W1 Investments · student-led · educational and research purposes only
      </p>
    </div>
  );
}
