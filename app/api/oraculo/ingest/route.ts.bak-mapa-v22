import { NextRequest, NextResponse } from "next/server";
import { playersFromBridgePayload, snapshotFromBridgePayload } from "@/lib/oraculo-bridge";
import { saveSnapshot } from "@/lib/oraculo-store";

export const dynamic = "force-dynamic";

function expectedToken() {
  return process.env.ORACULO_INGEST_TOKEN || process.env.BRIDGE_TOKEN || "";
}

function authorized(request: NextRequest) {
  const token = expectedToken();
  if (!token) return false;
  return request.headers.get("authorization") === `Bearer ${token}`;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const payload = await request.json();
  const snapshot = snapshotFromBridgePayload(payload, null);
  const privatePlayers = playersFromBridgePayload(payload, null);
  const store = saveSnapshot(snapshot, privatePlayers);

  return NextResponse.json({
    ok: true,
    receivedAt: store.receivedAt,
    onlinePlayers: snapshot.server.onlinePlayers,
  });
}
