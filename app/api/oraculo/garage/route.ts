import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "../../../../lib/oraculo-admin-auth";
import { getGaragePlayerData } from "../../../../lib/oraculo-garage-data";
import { PLAYER_SESSION_COOKIE, verifyPlayerSessionToken } from "../../../../lib/oraculo-player-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function steamIdFromRequest(request: NextRequest) {
  const playerSession = verifyPlayerSessionToken(request.cookies.get(PLAYER_SESSION_COOKIE)?.value);
  if (playerSession.ok) return playerSession.steamId;

  const adminSession = verifyAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (adminSession.ok) return adminSession.steamId;

  return "";
}

export async function GET(request: NextRequest) {
  const steamId = steamIdFromRequest(request);

  if (!steamId) {
    return NextResponse.json(
      {
        success: false,
        error: "Conecta Steam para ver tu garaje privado.",
        loginUrl: "/api/auth/steam/login?next=/garaje",
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return NextResponse.json(
    {
      success: true,
      scope: "player",
      steamId,
      garage: getGaragePlayerData(steamId),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
