const fs = require("node:fs");
const { execFile } = require("node:child_process");

const DEFAULT_MYSQL_BINS = [
  "C:\\Program Files\\MariaDB 12.3\\bin\\mysql.exe",
  "C:\\Program Files\\MariaDB 12.2\\bin\\mysql.exe",
  "C:\\Program Files\\MariaDB 12.1\\bin\\mysql.exe",
  "C:\\Program Files\\MariaDB 11.4\\bin\\mysql.exe",
  "mysql.exe",
];

const READ_TABLES = {
  parkeddinos: { section: "garage", label: "PrimalCore parked dinos" },
  dinocatalogue: { section: "garage", label: "Dino catalogue" },
  playerstats: { section: "garage", label: "Player wallet/stats" },
  playercooldowns: { section: "garage", label: "Player cooldowns" },
  player_skins: { section: "skins", label: "Player skins" },
  skincatalogue: { section: "skins", label: "Skin catalogue" },
  skin_presets: { section: "skins", label: "Skin presets" },
  playersonline: { section: "admin", label: "Online mirror" },
  player_punishments: { section: "admin", label: "Punishments" },
  token_species_unlocks: { section: "admin", label: "Species unlocks" },
  server_settings: { section: "admin", label: "Server settings" },
};

const SECRET_FIELD_RE = /token|password|secret|key|license|mysql|db_password|discord/i;

function mysqlBin() {
  if (process.env.PRIMALCORE_MYSQL_BIN) return process.env.PRIMALCORE_MYSQL_BIN;
  return DEFAULT_MYSQL_BINS.find((candidate) => candidate === "mysql.exe" || fs.existsSync(candidate)) || "mysql.exe";
}

function dbConfig() {
  return {
    host: process.env.PRIMALCORE_DB_HOST || "127.0.0.1",
    port: Number(process.env.PRIMALCORE_DB_PORT || 3306),
    user: process.env.PRIMALCORE_DB_USER || "",
    password: process.env.PRIMALCORE_DB_PASSWORD || "",
    database: process.env.PRIMALCORE_DB_NAME || "primalcore",
  };
}

function requireDbConfig() {
  const config = dbConfig();
  if (!config.user || !config.password || !config.database) {
    throw new Error("Falta PRIMALCORE_DB_USER/PRIMALCORE_DB_PASSWORD/PRIMALCORE_DB_NAME.");
  }
  if (!Number.isFinite(config.port) || config.port <= 0) {
    throw new Error("PRIMALCORE_DB_PORT no es valido.");
  }
  return config;
}

function sqlString(value) {
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

function requiredSteamId(value) {
  const steamId = String(value || "").trim();
  if (!/^\d{17}$/.test(steamId)) throw new Error("SteamID64 debe tener exactamente 17 digitos.");
  return steamId;
}

function limitNumber(value, fallback = 50, max = 200) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

function runMysql(sql) {
  const config = requireDbConfig();
  const args = [
    "--batch",
    "--raw",
    "--skip-column-names",
    "--default-character-set=utf8mb4",
    "-h",
    config.host,
    "-P",
    String(config.port),
    "-u",
    config.user,
    config.database,
    "-e",
    sql,
  ];

  return new Promise((resolve, reject) => {
    execFile(
      mysqlBin(),
      args,
      {
        timeout: Number(process.env.PRIMALCORE_DB_TIMEOUT_MS || 7000),
        maxBuffer: 1024 * 1024 * 3,
        env: {
          ...process.env,
          MYSQL_PWD: config.password,
        },
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          const detail = stderr ? stderr.trim() : error.message;
          reject(new Error(`MariaDB read-only fallo: ${detail}`));
          return;
        }
        resolve(String(stdout || "").trim());
      },
    );
  });
}

function runMysqlRows(sql) {
  const config = requireDbConfig();
  const args = [
    "--batch",
    "--raw",
    "--default-character-set=utf8mb4",
    "-h",
    config.host,
    "-P",
    String(config.port),
    "-u",
    config.user,
    config.database,
    "-e",
    sql,
  ];

  return new Promise((resolve, reject) => {
    execFile(
      mysqlBin(),
      args,
      {
        timeout: Number(process.env.PRIMALCORE_DB_TIMEOUT_MS || 7000),
        maxBuffer: 1024 * 1024 * 5,
        env: {
          ...process.env,
          MYSQL_PWD: config.password,
        },
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          const detail = stderr ? stderr.trim() : error.message;
          reject(new Error(`MariaDB read-only fallo: ${detail}`));
          return;
        }
        resolve(parseRows(String(stdout || "")));
      },
    );
  });
}

