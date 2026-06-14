import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { acceptFriend, friendStoreMode, listFriendLinks, removeFriend, requestFriend } from "@/lib/oraculo-friends";

export const dynamic = "force-dynamic";

function validSteamId(value: unknown): value is string {
  return typeof value === "string" && /^765\d{14}$/.test(value);
}

async function viewerSteamId() {
  const cookieStore = await cookies();
  return cookieStore.get("oraculo_steam_id")?.value || null;
}

export async function GET() {
  const viewer = await viewerSteamId();
  if (!validSteamId(viewer)) {
    return NextResponse.json({ ok: false, error: "Steam no conectado", friends: [], store: friendStoreMode() }, { status: 401 });
  }

  return NextResponse.json({ ok: true, friends: await listFriendLinks(viewer), store: friendStoreMode() });
}

export async function POST(request: NextRequest) {
  const viewer = await viewerSteamId();
  if (!validSteamId(viewer)) {
    return NextResponse.json({ ok: false, error: "Steam no conectado", friends: [], store: friendStoreMode() }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const steamId = typeof body.steamId === "string" ? body.steamId.trim() : "";
  const action = typeof body.action === "string" ? body.action : "request";

  if (!validSteamId(steamId)) {
    return NextResponse.json({ ok: false, error: "SteamID64 invalido", friends: await listFriendLinks(viewer), store: friendStoreMode() }, { status: 400 });
  }

  if (action === "accept") {
    return NextResponse.json({ ok: true, friends: await acceptFriend(viewer, steamId), store: friendStoreMode() });
  }

  if (action === "remove") {
    return NextResponse.json({ ok: true, friends: await removeFriend(viewer, steamId), store: friendStoreMode() });
  }

  return NextResponse.json({ ok: true, friends: await requestFriend(viewer, steamId), store: friendStoreMode() });
}
