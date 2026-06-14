import { cookies } from "next/headers";

type AnyBody = Record<string, any>;

const STEAM_COOKIE_NAMES = [
  "oraculo_steam_id",
  "oraculoSteamId",
  "steamId",
  "steam_id",
  "SteamID64",
  "steamid",
  "steam",
  "oraculo_session",
  "session",
];

function text(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function validSteamId(value: string): boolean {
  return /^\d{17}$/.test(value);
}

function parseSteamFromCookie(value: string): string {
  const raw = text(value);
  if (validSteamId(raw)) return raw;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    const candidates = [
      parsed?.steamId,
      parsed?.steam_id,
      parsed?.steamID,
      parsed?.id,
      parsed?.user?.steamId,
      parsed?.user?.steam_id,
    ].map(text);
    return candidates.find(validSteamId) || "";
  } catch {
    const match = raw.match(/\b\d{17}\b/);
    return match ? match[0] : "";
  }
}

export async function resolveSteamId(request: Request, body: AnyBody = {}): Promise<string> {
  const url = new URL(request.url);
  const querySteamId = text(url.searchParams.get("steamId"));
  const bodySteamId = text(body.steamId || body.steam_id || body.playerId || body.player_id);

  const jar = await cookies();
  for (const name of STEAM_COOKIE_NAMES) {
    const found = jar.get(name)?.value;
    const steamId = parseSteamFromCookie(found || "");
    if (steamId) return steamId;
  }

  if (validSteamId(querySteamId)) return querySteamId;
  if (validSteamId(bodySteamId)) return bodySteamId;
  throw new Error("Steam no conectado.");
}

function agentBaseUrl(): string {
  const direct = text(process.env.ORACULO_ADMIN_AGENT_URL || process.env.ORACULO_AGENT_URL);
  if (direct) return direct.replace(/\/$/, "");

  const actions = text(process.env.ORACULO_ADMIN_ACTIONS_URL);
  if (actions) return actions.replace(/\/api\/admin\/actions\/?$/, "").replace(/\/$/, "");

  throw new Error("Falta ORACULO_ADMIN_AGENT_URL u ORACULO_ADMIN_ACTIONS_URL.");
}

function agentToken(): string {
  const token = text(process.env.ADMIN_AGENT_TOKEN || process.env.ORACULO_ADMIN_AGENT_TOKEN || process.env.ORACULO_ADMIN_TOKEN);
  if (!token) throw new Error("Falta ADMIN_AGENT_TOKEN.");
  return token;
}

export async function callGarage(action: string, payload: AnyBody = {}) {
  const res = await fetch(`${agentBaseUrl()}/api/admin/garage-vault`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${agentToken()}`,
    },
    body: JSON.stringify({ ...payload, action }),
    cache: "no-store",
  });

  const textBody = await res.text();
  let data: any;
  try {
    data = textBody ? JSON.parse(textBody) : {};
  } catch {
    data = { success: false, error: textBody || "Respuesta invalida del agente." };
  }

  if (!res.ok || data?.success === false) {
    throw new Error(data?.error || `Garage agent HTTP ${res.status}`);
  }

  return data;
}

export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

export function errorJson(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const status = message.includes("Steam no conectado") ? 401 : 500;
  return json({ success: false, error: message }, status);
}
