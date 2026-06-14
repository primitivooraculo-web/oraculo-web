import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionMaxAge,
  adminSteamIds,
  createAdminSessionToken,
  isAdminSteamId,
} from "../../../../lib/oraculo-admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminToken() {
  return process.env.ORACULO_ADMIN_TOKEN || process.env.ADMIN_TOKEN || "";
}

function isJson(request: NextRequest) {
  return request.headers.get("content-type")?.includes("application/json");
}

function fail(request: NextRequest, message: string, status = 401) {
  if (isJson(request)) {
    return NextResponse.json({ success: false, error: message }, { status });
  }

  const url = new URL("/admin/login", request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  if (process.env.ORACULO_ADMIN_ALLOW_TOKEN_LOGIN !== "true") {
    return fail(request, "Login con token desactivado. Usa Steam.", 403);
  }

  const expected = adminToken();
  if (!expected) return fail(request, "Falta ORACULO_ADMIN_TOKEN.", 503);
  if (adminSteamIds().length === 0) return fail(request, "Falta ORACULO_ADMIN_STEAM_IDS.", 503);

  const body = isJson(request)
    ? await request.json().catch(() => ({}))
    : Object.fromEntries((await request.formData()).entries());

  const steamId = String(body.steamId || "").trim();
  const token = String(body.token || body.adminToken || "").trim();

  if (!/^\d{17}$/.test(steamId)) return fail(request, "SteamID64 invalido.", 400);
  if (!isAdminSteamId(steamId)) return fail(request, "SteamID64 no autorizado.", 403);
  if (token !== expected) return fail(request, "Token admin invalido.", 401);

  const response = isJson(request)
    ? NextResponse.json({ success: true, steamId })
    : NextResponse.redirect(new URL("/admin", request.url), 303);

  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(steamId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: adminSessionMaxAge(),
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
