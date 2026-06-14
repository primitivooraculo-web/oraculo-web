import { NextRequest, NextResponse } from "next/server";
import { TOKEN_COSTS, cosmeticsResponse, forwardCosmetics } from "../../../../../lib/oraculo-cosmetics";

export async function POST(request: NextRequest) {
  const proxied = await forwardCosmetics(request, "/api/overlay.skineditor/preset/delete");
  if (proxied) return proxied;

  const body = await request.json().catch(() => ({}));
  return NextResponse.json(
    cosmeticsResponse({
      message: "Preset deleted",
      preset_name: typeof body.preset_name === "string" ? body.preset_name : "",
      tokens: {
        skin_tokens_remaining: 0,
      },
      tokenCosts: TOKEN_COSTS,
      pendingBackend: "Validado, pero borrado real requiere DB/session.",
    }),
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}
