import { NextResponse } from "next/server";
import { fetchQuote, fetchQuotes } from "@/lib/yahoo";
import { validSymbol } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const single = params.get("symbol");
  const list = params.get("symbols");

  if (single) {
    if (!validSymbol(single)) {
      return NextResponse.json({ error: "invalid symbol" }, { status: 400 });
    }
    const quote = await fetchQuote(single);
    if (!quote) return NextResponse.json({ error: "quote unavailable" }, { status: 502 });
    return NextResponse.json({ quote });
  }

  const symbols = (list ?? "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => symbol && validSymbol(symbol))
    .slice(0, 40);

  if (symbols.length === 0) {
    return NextResponse.json({ error: "no symbols" }, { status: 400 });
  }

  const quotes = await fetchQuotes(symbols);
  return NextResponse.json({ quotes });
}
