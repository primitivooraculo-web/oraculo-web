const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const SKIN_COLOR_GROUPS = [
  "male_display",
  "markings",
  "body",
  "flank",
  "underbelly",
  "detail",
  "eyes",
];

const DEFAULT_SKIN_COLORS = {
  male_display: { r: 0.5, g: 0.3, b: 0.2, a: 1 },
  markings: { r: 0.4, g: 0.4, b: 0.4, a: 1 },
  body: { r: 0.6, g: 0.3, b: 0.2, a: 1 },
  flank: { r: 0.5, g: 0.3, b: 0.2, a: 1 },
  underbelly: { r: 0.7, g: 0.6, b: 0.4, a: 1 },
  detail: { r: 0.3, g: 0.2, b: 0.1, a: 1 },
  eyes: { r: 0.8, g: 0.7, b: 0.1, a: 1 },
};

const TOKEN_COSTS = {
  apply_skin: 1,
  preset_save: 1,
  export: 1,
  purchase: 1000,
};

function storePath() {
  return process.env.ORACULO_SKINS_STORE_PATH || path.join(process.cwd(), "data", "skins-store.json");
}

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function emptyStore() {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    players: {},
    purchases: {},
    audit: [],
  };
}

function readStore() {
  const file = storePath();
  if (!fs.existsSync(file)) return emptyStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      ...emptyStore(),
      ...parsed,
      players: parsed.players && typeof parsed.players === "object" ? parsed.players : {},
      purchases: parsed.purchases && typeof parsed.purchases === "object" ? parsed.purchases : {},
      audit: Array.isArray(parsed.audit) ? parsed.audit : [],
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store) {
  const file = storePath();
  ensureDir(file);
  fs.writeFileSync(file, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function clamp01(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
}

function normalizeColor(value, fallback) {
  const src = value && typeof value === "object" ? value : {};
  return {
    r: clamp01(src.r, fallback.r),
    g: clamp01(src.g, fallback.g),
    b: clamp01(src.b, fallback.b),
    a: clamp01(src.a, fallback.a),
  };
}

function normalizeColors(value) {
  const src = value && typeof value === "object" ? value : {};
  return Object.fromEntries(
    SKIN_COLOR_GROUPS.map((group) => [group, normalizeColor(src[group], DEFAULT_SKIN_COLORS[group])]),
  );
}

function text(value, fallback = "") {
  if (value == null) return fallback;
  const out = String(value).trim();
  return out || fallback;
}

function shortText(value, fallback, max = 48) {
  return text(value, fallback).slice(0, max);
}

function validSteamId(value) {
  return typeof value === "string" && /^765\d{14}$/.test(value);
}

function resolveSteamId(input) {
  const value = text(
    input.steamId ||
      input.steam_id ||
      input.playerId ||
      input.player_id ||
      input.PlayerID ||
      input.querySteamId ||
      "",
  );
  return validSteamId(value) ? value : "global";
}

function normalizeSkinPayload(value) {
  const src = value && typeof value === "object" ? value : {};
  const pattern = Number(src.pattern_index ?? src.pattern ?? 0);
  const gender = Number(src.gender ?? 1);
  const variation = Number(src.skin_variation ?? src.variation ?? 0.5);

  return {
    action: shortText(src.action, "apply_skin", 32),
    dino: shortText(src.dino || src.species || src.class, "Carnotaurus", 64),
    pattern_index: Number.isFinite(pattern) ? Math.max(0, Math.min(12, Math.round(pattern))) : 0,
    gender: Number.isFinite(gender) ? Math.max(0, Math.min(1, Math.round(gender))) : 1,
    skin_variation: Number.isFinite(variation) ? Math.max(0, Math.min(1, variation)) : 0.5,
    colors: normalizeColors(src.colors),
  };
}

function playerRecord(store, steamId) {
  if (!store.players[steamId]) {
    store.players[steamId] = {
      steamId,
      skinTokens: Number(process.env.ORACULO_SKIN_DEFAULT_TOKENS || 0),
      current: null,
      presets: [],
      updatedAt: null,
    };
  }
  return store.players[steamId];
}

function publicPlayer(record) {
  return {
    steamId: record.steamId === "global" ? null : record.steamId,
    skin_tokens_remaining: Number(record.skinTokens || 0),
  };
}

function skinCode(payload) {
  const hash = crypto
    .createHash("sha1")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 16);
  return `orp-${hash}`;
}

function renderTemplate(template, body) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
    const value = body[key];
    return value == null ? "" : String(value);
  });
}

async function maybeApplySkin({ steamId, payload, consoleCommand }) {
  const template = process.env.ADMIN_AGENT_CMD_CHANGE_SKIN || "";
  if (!template) {
    return {
      applied: false,
      liveReady: false,
      reason: "Falta ADMIN_AGENT_CMD_CHANGE_SKIN.",
    };
  }

  if (!validSteamId(steamId)) {
    return {
      applied: false,
      liveReady: false,
      reason: "Falta SteamID64 real para aplicar en vivo.",
    };
  }

  const code = skinCode(payload);
  const command = renderTemplate(template, {
    steamId,
    playerId: steamId,
    dino: payload.dino,
    species: payload.dino,
    skin: code,
    skinCode: code,
    pattern: payload.pattern_index,
    pattern_index: payload.pattern_index,
    gender: payload.gender,
    skin_variation: payload.skin_variation,
  }).trim();

  if (!command) {
    return {
      applied: false,
      liveReady: false,
      reason: "La plantilla produjo comando vacio.",
    };
  }

  return {
    applied: true,
    liveReady: true,
    command,
    result: await consoleCommand(command),
  };
}

