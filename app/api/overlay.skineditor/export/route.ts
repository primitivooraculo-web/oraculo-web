import { NextRequest, NextResponse } from "next/server";
import { TOKEN_COSTS, cosmeticsResponse, forwardCosmetics } from "../../../../lib/oraculo-cosmetics";

export async function POST(request: NextRequest) {
  const proxied = await forwardCosmetics(request, "/api/overlay.skineditor/export");
  if (proxied) return proxied;

  return NextResponse.json(
    cosmeticsResponse({
      tokens: {
        skin_tokens_remaining: 0,
      },
      tokenCosts: TOKEN_COSTS,
      pendingBackend: "Export real con token requiere DB/session.",
    }),
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}