function parseRows(raw) {
  const lines = raw.split(/\r?\n/).filter((line) => line.length);
  if (!lines.length) return [];
  const headers = lines[0].split("\t");
  return lines.slice(1).map((line) => {
    const cells = line.split("\t");
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return sanitizeRow(row);
  });
}

function sanitizeRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, SECRET_FIELD_RE.test(key) ? "***" : value]),
  );
}

async function jsonQuery(sql, fallback) {
  const raw = await runMysql(sql);
  if (!raw || raw === "NULL") return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`MariaDB devolvio JSON invalido: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function jsonArraySelect(innerSql) {
  return `SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT(${innerSql})), JSON_ARRAY())`;
}

function allowedTable(value) {
  const table = String(value || "").trim();
  if (!Object.prototype.hasOwnProperty.call(READ_TABLES, table)) {
    throw new Error(`Tabla no permitida: ${table || "(vacia)"}.`);
  }
  return table;
}

function tableLimit(value) {
  return limitNumber(value, 50, 500);
}

async function tableRows(params = {}) {
  const table = allowedTable(params.table);
  const limit = tableLimit(params.limit);
  const rows = await runMysqlRows(`SELECT * FROM \`${table}\` LIMIT ${limit}`);
  return {
    table,
    section: READ_TABLES[table].section,
    label: READ_TABLES[table].label,
    limit,
    rows,
  };
}

