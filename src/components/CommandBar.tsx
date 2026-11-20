"use client";

import { useRef, useState } from "react";
import { FUNCTION_KEYS } from "@/lib/commands";

interface Props {
  onCommand: (command: string) => void;
}

export function CommandBar({ onCommand }: Props) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const command = value.trim();
    if (!command) return;
    setHistory((items) => [command, ...items].slice(0, 30));
    setCursor(-1);
    setValue("");
    onCommand(command);
  };

  return (
    <div className="relative z-20 shrink-0">
      <div className="flex h-12 items-center gap-2 border-t border-border bg-background px-3 md:px-4">
        <span className="num text-lg leading-none text-ink">&gt;</span>
        <div className="relative flex h-full flex-1 items-center">
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => {
              setValue(event.target.value.toUpperCase());
              setCursor(-1);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                const next = Math.min(cursor + 1, history.length - 1);
                if (next >= 0) {
                  setCursor(next);
                  setValue(history[next]);
                }
              } else if (event.key === "ArrowDown") {
                event.preventDefault();
                const next = cursor - 1;
                setCursor(next);
                setValue(next >= 0 ? history[next] : "");
              } else if (event.key === "Escape") {
                setValue("");
                setCursor(-1);
                inputRef.current?.blur();
              }
            }}
            placeholder="TYPE A TICKER OR COMMAND  ·  TRY AAPL <GO> OR HELP <GO>"
            className="num h-full w-full bg-transparent text-[13px] uppercase tracking-tight text-ink outline-none placeholder:!text-muted/60 caret-transparent"
            aria-label="Terminal command"
            autoComplete="off"
            spellCheck={false}
          />
          {focused ? (
            <span
              aria-hidden
              className="cursor-blink pointer-events-none absolute top-1/2 h-[1em] w-[0.6em] -translate-y-1/2 bg-ink/80"
              style={{ left: `${value.length}ch` }}
            />
          ) : null}
        </div>
        <button
          type="button"
          onClick={submit}
          className="label shrink-0 border border-border px-3 py-2 !text-ink transition-colors hover:border-ink"
        >
          Go ↵
        </button>
      </div>
      <div className="pane-scroll flex h-8 items-center gap-1 overflow-x-auto border-t border-border bg-background px-3 md:px-4">
        {Object.entries(FUNCTION_KEYS).map(([key, command]) => (
          <button
            key={key}
            type="button"
            onClick={() => onCommand(command)}
            className="group flex shrink-0 items-center gap-1.5 px-2 py-1 transition-colors hover:bg-border/40"
          >
            <span className="num text-[10px] text-ink">{key}</span>
            <span className="label !text-[9px] group-hover:!text-ink">{command.split(" ")[0]}</span>
          </button>
        ))}
        <span className="ml-auto hidden shrink-0 label !text-[9px] md:block">Press / to focus</span>
      </div>
    </div>
  );
}
