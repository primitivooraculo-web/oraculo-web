import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "./oraculo-admin-auth";

function cleanToken(value: string | null) {
  return (value || "").trim().replace(/^Bearer\s+/i, "");
}

function expectedAdminToken() {
  return process.env.ORACULO_ADMIN_TOKEN || process.env.ADMIN_TOKEN || "";
}

export function adminSessionFromRequest(request: NextRequest) {
  return verifyAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
}

export function requireAdminRequest(request: NextRequest) {
  const session = adminSessionFromRequest(request);
  if (session.ok) {
    return { ok: true as const, steamId: session.steamId };
  }

  const expected = expectedAdminToken();
  const headerToken =
    cleanToken(request.headers.get("x-oraculo-admin-token")) ||
    cleanToken(request.headers.get("authorization"));

  if (expected && headerToken && headerToken === expected) {
    return { ok: true as const, steamId: "" };
  }

  return {
    ok: false as const,
    response: NextResponse.json(
      { success: false, error: "Admin requerido." },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    ),
  };
}
