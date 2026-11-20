"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface Props {
  value: number | null | undefined;
  format?: (value: number | null | undefined) => string;
  className?: string;
  flash?: boolean;
}

export function AnimatedNumber({
  value,
  format = (v) => (v === null || v === undefined ? "—" : String(v)),
  className = "",
  flash = true,
}: Props) {
  const text = format(value);
  const previous = useRef(value);
  const [flashKey, setFlashKey] = useState(0);

  useEffect(() => {
    if (previous.current !== value) {
      previous.current = value;
      setFlashKey((key) => key + 1);
    }
  }, [value]);

  return (
    <span className={`num relative inline-flex items-center overflow-hidden ${className}`} style={{ height: "1.15em", lineHeight: "1.15em" }}>
      {text.split("").map((char, index) => (
        <span
          key={index}
          className="relative inline-block overflow-hidden"
          style={{ height: "1.15em", lineHeight: "1.15em", width: "0.62em" }}
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={char}
              initial={{ y: "92%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-92%", opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="block"
            >
              {char === " " ? "\u00a0" : char}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
      {flash ? (
        <AnimatePresence>
          {flashKey > 0 ? (
            <motion.span
              key={flashKey}
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-ink"
              initial={{ opacity: 0.13 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
            />
          ) : null}
        </AnimatePresence>
      ) : null}
    </span>
  );
}
