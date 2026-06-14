import { NextRequest, NextResponse } from "next/server";
import {
  PLAYER_NEXT_COOKIE,
  PLAYER_SESSION_COOKIE,
  PLAYER_STEAM_ID_COOKIE,
  createPlayerSessionToken,
  playerSessionMaxAge,
  safeNextPath,
  steamIdFromClaimedId,
  verifySteamOpenId,
} from "../../../../../lib/oraculo-player-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sharedCookieDomain(request: NextRequest) {
  return request.nextUrl.hostname.endsWith("oraculoprimitivo.xyz") ? ".oraculoprimitivo.xyz" : undefined;
}

function cookieOptions(maxAge: number, domain?: string) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    ...(domain ? { domain } : {}),
  };
}

function redirectWithError(request: NextRequest, message: string) {
  const nextPath = safeNextPath(request.cookies.get(PLAYER_NEXT_COOKIE)?.value, "/mapa");
  const url = new URL(nextPath, request.url);
  url.searchParams.set("steamError", message);
  return NextResponse.redirect(url, 303);
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("openid.mode");
  if (mode !== "id_res") return redirectWithError(request, "Steam no confirmo la sesion.");

  const valid = await verifySteamOpenId(request.nextUrl.searchParams).catch(() => false);
  if (!valid) return redirectWithError(request, "Steam no pudo validar la sesion.");

  const steamId = steamIdFromClaimedId(request.nextUrl.searchParams.get("openid.claimed_id"));
  if (!steamId) return redirectWithError(request, "SteamID64 no detectado.");

  const nextPath = safeNextPath(request.cookies.get(PLAYER_NEXT_COOKIE)?.value, "/mapa");
  const response = NextResponse.redirect(new URL(nextPath, request.url), 303);
  const domain = sharedCookieDomain(request);
  response.cookies.set(PLAYER_SESSION_COOKIE, createPlayerSessionToken(steamId), cookieOptions(playerSessionMaxAge(), domain));
  response.cookies.set(PLAYER_STEAM_ID_COOKIE, steamId, cookieOptions(playerSessionMaxAge(), domain));
  response.cookies.set(PLAYER_NEXT_COOKIE, "", cookieOptions(0, domain));

  return response;
}
