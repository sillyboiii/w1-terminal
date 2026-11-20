import { NextResponse } from "next/server";
import { fetchNews } from "@/lib/news";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get("q") ?? "markets").slice(0, 60);
  const items = await fetchNews(query);
  return NextResponse.json({ items, query });
}
