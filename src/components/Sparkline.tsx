"use client";

import { motion } from "framer-motion";

interface Props {
  data: number[] | null | undefined;
  positive?: boolean;
  width?: number;
  height?: number;
  className?: string;
}

export function Sparkline({ data, positive = true, width = 76, height = 22, className = "" }: Props) {
  if (!data || data.length < 2) {
    return <span className={`inline-block ${className}`} style={{ width, height }}>—</span>;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((value, index) => ({
    x: index * stepX,
    y: height - 2 - ((value - min) / span) * (height - 4),
  }));
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const color = positive ? "var(--up)" : "var(--down)";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.25}
        strokeLinejoin="round"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={1.8} fill={color} />
    </svg>
  );
}
