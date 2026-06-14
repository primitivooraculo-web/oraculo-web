import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const COOKIE_NAMES = [
  "oraculo_steam_session",
  "oraculo_steam_id",
  "oraculo_steam_next",
];

const COOKIE_DOMAINS = [
  null,
  ".oraculoprimitivo.xyz",
  "oraculoprimitivo.xyz",
  "www.oraculoprimitivo.xyz",
];

function safeNextPath(value: string | null) {
  const raw = String(value || "").trim();

  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return "/mapa";
  }

  return raw;
}

function expiredCookie(name: string, domain: string | null) {
  const parts = [
    `${name}=`,
    "Path=/",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
  ];

  if (domain) {
    parts.push(`Domain=${domain}`);
  }

  parts.push("Secure", "HttpOnly", "SameSite=Lax");

  return parts.join("; ");
}

export async function GET(request: NextRequest) {
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));
  const response = NextResponse.redirect(new URL(nextPath, request.url), 303);

  response.headers.set("Cache-Control", "no-store");

  for (const name of COOKIE_NAMES) {
    for (const domain of COOKIE_DOMAINS) {
      response.headers.append("Set-Cookie", expiredCookie(name, domain));
    }
  }

  return response;
}