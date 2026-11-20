import { NextResponse } from "next/server";
import { fetchPortfolio } from "@/lib/sanity";
import type { PortfolioData } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await fetchPortfolio();
  if (!data) {
    return NextResponse.json({
      ok: false,
      settings: null,
      positions: [],
      totals: {
        totalValue: 0,
        cash: 0,
        deployed: 0,
        openMarketValue: 0,
        unrealizedTotal: 0,
        totalReturnPct: 0,
        dayChangePct: null,
      },
      updatedAt: new Date().toISOString(),
    } satisfies PortfolioData);
  }
  return NextResponse.json(data);
}
