import crypto from "node:crypto";

export const ADMIN_SESSION_COOKIE = "oraculo_admin_session";

const SESSION_SECONDS = 8 * 60 * 60;

function adminSecret() {
  return (
    process.env.ORACULO_ADMIN_SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.ORACULO_ADMIN_TOKEN ||
    process.env.ADMIN_TOKEN ||
    ""
  );
}

export function hasAdminSessionSecret() {
  return Boolean(adminSecret());
}

export function adminSteamIds() {
  const raw =
    process.env.ORACULO_ADMIN_STEAM_IDS ||
    process.env.RPVT_ADMIN_STEAM_IDS ||
    process.env.ADMIN_STEAM_IDS ||
    "";

  return raw
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter((item) => /^\d{17}$/.test(item));
}

export function isAdminSteamId(steamId: string) {
  return adminSteamIds().includes(steamId);
}

function sign(value: string) {
  const secret = adminSecret();
  if (!secret) return "";
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function createAdminSessionToken(steamId: string) {
  const expiresAt = Date.now() + SESSION_SECONDS * 1000;
  const payload = `${steamId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminSessionToken(token: string | undefined) {
  if (!token) return { ok: false, steamId: "" };

  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, steamId: "" };

  const [steamId, expiresAtText, signature] = parts;
  if (!/^\d{17}$/.test(steamId)) return { ok: false, steamId: "" };
  if (!isAdminSteamId(steamId)) return { ok: false, steamId: "" };

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

export function adminSessionMaxAge() {
  return SESSION_SECONDS;
}
