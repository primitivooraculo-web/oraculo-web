import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionMaxAge,
  adminSteamIds,
  createAdminSessionToken,
  isAdminSteamId,
} from "../../../../../lib/oraculo-admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function loginRedirect(request: NextRequest, message: string) {
  const url = new URL("/admin/login", request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, 303);
}

function steamIdFromClaimedId(value: string | null) {
  return value?.match(/\/openid\/id\/(\d{17})\/?$/)?.[1] || value?.match(/(\d{17})/)?.[1] || "";
}

async function verifySteamOpenId(request: NextRequest) {
  const params = new URLSearchParams(request.nextUrl.searchParams);
  params.set("openid.mode", "check_authentication");

  const response = await fetch("https://steamcommunity.com/openid/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const text = await response.text();
  return response.ok && /(^|\n)is_valid:true(\n|$)/.test(text);
}

export async function GET(request: NextRequest) {
  if (adminSteamIds().length === 0) {
    return loginRedirect(request, "Falta configurar admins permitidos.");
  }

  const mode = request.nextUrl.searchParams.get("openid.mode");
  if (mode !== "id_res") return loginRedirect(request, "Steam no confirmo la sesion.");

  const valid = await verifySteamOpenId(request).catch(() => false);
  if (!valid) return loginRedirect(request, "Steam no pudo validar la sesion.");

  const steamId = steamIdFromClaimedId(request.nextUrl.searchParams.get("openid.claimed_id"));
  if (!steamId) return loginRedirect(request, "SteamID64 no detectado.");
  if (!isAdminSteamId(steamId)) return loginRedirect(request, "SteamID64 no autorizado.");

  const response = NextResponse.redirect(new URL("/admin", request.url), 303);
  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(steamId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: adminSessionMaxAge(),
  });

  return response;
}
