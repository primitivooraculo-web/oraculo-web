import crypto from "node:crypto";

export const PLAYER_SESSION_COOKIE = "oraculo_steam_session";
export const PLAYER_STEAM_ID_COOKIE = "oraculo_steam_id";
export const PLAYER_NEXT_COOKIE = "oraculo_steam_next";

const PLAYER_SESSION_SECONDS = 30 * 24 * 60 * 60;

function playerSecret() {
  return (
    process.env.ORACULO_STEAM_SESSION_SECRET ||
    process.env.ORACULO_PLAYER_SESSION_SECRET ||
    process.env.ORACULO_ADMIN_SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.ORACULO_ADMIN_TOKEN ||
    process.env.ADMIN_TOKEN ||
    ""
  );
}

function sign(value: string) {
  const secret = playerSecret();
  if (!secret) return "";
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function playerSessionMaxAge() {
  return PLAYER_SESSION_SECONDS;
}

export function createPlayerSessionToken(steamId: string) {
  const expiresAt = Date.now() + PLAYER_SESSION_SECONDS * 1000;
  const payload = `${steamId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyPlayerSessionToken(token: string | undefined) {
  if (!token) return { ok: false, steamId: "" };

  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, steamId: "" };

  const [steamId, expiresAtText, signature] = parts;
  if (!/^\d{17}$/.test(steamId)) return { ok: false, steamId: "" };

  const expiresAt = Number(expiresAtText);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return { ok: false, steamId: "" };
  }

  const expected = sign(`${steamId}.${expiresAtText}`);
  if (!expected || !safeEqual(signature, expected)) {
    return { ok: false, steamId: "" };
  }

  return { ok: true, steamId };
}

export function steamIdFromClaimedId(value: string | null) {
  return value?.match(/\/openid\/id\/(\d{17})\/?$/)?.[1] || value?.match(/(\d{17})/)?.[1] || "";
}

export function safeNextPath(value: string | null | undefined, fallback = "/mapa") {
  const raw = String(value || "").trim();
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  if (raw.startsWith("/api/auth/steam")) return fallback;

  try {
    const parsed = new URL(raw, "https://oraculo.local");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export async function verifySteamOpenId(searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams);
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
