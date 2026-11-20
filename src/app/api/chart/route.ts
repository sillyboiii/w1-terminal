import { NextResponse } from "next/server";
import { fetchChart } from "@/lib/yahoo";
import { validSymbol } from "@/lib/types";

export const dynamic = "force-dynamic";

const RANGES = ["1d", "5d", "1mo", "3mo", "6mo", "1y", "5y", "max"];
const INTERVALS = ["1m", "2m", "5m", "15m", "30m", "60m", "1h", "1d", "1wk", "1mo"];

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const symbol = (params.get("symbol") ?? "").trim().toUpperCase();
  const range = params.get("range") ?? "1d";
  const interval = params.get("interval") ?? "1m";

  if (!validSymbol(symbol)) {
    return NextResponse.json({ error: "invalid symbol" }, { status: 400 });
  }
  if (!RANGES.includes(range) || !INTERVALS.includes(interval)) {
    return NextResponse.json({ error: "invalid range or interval" }, { status: 400 });
  }

  const chart = await fetchChart({ symbol, range, interval });
  if (!chart) return NextResponse.json({ error: "chart unavailable" }, { status: 502 });
  return NextResponse.json({ chart });
}