async function tableSchema(params = {}) {
  const table = params.table ? allowedTable(params.table) : "";
  const tables = table ? [table] : Object.keys(READ_TABLES);
  const schema = {};
  for (const tableName of tables) {
    try {
      schema[tableName] = await runMysqlRows(`SHOW COLUMNS FROM \`${tableName}\``);
    } catch (error) {
      schema[tableName] = {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  return {
    tables: Object.keys(READ_TABLES).map((name) => ({ name, ...READ_TABLES[name] })),
    schema,
  };
}

function primalCoreCapabilities() {
  return {
    success: true,
    module: "legacy-db",
    readOnly: true,
    sections: {
      garage: {
        route: "/garage",
        aliases: ["/garaje"],
        readTables: Object.entries(READ_TABLES)
          .filter(([, meta]) => meta.section === "garage")
          .map(([name, meta]) => ({ name, ...meta })),
        notes: [
          "La lectura legacy importa parkeddinos/playerstats desde MariaDB.",
          "El garage vivo de Oraculo usa garage-vault propio y no hereda el limite de 4 mutaciones de PrimalCore.",
        ],
      },
      skins: {
        route: "/skins",
        adminRoute: "/admin/skins",
        readTables: Object.entries(READ_TABLES)
          .filter(([, meta]) => meta.section === "skins")
          .map(([name, meta]) => ({ name, ...meta })),
        notes: [
          "Los presets publicos se separan de la creacion admin.",
          "La cola/live apply usa el motor Oraculo, no depende de copiar codigo de PrimalCore.",
        ],
      },
      admin: {
        route: "/admin",
        readTables: Object.entries(READ_TABLES)
          .filter(([, meta]) => meta.section === "admin")
          .map(([name, meta]) => ({ name, ...meta })),
        notes: [
          "RCON estandar y mapa live quedan centralizados en el agente.",
          "Las acciones destructivas siguen bloqueadas hasta configurar hooks explicitos.",
        ],
      },
    },
    tables: Object.keys(READ_TABLES),
  };
}

async function summary() {
  return jsonQuery(
    `SELECT JSON_OBJECT(
      'parkedDinos', (SELECT COUNT(*) FROM parkeddinos),
      'dinoCatalogue', (SELECT COUNT(*) FROM dinocatalogue),
      'playerStats', (SELECT COUNT(*) FROM playerstats),
      'playerSkins', (SELECT COUNT(*) FROM player_skins),
      'skinCatalogue', (SELECT COUNT(*) FROM skincatalogue),
      'skinPresets', (SELECT COUNT(*) FROM skin_presets),
      'onlineRows', (SELECT COUNT(*) FROM playersonline),
      'punishments', (SELECT COUNT(*) FROM player_punishments),
      'speciesUnlocks', (SELECT COUNT(*) FROM token_species_unlocks)
    ) AS payload`,
    {},
  );
}

async function garage(params = {}) {
  const limit = limitNumber(params.limit, 50, 200);
  const steamId = params.steamId ? requiredSteamId(params.steamId) : "";
  const where = steamId ? `WHERE steam_id=${sqlString(steamId)}` : "";
  return jsonQuery(
    `${jsonArraySelect(`
      'saveId', save_id,
      'steamId', steam_id,
      'species', dino_species,
      'growth', growth + 0,
      'health', health_percent + 0,
      'primeElder', is_prime_elder,
      'x', location_x,
      'y', location_y,
      'z', location_z,
      'nickname', nickname,
      'parkedAt', DATE_FORMAT(parked_at, '%Y-%m-%dT%H:%i:%s')
    `)} FROM (
      SELECT * FROM parkeddinos
      ${where}
      ORDER BY parked_at DESC
      LIMIT ${limit}
    ) rows_for_json`,
    [],
  );
}

async function playerStats(params = {}) {
  const steamId = params.steamId ? requiredSteamId(params.steamId) : "";
  const limit = limitNumber(params.limit, 50, 200);
  const where = steamId ? `WHERE steam_id=${sqlString(steamId)}` : "";
  return jsonQuery(
    `${jsonArraySelect(`
      'steamId', steam_id,
      'discordId', discord_id,
      'currency', currency,
      'alltimeCurrency', alltime_currency,
      'gameKicks', game_kicks,
      'gameBans', game_bans,
      'discordTimeouts', discord_timeouts,
      'discordBans', discord_bans,
      'serverLogin', server_login,
      'dailySpinsUsed', daily_spins_used,
      'dinoTokens', dino_tokens,
      'apexTokens', apex_tokens
    `)} FROM (
      SELECT * FROM playerstats
      ${where}
      ORDER BY currency DESC, alltime_currency DESC
      LIMIT ${limit}
    ) rows_for_json`,
    [],
  );
}

async function playerSkins(params = {}) {
  const limit = limitNumber(params.limit, 50, 200);
  const steamId = params.steamId ? requiredSteamId(params.steamId) : "";
  const where = steamId ? `WHERE steam_id=${sqlString(steamId)}` : "";
  return jsonQuery(
    `${jsonArraySelect(`
      'id', id,
      'steamId', steam_id,
      'skinName', skin_name,
      'skinCode', skin_code,
      'amount', amount,
      'infinite', infinite,
      'obtainedAt', DATE_FORMAT(obtained_at, '%Y-%m-%dT%H:%i:%s'),
      'colors', JSON_OBJECT(
        'male_display', JSON_OBJECT('r', male_display_r, 'g', male_display_g, 'b', male_display_b),
        'markings', JSON_OBJECT('r', markings_r, 'g', markings_g, 'b', markings_b),
        'flank', JSON_OBJECT('r', flank_r, 'g', flank_g, 'b', flank_b),
        'body', JSON_OBJECT('r', body_r, 'g', body_g, 'b', body_b),
        'underbelly', JSON_OBJECT('r', underbelly_r, 'g', underbelly_g, 'b', underbelly_b),
        'eyes', JSON_OBJECT('r', eyes_r, 'g', eyes_g, 'b', eyes_b)
      )
    `)} FROM (
      SELECT * FROM player_skins
      ${where}
      ORDER BY obtained_at DESC
      LIMIT ${limit}
    ) rows_for_json`,
    [],
  );
}

async function catalogue(params = {}) {
  const limit = limitNumber(params.limit, 50, 200);
  const dinos = await jsonQuery(
    `${jsonArraySelect(`
      'catalogueId', catalogue_id,
      'species', dino_species,
      'growth', growth + 0,
      'health', health_percent + 0,
      'primeElder', is_prime_elder,
      'x', location_x,
      'y', location_y,
      'z', location_z,
      'price', price,
      'stock', stock,
      'addedAt', DATE_FORMAT(added_at, '%Y-%m-%dT%H:%i:%s')
    `)} FROM (
      SELECT * FROM dinocatalogue
      ORDER BY added_at DESC
      LIMIT ${limit}
    ) rows_for_json`,
    [],
  );
  const skins = await jsonQuery(
    `${jsonArraySelect(`
      'catalogueId', catalogue_id,
      'presetName', preset_name,
      'skinCode', skin_code,
      'price', price,
      'stock', stock,
      'addedAt', DATE_FORMAT(added_at, '%Y-%m-%dT%H:%i:%s')
    `)} FROM (
      SELECT * FROM skincatalogue
      ORDER BY added_at DESC
      LIMIT ${limit}
    ) rows_for_json`,
    [],
  );
  return { dinos, skins };
}

async function online() {
  return jsonQuery(
    `${jsonArraySelect(`
      'id', id,
      'gamertag', gamertag,
      'steamId', steam_id,
      'species', species
    `)} FROM playersonline ORDER BY id ASC`,
    [],
  );
}

async function playerBundle(params = {}) {
  const steamId = requiredSteamId(params.steamId);
  const [stats, parkedDinos, skins] = await Promise.all([
    playerStats({ steamId, limit: 1 }),
    garage({ steamId, limit: 50 }),
    playerSkins({ steamId, limit: 50 }),
  ]);

  const unlocks = await jsonQuery(
    `${jsonArraySelect(`
      'species', species_name,
      'tokenType', token_type,
      'unlockedAt', DATE_FORMAT(unlocked_at, '%Y-%m-%dT%H:%i:%s'),
      'expiresAt', DATE_FORMAT(expires_at, '%Y-%m-%dT%H:%i:%s'),
      'cooldownExpiresAt', DATE_FORMAT(cooldown_expires_at, '%Y-%m-%dT%H:%i:%s')
    `)} FROM (
      SELECT * FROM token_species_unlocks
      WHERE unlocked_by_steam_id=${sqlString(steamId)}
      ORDER BY unlocked_at DESC
      LIMIT 50
    ) rows_for_json`,
    [],
  );

  return {
    steamId,
    stats: Array.isArray(stats) ? stats[0] || null : null,
    parkedDinos,
    skins,
    unlocks,
  };
}

async function handlePrimalCoreAction(action, params = {}) {
  switch (action) {
    case "capabilities":
      return primalCoreCapabilities();
    case "health":
      return { success: true, module: "legacy-db", readOnly: true, configured: true, summary: await summary() };
    case "summary":
      return { success: true, module: "legacy-db", readOnly: true, summary: await summary() };
    case "garage":
      return { success: true, module: "legacy-db", readOnly: true, garage: await garage(params) };
    case "player":
      return { success: true, module: "legacy-db", readOnly: true, player: await playerBundle(params) };
    case "stats":
      return { success: true, module: "legacy-db", readOnly: true, stats: await playerStats(params) };
    case "skins":
      return { success: true, module: "legacy-db", readOnly: true, skins: await playerSkins(params) };
    case "catalogue":
      return { success: true, module: "legacy-db", readOnly: true, catalogue: await catalogue(params) };
    case "online":
      return { success: true, module: "legacy-db", readOnly: true, online: await online() };
    case "table":
      return { success: true, module: "legacy-db", readOnly: true, ...(await tableRows(params)) };
    case "schema":
      return { success: true, module: "legacy-db", readOnly: true, ...(await tableSchema(params)) };
    case "punishments":
      return { success: true, module: "legacy-db", readOnly: true, ...(await tableRows({ ...params, table: "player_punishments" })) };
    case "unlocks":
      return { success: true, module: "legacy-db", readOnly: true, ...(await tableRows({ ...params, table: "token_species_unlocks" })) };
    case "cooldowns":
      return { success: true, module: "legacy-db", readOnly: true, ...(await tableRows({ ...params, table: "playercooldowns" })) };
    case "skin-presets":
      return { success: true, module: "legacy-db", readOnly: true, ...(await tableRows({ ...params, table: "skin_presets" })) };
    case "server-settings":
      return { success: true, module: "legacy-db", readOnly: true, ...(await tableRows({ ...params, table: "server_settings" })) };
    default:
      throw new Error(`Accion Legacy DB no soportada: ${action}`);
  }
}

module.exports = {
  handlePrimalCoreAction,
  primalCoreCapabilities,
};
