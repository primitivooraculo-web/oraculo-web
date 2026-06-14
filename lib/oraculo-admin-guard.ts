import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "./oraculo-admin-auth";

export function adminSessionFromRequest(request: NextRequest) {
  return verifyAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
}

export function requireAdminRequest(request: NextRequest) {
  const session = adminSessionFromRequest(request);
  if (session.ok) {
    return { ok: true as const, steamId: session.steamId };
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