function response(extra) {
  return {
    success: true,
    mode: "oraculo-agent",
    generatedAt: new Date().toISOString(),
    tokenCosts: TOKEN_COSTS,
    ...extra,
  };
}

function currentSkin(params) {
  const store = readStore();
  const steamId = resolveSteamId(params);
  const record = playerRecord(store, steamId);
  const fallback = normalizeSkinPayload(params);
  return response({
    online: false,
    dead: false,
    skin: record.current || fallback,
    tokens: publicPlayer(record),
  });
}

function defaults(params) {
  return response({
    dino: shortText(params.dino || params.species, "Carnotaurus", 64),
    colors: DEFAULT_SKIN_COLORS,
  });
}

function skinConfig() {
  return response({
    maxPresets: Number(process.env.ORACULO_SKIN_MAX_PRESETS || 10),
    colorGroups: SKIN_COLOR_GROUPS,
    patterns: Array.from({ length: Number(process.env.ORACULO_SKIN_PATTERN_COUNT || 3) }, (_item, index) => index),
    genders: [0, 1],
    variation: { min: 0, max: 1, step: 0.01 },
    liveApply: Boolean(process.env.ADMIN_AGENT_CMD_CHANGE_SKIN),
  });
}

function listPresets(params) {
  const store = readStore();
  const steamId = resolveSteamId(params);
  const record = playerRecord(store, steamId);
  return response({
    presets: record.presets,
    tokens: publicPlayer(record),
  });
}

async function saveSkin(body, helpers) {
  const store = readStore();
  const steamId = resolveSteamId(body);
  const record = playerRecord(store, steamId);
  const payload = normalizeSkinPayload(body);
  const now = new Date().toISOString();

  payload.skin_code = skinCode(payload);
  payload.updatedAt = now;
  record.current = payload;
  record.updatedAt = now;
  store.audit.unshift({ at: now, action: "skin-save", steamId, skinCode: payload.skin_code });
  store.audit = store.audit.slice(0, 200);
  writeStore(store);

  const live = await maybeApplySkin({ steamId, payload, consoleCommand: helpers.consoleCommand });
  return response({
    message: live.applied ? "Skin guardada y enviada" : "Skin guardada",
    queued: !live.applied,
    skin: payload,
    tokens: publicPlayer(record),
    live,
  });
}

function savePreset(body) {
  const store = readStore();
  const steamId = resolveSteamId(body);
  const record = playerRecord(store, steamId);
  const maxPresets = Number(process.env.ORACULO_SKIN_MAX_PRESETS || 10);
  const name = shortText(body.preset_name || body.name, "Preset", 32);
  const payload = normalizeSkinPayload(body);
  const now = new Date().toISOString();
  const preset = {
    id: `preset-${crypto.randomUUID()}`,
    name,
    ...payload,
    skin_code: skinCode(payload),
    createdAt: now,
    updatedAt: now,
  };

  record.presets = [preset, ...record.presets.filter((item) => item.name !== name)].slice(0, maxPresets);
  record.updatedAt = now;
  store.audit.unshift({ at: now, action: "preset-save", steamId, name });
  store.audit = store.audit.slice(0, 200);
  writeStore(store);

  return response({
    message: "Preset saved",
    preset,
    presets: record.presets,
    tokens: publicPlayer(record),
  });
}

function deletePreset(body) {
  const store = readStore();
  const steamId = resolveSteamId(body);
  const record = playerRecord(store, steamId);
  const presetName = text(body.preset_name || body.name);
  const presetId = text(body.preset_id || body.id);
  const before = record.presets.length;

  record.presets = record.presets.filter((preset) => {
    if (presetId && preset.id === presetId) return false;
    if (presetName && preset.name === presetName) return false;
    return true;
  });
  record.updatedAt = new Date().toISOString();
  writeStore(store);

  return response({
    message: "Preset deleted",
    deleted: before !== record.presets.length,
    presets: record.presets,
    tokens: publicPlayer(record),
  });
}

function exportSkin(body) {
  const store = readStore();
  const steamId = resolveSteamId(body);
  const record = playerRecord(store, steamId);
  const skin = record.current || normalizeSkinPayload(body);
  return response({
    export: {
      skin_code: skin.skin_code || skinCode(skin),
      skin,
    },
    tokens: publicPlayer(record),
  });
}

function purchase(body) {
  const store = readStore();
  const steamId = resolveSteamId(body);
  const record = playerRecord(store, steamId);
  const amount = Math.max(0, Number(body.amount || body.value || TOKEN_COSTS.purchase));
  record.skinTokens = Number(record.skinTokens || 0) + amount;
  record.updatedAt = new Date().toISOString();
  writeStore(store);

  return response({
    newPoints: record.skinTokens,
    tokens: publicPlayer(record),
  });
}

async function handleSkinEditor(pathname, method, params, body, helpers) {
  if (pathname.endsWith("/current") && method === "GET") return currentSkin(params);
  if (pathname.endsWith("/defaults") && method === "GET") return defaults(params);
  if (pathname.endsWith("/skin-config") && method === "GET") return skinConfig();
  if (pathname.endsWith("/presets") && method === "GET") return listPresets(params);
  if (pathname.endsWith("/preset/save") && method === "POST") return savePreset(body);
  if (pathname.endsWith("/preset/delete") && method === "POST") return deletePreset(body);
  if (pathname.endsWith("/save") && method === "POST") return saveSkin(body, helpers);
  if (pathname.endsWith("/export") && method === "POST") return exportSkin(body);
  if (pathname.endsWith("/purchase") && method === "POST") return purchase(body);

  throw new Error(`Ruta de skins no soportada: ${method} ${pathname}`);
}

module.exports = {
  handleSkinEditor,
  skinConfig,
};
