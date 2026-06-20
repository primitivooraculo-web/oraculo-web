const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const STORE_VERSION = 1;

function storePath() {
  return process.env.ORACULO_GARAGE_VAULT_PATH || path.join(process.cwd(), "data", "garage-vault.json");
}

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function emptyStore() {
  return {
    schemaVersion: STORE_VERSION,
    saves: [],
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
      saves: Array.isArray(parsed.saves) ? parsed.saves : [],
      audit: Array.isArray(parsed.audit) ? parsed.audit : [],
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store) {
  const file = storePath();
  ensureDir(file);
  fs.writeFileSync(file, JSON.stringify(store, null, 2), "utf8");
}

function audit(store, action, steamId, details = {}) {
  store.audit.unshift({
    at: new Date().toISOString(),
    action,
    steamId,
    ...details,
  });
  store.audit = store.audit.slice(0, 500);
}

function requiredSteamId(value) {
  const steamId = String(value || "").trim();
  if (!/^\d{17}$/.test(steamId)) throw new Error("SteamID64 invalido.");
  return steamId;
}

function requiredText(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`Falta ${label}.`);
  return text;
}

function fraction(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n > 1 ? n / 100 : n));
}

function configuredFraction(name, fallback) {
  const n = Number(process.env[name]);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n > 1 ? n / 100 : n));
}

function saveMinGrowth() {
  return configuredFraction("ORACULO_GARAGE_SAVE_MIN_GROWTH", 0.75);
}

function reuseMaxGrowth() {
  return configuredFraction("ORACULO_GARAGE_REUSE_MAX_GROWTH", 0.3);
}

function speciesLabel(player) {
  return String(player?.class || player?.species || player?.dino || "Desconocido").trim() || "Desconocido";
}

function speciesKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^bp[_-]?/i, "")
    .replace(/[_-]?c$/i, "")
    .replace(/[^a-z0-9]/g, "");
}

function compactPlayer(player) {
  return {
    name: player?.name || null,
    steam_id: player?.steam_id || null,
    gender: player?.gender || null,
    location: player?.location || null,
    class: player?.class || null,
    growth: player?.growth ?? null,
    health: player?.health ?? null,
    stamina: player?.stamina ?? null,
    hunger: player?.hunger ?? null,
    thirst: player?.thirst ?? null,
    diet: player?.diet || null,
    vitamins: player?.vitamins || null,
    mutations: player?.mutations || null,
    prime_elder: Boolean(player?.prime_elder),
    skin: player?.skin || player?.skin_code || null,
  };
}

function buildSnapshot(steamId, player, extras = {}) {
  const species = speciesLabel(player);
  return {
    version: STORE_VERSION,
    capturedAt: new Date().toISOString(),
    steamId,
    species,
    speciesKey: speciesKey(species),
    growth: fraction(player?.growth),
    health: fraction(player?.health),
    stamina: fraction(player?.stamina),
    hunger: fraction(player?.hunger),
    thirst: fraction(player?.thirst),
    location: player?.location || null,
    diet: player?.diet || null,
    vitamins: player?.vitamins || null,
    mutations: player?.mutations || null,
    primeElder: Boolean(player?.prime_elder),
    skin: player?.skin || player?.skin_code || extras.skin || null,
    player: compactPlayer(player),
    extras,
  };
}

function publicSave(record) {
  return {
    id: record.id,
    steamId: record.steamId,
    species: record.snapshot.species,
    growth: record.snapshot.growth,
    health: record.snapshot.health,
    stamina: record.snapshot.stamina,
    hunger: record.snapshot.hunger,
    thirst: record.snapshot.thirst,
    location: record.snapshot.location,
    diet: record.snapshot.diet,
    mutations: record.snapshot.mutations,
    primeElder: record.snapshot.primeElder,
    hasSkin: Boolean(record.snapshot.skin),
    capturedAt: record.snapshot.capturedAt,
    used: Boolean(record.used),
    usedAt: record.usedAt || null,
    status: record.used ? "used" : "available",
  };
}

// 🚀 LA MAGIA FINAL: Prioriza las mutaciones de la web antes que el snapshot viejo
function restorePayload(record, currentPlayer, webMutations = null, webDiet = null) {
  const snapshot = record.snapshot;
  const location = snapshot.location || {};
  
  const finalMutations = (Array.isArray(webMutations) && webMutations.length > 0) ? webMutations : (snapshot.mutations || []);
  const finalDiet = webDiet ? webDiet : (snapshot.diet || {});
  
  return {
    saveId: record.id,
    steamId: record.steamId,
    species: snapshot.species,
    currentSpecies: speciesLabel(currentPlayer),
    x: location.x,
    y: location.y,
    z: location.z,
    growth: snapshot.growth,
    health: snapshot.health,
    stamina: snapshot.stamina,
    hunger: snapshot.hunger,
    thirst: snapshot.thirst,
    gender: snapshot.player?.gender || "",
    primeElder: snapshot.primeElder ? "true" : "false",
    skin: snapshot.skin || "",
    skinCode: snapshot.skin?.skin_code || snapshot.skin?.skinCode || snapshot.skin || "",
    dietJson: JSON.stringify(finalDiet),
    vitaminsJson: JSON.stringify(snapshot.vitamins || {}),
    // Esto arma el array infinito sin importar el límite vanilla de 3
    mutationsJson: JSON.stringify(finalMutations),
    snapshotJson: JSON.stringify(snapshot),
  };
}

