const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const {
  announce,
  consoleCommand,
  directMessage,
  getPlayerData,
  getPlayerListRaw,
  kick,
  parsePlayerList,
  saveServer,
} = require("./rcon");
const { handlePrimalCoreAction } = require("./primalcore");
const { handleSkinEditor, skinConfig } = require("./skins");

function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

loadDotEnv();

const HOST = process.env.ADMIN_AGENT_HOST || "127.0.0.1";
const PORT = Number(process.env.ADMIN_AGENT_PORT || 4310);
const TOKEN = process.env.ADMIN_AGENT_TOKEN || process.env.ORACULO_ADMIN_AGENT_TOKEN || "";
const ALLOW_CONSOLE = process.env.ADMIN_AGENT_ALLOW_CONSOLE === "true";
const ACTIONS_ENABLED = process.env.ADMIN_AGENT_ACTIONS_ENABLED === "true";
const MAPA_LIVE_URL =
  process.env.ORACULO_MAPA_LIVE_URL ||
  process.env.MAPA_LIVE_URL ||
  "https://www.oraculoprimitivo.xyz/api/oraculo/live";

const COMMAND_TEMPLATES = {
  "kill-dino": process.env.ADMIN_AGENT_CMD_KILL_DINO || "",
  teleport: process.env.ADMIN_AGENT_CMD_TELEPORT || "",
  "change-skin": process.env.ADMIN_AGENT_CMD_CHANGE_SKIN || "",
  weather: process.env.ADMIN_AGENT_CMD_WEATHER || "",
};

const STANDARD_RCON_ACTIONS = [
  "server-details",
  "queue-status",
  "playables",
  "ban",
  "add-whitelist",
  "remove-whitelist",
  "toggle-whitelist",
  "toggle-global-chat",
  "pause-server",
  "toggle-ai",
  "toggle-ai-learning",
  "toggle-migrations",
  "toggle-humans",
  "toggle-net-distance-checks",
  "wipe-corpses",
  "ai-density",
  "set-growth-multiplier",
  "toggle-growth-multiplier",
  "disable-ai-classes",
  "update-playables",
];

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

function getToken(req) {
  const authorization = req.headers.authorization || "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }
  return req.headers["x-oraculo-agent-token"] || "";
}

function requireAgent(req, res) {
  if (!TOKEN) {
    sendJson(res, 503, {
      success: false,
      error: "Falta ADMIN_AGENT_TOKEN.",
    });
    return false;
  }

  if (getToken(req) !== TOKEN) {
    sendJson(res, 401, {
      success: false,
      error: "Token de agente invalido.",
    });
    return false;
  }

  return true;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error("Body demasiado grande."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Body JSON invalido."));
      }
    });
    req.on("error", reject);
  });
}

function requiredText(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Falta ${label}.`);
  }
  return value.trim();
}

function textValue(value) {
  if (value == null) return "";
  return String(value).trim();
}

function requiredAnyText(values, label) {
  for (const value of values) {
    const text = textValue(value);
    if (text) return text;
  }
  throw new Error(`Falta ${label}.`);
}

function noCommaText(value, label) {
  const text = requiredAnyText([value], label);
  if (text.includes(",")) throw new Error(`${label} no puede contener coma.`);
  return text;
}

function rconNumber(value, label) {
  const text = requiredAnyText([value], label);
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) throw new Error(`${label} debe ser numerico.`);
  return String(parsed);
}

function csvText(value, label) {
  const text = requiredAnyText([value], label);
  if (!/^[a-zA-Z0-9_, -]+$/.test(text)) {
    throw new Error(`${label} solo acepta letras, numeros, comas, espacios y guiones.`);
  }
  return text;
}

function requiredSteamId(value) {
  const steamId = requiredText(value, "steamId");
  if (!/^\d{17}$/.test(steamId)) {
    throw new Error("SteamID64 debe tener exactamente 17 digitos.");
  }
  return steamId;
}

function capabilities() {
  return {
    success: true,
    agent: "oraculo-admin-agent",
    active: [
      "announce",
      "direct-message",
      "kick",
      "save-server",
      "player-list",
      "player-data",
      ...STANDARD_RCON_ACTIONS,
      ...(ALLOW_CONSOLE ? ["console-command"] : []),
    ],
    advanced: Object.entries(COMMAND_TEMPLATES).map(([action, template]) => ({
      action,
      enabled: ACTIONS_ENABLED && Boolean(template),
    })),
    disabled: [
      ...(!ALLOW_CONSOLE ? ["console-command"] : []),
      ...Object.entries(COMMAND_TEMPLATES)
        .filter(([, template]) => !ACTIONS_ENABLED || !template)
        .map(([action]) => action),
    ],
    mapa: {
      readOnly: true,
      telemetry: "untouched",
      active: ["mapa-live", "mapa-health"],
    },
    legacyDb: {
      readOnly: true,
      active: [
        "legacy-health",
        "legacy-summary",
        "legacy-garage",
        "legacy-player",
        "legacy-stats",
        "legacy-skins",
        "legacy-catalogue",
        "legacy-online",
      ],
    },
    skins: {
      active: [
        "current",
        "defaults",
        "skin-config",
        "presets",
        "save",
        "preset-save",
        "preset-delete",
        "export",
        "purchase",
      ],
      store: "local-json",
      liveApply: Boolean(process.env.ADMIN_AGENT_CMD_CHANGE_SKIN),
      config: skinConfig(),
    },
  };
}

function summarizeMapa(snapshot) {
  const server = snapshot && typeof snapshot === "object" ? snapshot.server || {} : {};
  return {
    generatedAt: snapshot?.generatedAt || null,
    map: server.map || "Gateway",
    linked: Boolean(server.linked),
    onlinePlayers: Number.isFinite(Number(server.onlinePlayers)) ? Number(server.onlinePlayers) : 0,
    maxPlayers: Number.isFinite(Number(server.maxPlayers)) ? Number(server.maxPlayers) : 200,
    mapPlayers: Array.isArray(snapshot?.mapPlayers) ? snapshot.mapPlayers.length : 0,
    friends: Array.isArray(snapshot?.friends) ? snapshot.friends.length : 0,
    heatZones: Array.isArray(snapshot?.heatZones) ? snapshot.heatZones.length : 0,
  };
}

async function fetchMapaSnapshot() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.ORACULO_MAPA_TIMEOUT_MS || 7000));

  try {
    const response = await fetch(MAPA_LIVE_URL, {
      signal: controller.signal,
      headers: {
        "User-Agent": "oraculo-admin-agent",
      },
    });
    const text = await response.text();
    let snapshot;
    try {
      snapshot = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Mapa Live devolvio JSON invalido HTTP ${response.status}.`);
    }
    if (!response.ok) throw new Error(`Mapa Live respondio HTTP ${response.status}.`);
    return snapshot;
  } finally {
    clearTimeout(timeout);
  }
}

