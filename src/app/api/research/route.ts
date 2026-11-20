import { NextResponse } from "next/server";
import { fetchResearch } from "@/lib/sanity";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await fetchResearch();
  return NextResponse.json({ items });
}