async function listSaves(params = {}) {
  const steamId = requiredSteamId(params.steamId);
  const store = readStore();
  const saves = store.saves
    .filter((record) => record.steamId === steamId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map(publicSave);

  return {
    success: true,
    module: "garage-vault",
    rules: {
      saveMinGrowth: saveMinGrowth(),
      reuseMaxGrowth: reuseMaxGrowth(),
      reuseOnce: true,
      sameSpecies: true,
    },
    saves,
  };
}

async function saveActive(params = {}, deps = {}) {
  const steamId = requiredSteamId(params.steamId);
  if (typeof deps.getPlayerData !== "function") throw new Error("getPlayerData no disponible.");
  if (typeof deps.killDino !== "function") throw new Error("killDino no disponible.");

  const player = await deps.getPlayerData(steamId);
  if (!player) throw new Error("No se encontro dino activo para ese SteamID.");

  const growth = fraction(player.growth);
  const min = saveMinGrowth();
  if (growth < min) {
    throw new Error(`Para guardar necesitas al menos ${Math.round(min * 100)}% de growth.`);
  }

  const snapshot = buildSnapshot(steamId, player, params.extras || {});
  const killResult = await deps.killDino({
    action: "kill-dino",
    steamId,
    species: snapshot.species,
    growth: snapshot.growth,
    x: snapshot.location?.x ?? "",
    y: snapshot.location?.y ?? "",
    z: snapshot.location?.z ?? "",
    reason: "Garage save",
    snapshotJson: JSON.stringify(snapshot),
  });

  const store = readStore();
  const record = {
    id: `garage-save-${crypto.randomUUID()}`,
    steamId,
    createdAt: new Date().toISOString(),
    used: false,
    usedAt: null,
    snapshot,
    killResult,
  };
  store.saves.unshift(record);
  audit(store, "save-active", steamId, { saveId: record.id, species: snapshot.species });
  writeStore(store);

  return {
    success: true,
    module: "garage-vault",
    save: publicSave(record),
    killResult,
  };
}

async function reuseSave(params = {}, deps = {}) {
  const steamId = requiredSteamId(params.steamId);
  const saveId = requiredText(params.saveId || params.id, "saveId");
  if (typeof deps.getPlayerData !== "function") throw new Error("getPlayerData no disponible.");
  if (typeof deps.restoreDino !== "function") throw new Error("restoreDino no disponible.");

  const store = readStore();
  const record = store.saves.find((item) => item.id === saveId && item.steamId === steamId);
  if (!record) throw new Error("Dinosaurio guardado no encontrado.");
  if (record.used) throw new Error("Este dinosaurio guardado ya fue reutilizado.");

  const current = await deps.getPlayerData(steamId);
  if (!current) throw new Error("No se encontro dino activo para reutilizar.");

  const currentSpecies = speciesLabel(current);
  if (speciesKey(currentSpecies) !== record.snapshot.speciesKey) {
    throw new Error(`Debes estar usando la misma especie: ${record.snapshot.species}.`);
  }

  const currentGrowth = fraction(current.growth);
  const max = reuseMaxGrowth();
  if (currentGrowth >= max) {
    throw new Error(`Solo puedes reutilizar antes del ${Math.round(max * 100)}% de growth.`);
  }

  // 🚀 EXTRAE LAS MUTACIONES Y DIETA DEL MENSAJERO Y SE LAS PASA A LA FUNCIÓN
  const payload = restorePayload(record, current, params.mutations, params.diet);
  const restoreResult = await deps.restoreDino({
    action: "restore-dino",
    ...payload,
  });

  record.used = true;
  record.usedAt = new Date().toISOString();
  record.reuseResult = restoreResult;
  audit(store, "reuse", steamId, { saveId: record.id, species: record.snapshot.species });
  writeStore(store);

  return {
    success: true,
    module: "garage-vault",
    save: publicSave(record),
    restoreResult,
  };
}

async function handleGarageVaultAction(action, params = {}, deps = {}) {
  switch (action) {
    case "list":
    case "saves":
      return listSaves(params);
    case "save":
    case "save-active":
      return saveActive(params, deps);
    case "reuse":
    case "reuse-save":
      return reuseSave(params, deps);
    default:
      throw new Error(`Accion garage-vault no soportada: ${action}`);
  }
}

module.exports = {
  handleGarageVaultAction,
};