async function handleMapaAction(action) {
  switch (action) {
    case "health":
    case "mapa-health": {
      const snapshot = await fetchMapaSnapshot();
      return {
        success: true,
        module: "mapa",
        readOnly: true,
        telemetry: "untouched",
        summary: summarizeMapa(snapshot),
      };
    }
    case "live":
    case "mapa-live": {
      const snapshot = await fetchMapaSnapshot();
      return {
        success: true,
        module: "mapa",
        readOnly: true,
        telemetry: "untouched",
        summary: summarizeMapa(snapshot),
        snapshot,
      };
    }
    default:
      throw new Error(`Accion mapa no soportada: ${action}`);
  }
}

function renderTemplate(template, body) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
    const value = body[key];
    return value == null ? "" : String(value);
  });
}

async function runWhitelistedConsole(command) {
  return {
    success: true,
    command,
    result: await consoleCommand(command),
  };
}

async function handleRconAction(action, body) {
  switch (action) {
    case "announce":
      return { success: true, result: await announce(requiredText(body.message, "message")) };
    case "direct-message":
      return {
        success: true,
        result: await directMessage(requiredSteamId(body.steamId), requiredText(body.message, "message")),
      };
    case "kick":
      return {
        success: true,
        result: await kick(requiredSteamId(body.steamId), body.reason?.trim() || "Kicked"),
      };
    case "save-server":
      return { success: true, result: await saveServer() };
    case "server-details":
      return runWhitelistedConsole("serverdetails");
    case "queue-status":
      return runWhitelistedConsole("getqueuestatus");
    case "playables":
      return runWhitelistedConsole("getplayables");
    case "ban": {
      const steamId = requiredSteamId(body.steamId);
      const playerName = noCommaText(body.playerName || body.name || body.command, "playerName");
      const reason = noCommaText(body.reason || body.message || "Admin action", "reason");
      const duration = noCommaText(body.duration || body.time || "0", "duration");
      return runWhitelistedConsole(`ban ${playerName},${steamId},${reason},${duration}`);
    }
    case "add-whitelist":
      return runWhitelistedConsole(`addwhitelist ${requiredSteamId(body.steamId)}`);
    case "remove-whitelist":
      return runWhitelistedConsole(`removewhitelist ${requiredSteamId(body.steamId)}`);
    case "toggle-whitelist":
      return runWhitelistedConsole("togglewhitelist");
    case "toggle-global-chat":
      return runWhitelistedConsole("toggleglobalchat");
    case "pause-server":
      return runWhitelistedConsole("pause");
    case "toggle-ai":
      return runWhitelistedConsole("toggleai");
    case "toggle-ai-learning":
      return runWhitelistedConsole("toggleailearning");
    case "toggle-migrations":
      return runWhitelistedConsole("togglemigrations");
    case "toggle-humans":
      return runWhitelistedConsole("togglehumans");
    case "toggle-net-distance-checks":
      return runWhitelistedConsole("togglenetupdatedistancechecks");
    case "wipe-corpses":
      return runWhitelistedConsole("wipecorpses");
    case "ai-density":
      return runWhitelistedConsole(`aidensity ${rconNumber(body.value || body.command || body.message, "value")}`);
    case "set-growth-multiplier":
      return runWhitelistedConsole(`setgrowthmultiplier ${rconNumber(body.value || body.command || body.message, "value")}`);
    case "toggle-growth-multiplier":
      return runWhitelistedConsole("togglegrowthmultiplier");
    case "disable-ai-classes":
      return runWhitelistedConsole(`disableaiclasses ${csvText(body.classList || body.command || body.message, "classList")}`);
    case "update-playables":
      return runWhitelistedConsole(`updateplayables ${csvText(body.dinoList || body.command || body.message, "dinoList")}`);
    case "console-command": {
      if (!ALLOW_CONSOLE) throw new Error("console-command desactivado en ADMIN_AGENT_ALLOW_CONSOLE.");
      return { success: true, result: await consoleCommand(requiredText(body.command, "command")) };
    }
    case "player-list": {
      const raw = await getPlayerListRaw();
      return { success: true, raw, players: parsePlayerList(raw) };
    }
    case "player-data":
      return { success: true, player: await getPlayerData(requiredSteamId(body.steamId)) };
    default:
      throw new Error(`Accion RCON no soportada: ${action}`);
  }
}

