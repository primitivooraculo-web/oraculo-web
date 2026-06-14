import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_SKIN_COLORS, cosmeticsResponse, forwardCosmetics } from "../../../../lib/oraculo-cosmetics";

export async function GET(request: NextRequest) {
  const proxied = await forwardCosmetics(request, "/api/overlay.skineditor/defaults");
  if (proxied) return proxied;

  return NextResponse.json(
    cosmeticsResponse({
      dino: request.nextUrl.searchParams.get("dino") || "Carnotaurus",
      colors: DEFAULT_SKIN_COLORS,
    }),
    { headers: { "Cache-Control": "no-store" } },
  );
}

