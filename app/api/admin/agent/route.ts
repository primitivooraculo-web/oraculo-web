import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "../../../../lib/oraculo-admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function getBearerToken(req: NextRequest) {
  const bearer = req.headers.get("authorization");
  if (bearer?.toLowerCase().startsWith("bearer ")) {
    return bearer.slice(7).trim();
  }
  return req.headers.get("x-oraculo-admin-token") || "";
}

function requireAdmin(req: NextRequest) {
  const session = verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (session.ok) return { ok: true };

  const expected = process.env.ORACULO_ADMIN_TOKEN || process.env.ADMIN_TOKEN;
  if (!expected) {
    return {
      ok: false,
      response: json(
        {
          success: false,
          error: "Falta ORACULO_ADMIN_TOKEN o ADMIN_TOKEN.",
        },
        503,
      ),
    };
  }

  if (getBearerToken(req) !== expected) {
    return {
      ok: false,
      response: json({ success: false, error: "Token admin invalido." }, 401),
    };
  }

  return { ok: true };
}

function agentConfig() {
  const url =
    process.env.ORACULO_ADMIN_AGENT_URL ||
    process.env.ADMIN_AGENT_URL ||
    process.env.ORACULO_AGENT_URL ||
    "";
  const token =
    process.env.ORACULO_ADMIN_AGENT_TOKEN ||
    process.env.ADMIN_AGENT_TOKEN ||
    process.env.ORACULO_AGENT_TOKEN ||
    "";

  if (!url || !token) {
    throw new Error("Falta ORACULO_ADMIN_AGENT_URL/ORACULO_ADMIN_AGENT_TOKEN.");
  }

  return {
    url: url.replace(/\/$/, ""),
    token,
  };
}

function skinApiConfig() {
  const url = process.env.ORACULO_COSMETICS_API_URL || process.env.ORACULO_SKIN_API_URL || "";
  const token = process.env.ORACULO_COSMETICS_API_TOKEN || process.env.ORACULO_SKIN_API_TOKEN || "";

  if (!url || !token) {
    throw new Error("Falta ORACULO_COSMETICS_API_URL/ORACULO_COSMETICS_API_TOKEN.");
  }

  return {
    url: url.replace(/\/$/, ""),
    token,
  };
}

async function forwardToService(config: { url: string; token: string }, path: string, init?: RequestInit) {
  const response = await fetch(`${config.url}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
      ...(init?.headers || {}),
    },
  });

  const text = await response.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { success: false, raw: text };
  }

  return json(data, response.status);
}

async function forwardToAgent(path: string, init?: RequestInit) {
  return forwardToService(agentConfig(), path, init);
}

async function forwardToSkinApi(path: string, init?: RequestInit) {
  return forwardToService(skinApiConfig(), path, init);
}

function isMapaOperation(op: string) {
  return op === "mapa-live" || op === "mapa-health";
}

function isCapabilityOperation(op: string) {
  return op === "capabilities" || op === "oraculo-capabilities";
}

function isLegacyDbOperation(op: string) {
  return op.startsWith("legacy-") || op.startsWith("primalcore-");
}

function isSkinOperation(op: string) {
  return op === "skin-jobs" || op === "skin-queue" || op === "skin-status";
}

function isSkinAction(action: string) {
  return action === "skin-ack";
}

function mapaPath(op: string, query?: URLSearchParams) {
  const next = new URLSearchParams(query);
  next.set("op", op === "mapa-health" ? "health" : "live");
  return `/api/admin/mapa?${next.toString()}`;
}

function legacyDbPath(op: string, query?: URLSearchParams) {
  const next = new URLSearchParams(query);
  next.set("op", op.replace(/^(legacy|primalcore)-/, ""));
  return `/api/admin/legacy-db?${next.toString()}`;
}

function skinAdminPath(_op: string, query?: URLSearchParams) {
  const next = new URLSearchParams(query);
  next.delete("op");
  return `/api/admin/skins?${next.toString()}`;
}

function capabilityPath(op: string) {
  return op === "oraculo-capabilities" ? "/api/admin/oraculo-capabilities" : "/api/admin/capabilities";
}

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  const op = req.nextUrl.searchParams.get("op") || "capabilities";
  const query = new URLSearchParams(req.nextUrl.searchParams);
  query.set("op", op);

  try {
    if (isCapabilityOperation(op)) {
      return await forwardToAgent(capabilityPath(op));
    }

    if (isMapaOperation(op)) {
      return await forwardToAgent(mapaPath(op, query));
    }

    if (isLegacyDbOperation(op)) {
      return await forwardToAgent(legacyDbPath(op, query));
    }

    if (isSkinOperation(op)) {
      return await forwardToSkinApi(skinAdminPath(op, query));
    }

    return await forwardToAgent(`/api/admin/rcon?${query.toString()}`);
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Body JSON invalido." }, 400);
  }

  try {
    const action = typeof body === "object" && body && "action" in body ? String(body.action) : "";
    if (isMapaOperation(action)) {
      return await forwardToAgent("/api/admin/mapa", {
        method: "POST",
        body: JSON.stringify(body),
      });
    }

    if (isLegacyDbOperation(action)) {
      const nextBody =
        typeof body === "object" && body
          ? { ...(body as Record<string, unknown>), action: action.replace(/^(legacy|primalcore)-/, "") }
          : { action: action.replace(/^(legacy|primalcore)-/, "") };
      return await forwardToAgent("/api/admin/legacy-db", {
        method: "POST",
        body: JSON.stringify(nextBody),
      });
    }

    if (isSkinAction(action)) {
      const nextBody =
        typeof body === "object" && body
          ? { ...(body as Record<string, unknown>), action: action.replace(/^skin-/, "") }
          : { action: action.replace(/^skin-/, "") };
      return await forwardToSkinApi("/api/admin/skins", {
        method: "POST",
        body: JSON.stringify(nextBody),
      });
    }

    return await forwardToAgent("/api/admin/rcon", {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}