async function handleAdvancedAction(action, body) {
  if (!ACTIONS_ENABLED) throw new Error("Acciones avanzadas desactivadas en ADMIN_AGENT_ACTIONS_ENABLED.");
  const template = COMMAND_TEMPLATES[action];
  if (!template) throw new Error(`No hay plantilla configurada para ${action}.`);
  const command = renderTemplate(template, body).trim();
  if (!command) throw new Error(`La plantilla de ${action} produjo comando vacio.`);
  return {
    success: true,
    action,
    command,
    result: await consoleCommand(command),
  };
}

async function handleRequest(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, {
        ok: true,
        agent: "oraculo-admin-agent",
        rconHost: process.env.RCON_HOST ? "set" : "default-local",
        rconPort: Number(process.env.RCON_PORT || 8888),
        actionsEnabled: ACTIONS_ENABLED,
        consoleEnabled: ALLOW_CONSOLE,
      });
    }

    if (
      (url.pathname.startsWith("/api/admin/") || url.pathname.startsWith("/api/overlay.skineditor/")) &&
      !requireAgent(req, res)
    ) {
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/capabilities") {
      return sendJson(res, 200, capabilities());
    }

    if (url.pathname.startsWith("/api/overlay.skineditor/")) {
      const body = req.method === "GET" ? {} : await readBody(req);
      const params = Object.fromEntries(url.searchParams.entries());
      return sendJson(
        res,
        200,
        await handleSkinEditor(url.pathname, req.method, params, body, { consoleCommand }),
      );
    }

    if (req.method === "GET" && url.pathname === "/api/admin/mapa") {
      const op = url.searchParams.get("op") || "live";
      return sendJson(res, 200, await handleMapaAction(op));
    }

    if (req.method === "GET" && (url.pathname === "/api/admin/legacy-db" || url.pathname === "/api/admin/primalcore")) {
      const op = url.searchParams.get("op") || "summary";
      const body = Object.fromEntries(url.searchParams.entries());
      return sendJson(res, 200, await handlePrimalCoreAction(op, body));
    }

    if (req.method === "GET" && url.pathname === "/api/admin/rcon") {
      const op = url.searchParams.get("op") || "player-list";
      if (op === "capabilities") return sendJson(res, 200, capabilities());
      const body = Object.fromEntries(url.searchParams.entries());
      return sendJson(res, 200, await handleRconAction(op, body));
    }

    if (req.method === "POST" && url.pathname === "/api/admin/rcon") {
      const body = await readBody(req);
      return sendJson(res, 200, await handleRconAction(requiredText(body.action, "action"), body));
    }

    if (req.method === "POST" && url.pathname === "/api/admin/mapa") {
      const body = await readBody(req);
      return sendJson(res, 200, await handleMapaAction(requiredText(body.action, "action")));
    }

    if (req.method === "POST" && (url.pathname === "/api/admin/legacy-db" || url.pathname === "/api/admin/primalcore")) {
      const body = await readBody(req);
      return sendJson(res, 200, await handlePrimalCoreAction(requiredText(body.action, "action"), body));
    }

    if (req.method === "POST" && url.pathname === "/api/admin/actions") {
      const body = await readBody(req);
      return sendJson(res, 200, await handleAdvancedAction(requiredText(body.action, "action"), body));
    }

    return sendJson(res, 404, {
      success: false,
      error: "Ruta no encontrada.",
    });
  } catch (error) {
    return sendJson(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

if (!Number.isFinite(PORT) || PORT <= 0) {
  throw new Error("ADMIN_AGENT_PORT no es valido.");
}

http.createServer(handleRequest).listen(PORT, HOST, () => {
  console.log(`oraculo-admin-agent escuchando en http://${HOST}:${PORT}`);
});
