import { NextRequest, NextResponse } from "next/server";
import {
  announce,
  consoleCommand,
  directMessage,
  getPlayerData,
  getPlayerListRaw,
  kick,
  parsePlayerList,
  saveServer,
} from "../../../../lib/oraculo-admin/rcon";
import type { AdminAction } from "../../../../lib/oraculo-admin/types";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "../../../../lib/oraculo-admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ActionBody = {
  action?: AdminAction;
  steamId?: string;
  message?: string;
  reason?: string;
  command?: string;
};

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
          error:
            "Falta ORACULO_ADMIN_TOKEN o ADMIN_TOKEN. No se abre RCON sin token admin.",
        },
        503,
      ),
    };
  }

  const provided = getBearerToken(req);
  if (provided !== expected) {
    return {
      ok: false,
      response: json({ success: false, error: "Token admin invalido." }, 401),
    };
  }

  return { ok: true };
}

function requiredText(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Falta ${label}.`);
  }
  return value.trim();
}

function requiredSteamId(value: unknown) {
  const steamId = requiredText(value, "steamId");
  if (!/^\d{17}$/.test(steamId)) {
    throw new Error("SteamID64 debe tener exactamente 17 digitos.");
  }
  return steamId;
}

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  const op = req.nextUrl.searchParams.get("op") || "player-list";
  const steamId = req.nextUrl.searchParams.get("steamId") || "";

  try {
    if (op === "player-list") {
      const raw = await getPlayerListRaw();
      return json({ success: true, raw, players: parsePlayerList(raw) });
    }

    if (op === "player-data") {
      const data = await getPlayerData(requiredSteamId(steamId));
      return json({ success: true, player: data });
    }

    if (op === "capabilities") {
      return json({
        success: true,
        active: [
          "announce",
          "direct-message",
          "kick",
          "save-server",
          "console-command",
          "player-list",
          "player-data",
        ],
        pendingBackend: [
          "persistent-ban",
          "teleport",
          "weather",
          "economy",
          "gacha",
          "quest-manager",
          "server-start-stop-restart",
        ],
      });
    }

    return json({ success: false, error: `Operacion no soportada: ${op}` }, 400);
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

  let body: ActionBody;
  try {
    body = (await req.json()) as ActionBody;
  } catch {
    return json({ success: false, error: "Body JSON invalido." }, 400);
  }

  try {
    switch (body.action) {
      case "announce": {
        const result = await announce(requiredText(body.message, "message"));
        return json({ success: true, result });
      }
      case "direct-message": {
        const steamId = requiredSteamId(body.steamId);
        const message = requiredText(body.message, "message");
        const result = await directMessage(steamId, message);
        return json({ success: true, result });
      }
      case "kick": {
        const steamId = requiredSteamId(body.steamId);
        const reason = body.reason?.trim() || "Kicked";
        const result = await kick(steamId, reason);
        return json({ success: true, result });
      }
      case "save-server": {
        const result = await saveServer();
        return json({ success: true, result });
      }
      case "console-command": {
        const result = await consoleCommand(requiredText(body.command, "command"));
        return json({ success: true, result });
      }
      case "player-list": {
        const raw = await getPlayerListRaw();
        return json({ success: true, raw, players: parsePlayerList(raw) });
      }
      case "player-data": {
        const player = await getPlayerData(requiredSteamId(body.steamId));
        return json({ success: true, player });
      }
      default:
        return json(
          {
            success: false,
            error:
              "Accion no soportada. Usa announce, direct-message, kick, save-server, console-command, player-list o player-data.",
          },
          400,
        );
    }
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
