import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOraculoSnapshot } from "@/lib/oraculo-bridge";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const steamId = cookieStore.get("oraculo_steam_id")?.value || null;
  const friendIds = (request.nextUrl.searchParams.get("friends") || "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^765\d{14}$/.test(id))
    .slice(0, 20);
  const snapshot = await getOraculoSnapshot(steamId, friendIds);
  return NextResponse.json({
    ...snapshot,
    generatedAt: new Date().toISOString(),
  });
}
