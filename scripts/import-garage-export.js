#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = process.cwd();
const OUTPUT_DIR = path.join(PROJECT_ROOT, "data", "oraculo-garage");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "garage-data.json");

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  const raw = fs.readFileSync(file, "utf8").trim();
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(`No pude leer JSON valido en ${file}: ${error.message}`);
  }
}

function table(exportDir, name) {
  return readJson(path.join(exportDir, "tables", `${name}.json`), []);
}

function pick(row, names, fallback = null) {
  for (const name of names) {
    if (row && Object.prototype.hasOwnProperty.call(row, name) && row[name] !== null && row[name] !== "") {
      return row[name];
    }
  }
  return fallback;
}

function asNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    return ["1", "true", "yes", "si", "on"].includes(value.trim().toLowerCase());
  }
  return false;
}

function cleanString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim() || fallback;
}

function normalizeSpecies(value) {
  const raw = cleanString(value, "Desconocido");
  return raw
    .replace(/^BP_/i, "")
    .replace(/_C$/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function stableId(prefix, parts) {
  const body = parts
    .map((part) => cleanString(part, "na").replace(/[^a-zA-Z0-9_-]/g, "-"))
    .join("-");
  return `${prefix}-${body}`.replace(/-+/g, "-").toLowerCase();
}

function parseColor(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  const text = String(value).trim();
  if (!text) return null;

  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  const nums = text.match(/-?\d+(\.\d+)?/g)?.map(Number) || [];
  if (nums.length >= 3) {
    return {
      r: nums[0],
      g: nums[1],
      b: nums[2],
      a: nums.length >= 4 ? nums[3] : 1,
    };
  }

  return null;
}

function colorBag(row) {
  const names = [
    "male_display",
    "female_display",
    "body",
    "underbelly",
    "flank",
    "markings",
    "eyes",
    "crest",
    "back",
    "belly",
    "pattern",
  ];
  const colors = {};

  for (const name of names) {
    const direct = parseColor(row[name]);
    if (direct) colors[name] = direct;

    const r = asNumber(row[`${name}_r`], null);
    const g = asNumber(row[`${name}_g`], null);
    const b = asNumber(row[`${name}_b`], null);
    if (r !== null && g !== null && b !== null) {
      colors[name] = {
        r,
        g,
        b,
        a: asNumber(row[`${name}_a`], 1),
      };
    }
  }

  return colors;
}

function convertDinos(rows) {
  return rows
    .map((row, index) => {
      const saveId = pick(row, ["save_id", "saveId", "id"], index + 1);
      const steamId = cleanString(pick(row, ["steam_id", "steamId", "player_steam_id"], ""));
      const species = cleanString(pick(row, ["dino_species", "species", "class"], "Desconocido"));
      const parkedAt = pick(row, ["parked_at", "parkedAt", "created_at"], null);

      return {
        id: stableId("dino", [saveId, steamId, species]),
        saveId: asNumber(saveId, index + 1),
        steamId,
        species,
        displaySpecies: normalizeSpecies(species),
        nickname: cleanString(pick(row, ["nickname", "name", "dino_name"], ""), "Sin nombre"),
        growth: asNumber(pick(row, ["growth", "growth_percent"], 0), 0),
        health: asNumber(pick(row, ["health_percent", "health", "hp"], 0), 0),
        primeElder: asBoolean(pick(row, ["is_prime_elder", "primeElder", "prime_elder"], false)),
        location: {
          x: asNumber(pick(row, ["location_x", "x"], null), null),
          y: asNumber(pick(row, ["location_y", "y"], null), null),
          z: asNumber(pick(row, ["location_z", "z"], null), null),
        },
        parkedAt,
      };
    })
    .sort((a, b) => String(b.parkedAt || "").localeCompare(String(a.parkedAt || "")));
}

function convertWallets(rows) {
  return rows.map((row) => {
    const steamId = cleanString(pick(row, ["steam_id", "steamId", "player_steam_id"], ""));
    return {
      id: stableId("wallet", [steamId || pick(row, ["id"], "unknown")]),
      steamId,
      currency: asNumber(pick(row, ["currency", "coins", "money"], 0), 0),
      alltimeCurrency: asNumber(pick(row, ["alltime_currency", "alltimeCurrency"], 0), 0),
      dinoTokens: asNumber(pick(row, ["dino_tokens", "dinoTokens"], 0), 0),
      apexTokens: asNumber(pick(row, ["apex_tokens", "apexTokens"], 0), 0),
      totalPlayTime: asNumber(pick(row, ["total_playtime", "playtime", "play_time"], null), null),
      lastSeen: pick(row, ["last_seen", "lastSeen", "updated_at"], null),
    };
  });
}

function convertSkins(rows) {
  return rows.map((row, index) => {
    const steamId = cleanString(pick(row, ["steam_id", "steamId", "player_steam_id"], ""));
    const skinName = cleanString(pick(row, ["skin_name", "skinName", "name"], ""), "Skin");
    const skinCode = cleanString(pick(row, ["skin_code", "skinCode", "code", "skin"], ""));

    return {
      id: stableId("skin", [steamId || index + 1, skinCode || skinName]),
      steamId,
      skinName,
      skinCode,
      species: cleanString(pick(row, ["species", "dino_species", "class"], "")),
      amount: asNumber(pick(row, ["amount", "quantity", "count"], 1), 1),
      infinite: asBoolean(pick(row, ["infinite", "is_infinite", "permanent"], false)),
      colors: colorBag(row),
    };
  });
}

function convertPresets(rows) {
  return rows.map((row, index) => {
    const steamId = cleanString(pick(row, ["steam_id", "steamId", "player_steam_id"], ""));
    const name = cleanString(pick(row, ["preset_name", "name", "label"], ""), `Preset ${index + 1}`);

    return {
      id: stableId("preset", [pick(row, ["id", "preset_id"], index + 1), steamId, name]),
      steamId,
      name,
      species: cleanString(pick(row, ["species", "dino_species", "class"], "")),
      colors: colorBag(row),
      createdAt: pick(row, ["created_at", "createdAt"], null),
      updatedAt: pick(row, ["updated_at", "updatedAt"], null),
    };
  });
}

function countUnique(values) {
  return new Set(values.filter(Boolean)).size;
}

function main() {
  const exportDir = process.argv[2];
  if (!exportDir) {
    fail("Uso: node scripts/import-garage-export.js <carpeta-exportada>");
  }

  const resolved = path.resolve(exportDir);
  const manifest = readJson(path.join(resolved, "manifest.json"), null);
  if (!manifest) fail(`No encontre manifest.json en ${resolved}`);
  if (!fs.existsSync(path.join(resolved, "tables"))) fail(`No encontre la carpeta tables en ${resolved}`);

  const garageDinos = convertDinos(table(resolved, "parkeddinos"));
  const wallets = convertWallets(table(resolved, "playerstats"));
  const playerSkins = convertSkins(table(resolved, "player_skins"));
  const skinPresets = convertPresets(table(resolved, "skin_presets"));
  const dailyRewards = table(resolved, "daily_spin_rewards");
  const idLinks = table(resolved, "idsync").map((row, index) => ({
    id: stableId("link", [pick(row, ["id"], index + 1), pick(row, ["steam_id", "steamId"], "")]),
    steamId: cleanString(pick(row, ["steam_id", "steamId"], "")),
    displayName: cleanString(pick(row, ["name", "player_name", "username"], "")),
  }));

  const data = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    totals: {
      players: countUnique([
        ...garageDinos.map((item) => item.steamId),
        ...wallets.map((item) => item.steamId),
        ...playerSkins.map((item) => item.steamId),
      ]),
      garageDinos: garageDinos.length,
      wallets: wallets.length,
      playerSkins: playerSkins.length,
      skinPresets: skinPresets.length,
      dailyRewards: dailyRewards.length,
    },
    garageDinos,
    wallets,
    playerSkins,
    skinPresets,
    dailyRewards,
    idLinks,
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");

  console.log(`ORACULO_GARAGE_DATA=${OUTPUT_FILE}`);
  console.log(`Dinos=${data.totals.garageDinos}`);
  console.log(`Players=${data.totals.players}`);
  console.log(`Skins=${data.totals.playerSkins}`);
  console.log("Done.");
}

main();
