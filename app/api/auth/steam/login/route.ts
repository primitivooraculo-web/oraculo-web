import { NextRequest, NextResponse } from "next/server";
import { PLAYER_NEXT_COOKIE, safeNextPath } from "../../../../../lib/oraculo-player-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"), "/mapa");
  const returnTo = `${origin}/api/auth/steam/callback`;

  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": `${origin}/`,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });

  const response = NextResponse.redirect(`https://steamcommunity.com/openid/login?${params.toString()}`);
  response.cookies.set(PLAYER_NEXT_COOKIE, nextPath, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });

  return response;
}
