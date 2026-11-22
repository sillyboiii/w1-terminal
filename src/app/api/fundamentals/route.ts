import { NextResponse } from "next/server";
import { fetchFundamentals } from "@/lib/fundamentals";
import { validSymbol } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const symbol = (new URL(request.url).searchParams.get("symbol") ?? "").trim().toUpperCase();
  if (!validSymbol(symbol)) {
    return NextResponse.json({ error: "invalid symbol" }, { status: 400 });
  }
  const fundamentals = await fetchFundamentals(symbol);
  if (!fundamentals) {
    return NextResponse.json({ error: "financials unavailable" }, { status: 502 });
  }
  return NextResponse.json({ fundamentals });
}
