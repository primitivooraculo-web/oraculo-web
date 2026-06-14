import { NextRequest, NextResponse } from "next/server";
import { DEMO_PRESETS, cosmeticsResponse, forwardCosmetics } from "../../../../lib/oraculo-cosmetics";

export async function GET(request: NextRequest) {
  const proxied = await forwardCosmetics(request, "/api/overlay.skineditor/presets");
  if (proxied) return proxied;

  return NextResponse.json(
    cosmeticsResponse({
      presets: DEMO_PRESETS,
      pendingBackend: "Presets reales requieren DB/session; estos defaults mantienen el contrato externo.",
    }),
    { headers: { "Cache-Control": "no-store" } },
  );
}

