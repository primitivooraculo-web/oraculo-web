import { NextRequest, NextResponse } from "next/server";
import { TOKEN_COSTS, cosmeticsResponse, forwardCosmetics, normalizeSkinPayload } from "../../../../../lib/oraculo-cosmetics";

export async function POST(request: NextRequest) {
  const proxied = await forwardCosmetics(request, "/api/overlay.skineditor/preset/save");
  if (proxied) return proxied;

  const body = await request.json().catch(() => ({}));
  const presetName = typeof body.preset_name === "string" && body.preset_name.trim()
    ? body.preset_name.trim().slice(0, 32)
    : "Preset";

  return NextResponse.json(
    cosmeticsResponse({
      message: "Preset saved",
      preset: {
        name: presetName,
        ...normalizeSkinPayload(body),
      },
      tokens: {
        skin_tokens_remaining: 0,
      },
      tokenCosts: TOKEN_COSTS,
      pendingBackend: "Validado, pero persistencia real requiere DB/session.",
    }),
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}
