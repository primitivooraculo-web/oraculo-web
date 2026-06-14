import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NEXT_COOKIE = "oraculo_steam_next";

function siteUrl(request: NextRequest) {
  return request.nextUrl.origin.replace(/\/$/, "");
}

function safeNextPath(value: string | null) {
  const raw = String(value || "").trim();

  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return "/mapa";
  }

  if (raw.startsWith("/api/auth/steam")) {
    return "/mapa";
  }

  return raw;
}

export async function GET(request: NextRequest) {
  const baseUrl = siteUrl(request);
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));
  const returnTo = `${baseUrl}/api/auth/steam/callback`;

  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": `${baseUrl}/`,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });

  const response = NextResponse.redirect(`https://steamcommunity.com/openid/login?${params.toString()}`);

  response.cookies.set(NEXT_COOKIE, nextPath, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });

  return response;
}
