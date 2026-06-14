import { NextRequest, NextResponse } from "next/server";
import { getOraculoSnapshot } from "@/lib/oraculo-bridge";
import { initialSnapshot } from "@/lib/oraculo-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LIVE_TIMEOUT_MS = Number(process.env.ORACULO_LIVE_FAST_TIMEOUT_MS || 1800);

let lastGoodSnapshot = initialSnapshot;
let lastGoodAt = 0;

function responseJson(data: unknown) {
  const response = NextResponse.json(data);
  response.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("X-Oraculo-Live-Timeout-Ms", String(LIVE_TIMEOUT_MS));
  return response;
}

function friendsFrom(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("friends") || "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => /^765\d{14}$/.test(value));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });

  return Promise.race([
    promise.catch(() => null),
    timeout,
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function staleSnapshot(reason: string) {
  return {
    ...lastGoodSnapshot,
    generatedAt: new Date().toISOString(),
    stale: true,
    staleReason: reason,
    lastGoodAt: lastGoodAt ? new Date(lastGoodAt).toISOString() : null,
    mapPlayers: [],
    friends: [],
  };
}

export async function GET(request: NextRequest) {
  const steamId = request.cookies.get("oraculo_steam_id")?.value || null;
  const friends = friendsFrom(request);

  const snapshot = await withTimeout(
    getOraculoSnapshot(steamId, friends),
    LIVE_TIMEOUT_MS
  );

  if (snapshot) {
    lastGoodSnapshot = snapshot;
    lastGoodAt = Date.now();
    return responseJson(snapshot);
  }

  return responseJson(staleSnapshot("live_timeout"));
}
