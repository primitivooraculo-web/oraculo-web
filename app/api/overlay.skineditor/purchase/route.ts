import { NextRequest, NextResponse } from "next/server";
import { cosmeticsResponse, forwardCosmetics } from "../../../../lib/oraculo-cosmetics";

export async function POST(request: NextRequest) {
  const proxied = await forwardCosmetics(request, "/api/overlay.skineditor/purchase");
  if (proxied) return proxied;

  return NextResponse.json(
    cosmeticsResponse({
      newPoints: null,
      pendingBackend: "Compra de Skin Editor requiere DB/puntos reales.",
    }),
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}

