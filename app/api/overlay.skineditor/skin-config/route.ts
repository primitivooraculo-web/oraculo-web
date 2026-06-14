import { NextRequest, NextResponse } from "next/server";
import { SKIN_COLOR_GROUPS, cosmeticsResponse, forwardCosmetics } from "../../../../lib/oraculo-cosmetics";

export async function GET(request: NextRequest) {
  const proxied = await forwardCosmetics(request, "/api/overlay.skineditor/skin-config");
  if (proxied) return proxied;

  return NextResponse.json(
    cosmeticsResponse({
      maxPresets: 10,
      colorGroups: SKIN_COLOR_GROUPS,
      patterns: [0, 1, 2],
      genders: [0, 1],
      variation: { min: 0, max: 1, step: 0.01 },
    }),
    { headers: { "Cache-Control": "no-store" } },
  );
}

