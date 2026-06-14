const fs = require("node:fs");

const SAFE_PRIMALCORE_ENV_RE =
  /AUTO_LOAD_MOD|THEISLE|RCON_(IP|PORT)|DINO_(PARKING|RETRIEVE|SLAY)_LOG|GLOBAL_CHAT|KILL_LOG|IN_GAME_ADMIN_ACTIONS|WIPE_CORPSES|SERVER_|MODERATOR_|REWARD_|LINK_|DELETED_|LILO|SPATIAL|PATH|LOG/i;
const SECRET_ENV_RE = /TOKEN|PASSWORD|SECRET|KEY|LICENSE|DB_|DATABASE|MYSQL|DISCORD/i;

function readEnvFile(file) {
  if (!file || !fs.existsSync(file)) return {};
  const values = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim();
    if (!key) continue;
    if (SECRET_ENV_RE.test(key)) {
      values[key] = "***";
    } else if (SAFE_PRIMALCORE_ENV_RE.test(key)) {
      values[key] = value;
    }
  }
  return values;
}

function fileStatus(file) {
  if (!file) return { configured: false, exists: false };
  return { configured: true, exists: fs.existsSync(file), path: file };
}

function actionStatus(template, actionsEnabled) {
  return {
    enabled: Boolean(actionsEnabled && template),
    configured: Boolean(template),
    requires: actionsEnabled ? "template configurada" : "ADMIN_AGENT_ACTIONS_ENABLED=true",
  };
}

function buildOraculoCapabilities(options = {}) {
  const {
    actionsEnabled = false,
    allowConsole = false,
    commandTemplates = {},
    skinModToken = "",
    skinConfig = {},
    standardRconActions = [],
  } = options;
  const primalCoreEnvPath = process.env.PRIMALCORE_ENV_PATH || "C:\\PrimalCore\\.env";
  const primalCoreEnv = readEnvFile(primalCoreEnvPath);

  return {
    generatedAt: new Date().toISOString(),
    source: "oraculo-admin-agent",
    primalCore: {
      envPath: fileStatus(primalCoreEnvPath),
      safeEnv: primalCoreEnv,
      observedSignals: [
        "parkDinoButton",
        "retrieveDinoButton",
        "slayDinoButton",
        "send-slay",
        "sendSmite",
      ],
      policy: "Compatibilidad observada; no se copia codigo interno de PrimalCore.",
    },
    sections: {
      garage: {
        publicRoute: "/garage",
        aliases: ["/garaje"],
        owner: "player-steam-session",
        active: [
          "private-player-view",
          "legacy-db-player-import",
          "vault-list",
          "vault-save-active",
          "vault-reuse-once",
          "same-species-check",
          "growth-threshold-check",
          "snapshot-location-diet-water-food-health-skin-mutations",
        ],
        rules: {
          saveMinGrowth: Number(process.env.ORACULO_GARAGE_SAVE_MIN_GROWTH || 0.75),
          reuseMaxGrowth: Number(process.env.ORACULO_GARAGE_REUSE_MAX_GROWTH || 0.3),
          reuseOnce: true,
          sameSpecies: true,
          mutationLimit: "oraculo-full-snapshot-no-primalcore-4-mutation-limit",
        },
        liveHooks: {
          killDino: actionStatus(commandTemplates["kill-dino"], actionsEnabled),
          restoreDino: actionStatus(commandTemplates["restore-dino"], actionsEnabled),
        },
        primalCoreCompatibility: {
          reads: ["parkeddinos", "playerstats", "playercooldowns", "dinocatalogue"],
          usesOwnVault: true,
          preservesOverFourMutations: true,
          slayTransport: "pending-hook-confirmation",
        },
      },
      skins: {
        publicRoute: "/skins",
        adminRoute: "/admin/skins",
        owner: "public-presets-plus-admin-creator",
        active: [
          "public-approved-presets",
          "admin-skin-creator",
          "preset-save",
          "preset-delete",
          "export",
          "purchase",
          "admin-queue",
          "legacy-db-player-skins",
        ],
        publicPolicy: "La gente solo aplica presets publicos aprobados; crear skins queda en admin.",
        liveHooks: {
          skinMod: Boolean(skinModToken),
          changeSkin: actionStatus(commandTemplates["change-skin"], actionsEnabled),
        },
        config: skinConfig,
        primalCoreCompatibility: {
          reads: ["player_skins", "skin_presets", "skincatalogue"],
          operatorAssist: true,
          finalEngine: "oraculo-skin-mod",
        },
      },
      admin: {
        publicRoute: "/admin",
        owner: "admin-steam-session-or-admin-token",
        active: [
          "rcon-standard-actions",
          "mapa-live-readonly",
          "legacy-db-readonly",
          "skin-admin-queue",
          "server-control-safe-actions",
          "audited-advanced-hooks",
        ],
        standardRconActions,
        consoleCommand: {
          enabled: Boolean(allowConsole),
          policy: "Solo habilitar temporalmente para pruebas controladas.",
        },
        advancedHooks: Object.fromEntries(
          Object.entries(commandTemplates).map(([action, template]) => [action, actionStatus(template, actionsEnabled)]),
        ),
        primalCoreCompatibility: {
          reads: ["playersonline", "player_punishments", "token_species_unlocks", "server_settings"],
          logs: Object.keys(primalCoreEnv).filter((key) => /LOG|THREAD/i.test(key)),
          serverPaths: {
            exe: primalCoreEnv.THEISLE_EXE_PATH || null,
            log: primalCoreEnv.THEISLE_LOG_PATH || null,
            gameIni: primalCoreEnv.THEISLE_GAMEINI || null,
          },
        },
      },
    },
  };
}

module.exports = {
  buildOraculoCapabilities,
};
