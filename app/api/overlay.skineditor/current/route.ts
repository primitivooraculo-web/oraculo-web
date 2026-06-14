import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_SKIN_COLORS, TOKEN_COSTS, cosmeticsResponse, forwardCosmetics } from "../../../../lib/oraculo-cosmetics";

export async function GET(request: NextRequest) {
  const proxied = await forwardCosmetics(request, "/api/overlay.skineditor/current");
  if (proxied) return proxied;

  return NextResponse.json(
    cosmeticsResponse({
      online: false,
      dead: false,
      skin: {
        dino: request.nextUrl.searchParams.get("dino") || "Carnotaurus",
        gender: "1",
        pattern_index: 2,
        allow_skineditor: true,
        colors: DEFAULT_SKIN_COLORS,
      },
      tokens: {
        skin_tokens_remaining: 0,
      },
      tokenCosts: TOKEN_COSTS,
      pendingBackend: "Sin hook live de skin todavia.",
    }),
    { headers: { "Cache-Control": "no-store" } },
  );
}
