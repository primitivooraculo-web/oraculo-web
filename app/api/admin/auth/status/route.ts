import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  adminSteamIds,
  hasAdminSessionSecret,
  verifyAdminSessionToken,
} from "../../../../../lib/oraculo-admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = verifyAdminSessionToken(cookie);

  return NextResponse.json(
    {
      success: true,
      adminSteamIdCount: adminSteamIds().length,
      hasSessionSecret: hasAdminSessionSecret(),
      tokenLoginEnabled: process.env.ORACULO_ADMIN_ALLOW_TOKEN_LOGIN === "true",
      session: {
        present: Boolean(cookie),
        valid: session.ok,
        steamId: session.ok ? session.steamId : null,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

