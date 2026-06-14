import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NEXT_COOKIE = "oraculo_steam_next";

function extractSteamId(claimedId: string | null) {
  const match = claimedId?.match(/\/openid\/id\/(\d+)$/);
  return match?.[1] || null;
}

function safeNextPath(value: string | undefined) {
  const raw = String(value || "").trim();

  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return "/mapa";
  }

  if (raw.startsWith("/api/auth/steam")) {
    return "/mapa";
  }

  return raw;
}

async function verifySteamOpenId(searchParams: URLSearchParams) {
  const body = new URLSearchParams();

  searchParams.forEach((value, key) => {
    if (key.startsWith("openid.")) {
      body.set(key, value);
    }
  });

  body.set("openid.mode", "check_authentication");

  const response = await fetch("https://steamcommunity.com/openid/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) return false;

  const text = await response.text();
  return text.includes("is_valid:true");
}

export async function GET(request: NextRequest) {
  const nextPath = safeNextPath(request.cookies.get(NEXT_COOKIE)?.value);
  const redirectUrl = new URL(nextPath, request.url);

  const steamId = extractSteamId(request.nextUrl.searchParams.get("openid.claimed_id"));
  const isValid = steamId ? await verifySteamOpenId(request.nextUrl.searchParams) : false;

  if (!steamId || !isValid) {
    redirectUrl.searchParams.set("steam", "error");
    return NextResponse.redirect(redirectUrl);
  }

  const response = NextResponse.redirect(redirectUrl);

  response.cookies.set("oraculo_steam_id", steamId, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });

  response.cookies.set(NEXT_COOKIE, "", {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}