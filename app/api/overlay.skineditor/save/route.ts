import { NextRequest, NextResponse } from "next/server";
import { TOKEN_COSTS, cosmeticsResponse, forwardCosmetics, normalizeSkinPayload } from "../../../../lib/oraculo-cosmetics";

export async function POST(request: NextRequest) {
  const proxied = await forwardCosmetics(request, "/api/overlay.skineditor/save");
  if (proxied) return proxied;

  const payload = normalizeSkinPayload(await request.json().catch(() => ({})));
  return NextResponse.json(
    cosmeticsResponse({
      message: "queued",
      queued: false,
      skin: payload,
      tokens: {
        skin_tokens_remaining: 0,
      },
      tokenCosts: TOKEN_COSTS,
      pendingBackend: "Validado, pero no aplicado al gameserver hasta conectar backend live confirmado.",
    }),
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}
