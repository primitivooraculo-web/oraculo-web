"use client";

import { useMemo, useState } from "react";

type AdminTab =
  | "overview"
  | "live"
  | "players"
  | "garage"
  | "skins"
  | "server"
  | "systems"
  | "videos"
  | "audit";

type AdminPlayer = {
  id: string;
  steamId: string;
  name: string;
  species: string;
  growth: number;
  health: number;
  stamina: number;
  hunger: number;
  thirst: number;
  diet?: AdminDiet | null;
  x: number;
  y: number;
  z: number;
  status: "online" | "pending" | "offline";
  relation: "self" | "friend" | "admin" | "unknown";
  raw?: string;
  confidence?: string;
};

type AdminDiet = {
  carbs: number | null;
  protein: number | null;
  lipid: number | null;
  vitamins?: {
    A: number | null;
    B: number | null;
    Y: number | null;
    G: number | null;
  } | null;
};

type RconPlayerData = {
  name?: string | null;
  steam_id?: string | null;
  gender?: string | null;
  location?: {
    x?: number | null;
    y?: number | null;
    z?: number | null;
  } | null;
  class?: string | null;
  growth?: number | null;
  health?: number | null;
  stamina?: number | null;
  hunger?: number | null;
  thirst?: number | null;
  diet?: AdminDiet | null;
  vitamins?: AdminDiet["vitamins"];
};

type OraculoLivePlayer = {
  id?: string;
  steamId?: string;
  name?: string;
  species?: string;
  growth?: number;
  health?: number;
  stamina?: number;
  hunger?: number;
  thirst?: number;
  diet?: AdminDiet | null;
  x?: number;
  y?: number;
  z?: number;
  status?: "online" | "pending" | "offline";
  relation?: "self" | "friend" | "unknown";
  confidence?: string;
};

type OraculoLiveSnapshot = {
  generatedAt?: string;
  viewer?: {
    steamId?: string | null;
    linked?: boolean;
  };
  server?: {
    name?: string;
    linked?: boolean;
    map?: string;
    onlinePlayers?: number;
    maxPlayers?: number;
    positionMode?: string;
  };
  activePlayer?: OraculoLivePlayer;
  mapPlayers?: OraculoLivePlayer[];
  friends?: OraculoLivePlayer[];
  heatZones?: Array<{
    id: string;
    label: string;
    x: number;
    y: number;
    size: number;
    intensity: string;
  }>;
};

type LegacyDbSummary = {
  parkedDinos?: number;
  dinoCatalogue?: number;
  playerStats?: number;
  playerSkins?: number;
  skinCatalogue?: number;
  skinPresets?: number;
  onlineRows?: number;
  punishments?: number;
  speciesUnlocks?: number;
};

type LegacyGarageDino = {
  saveId?: number;
  steamId?: string;
  species?: string;
  growth?: number;
  health?: number;
  primeElder?: number | boolean;
  x?: number;
  y?: number;
  z?: number;
  nickname?: string | null;
  parkedAt?: string | null;
};

type SkinQueueJob = {
  id: string;
  steamId: string;
  dino?: string;
  skin_code?: string;
  status: "pending" | "claimed" | "applied" | "failed" | string;
  attempts?: number;
  createdAt?: string;
  updatedAt?: string;
  lastError?: string | null;
  pattern_index?: number;
  gender?: number;
  skin_variation?: number;
  colors?: Record<string, { r: number; g: number; b: number; a: number }>;
};

type CommandAction =
  | "announce"
  | "direct-message"
  | "kick"
  | "ban"
  | "save-server"
  | "console-command"
  | "player-list"
  | "player-data"
  | "server-details"
  | "queue-status"
  | "playables"
  | "add-whitelist"
  | "remove-whitelist"
  | "toggle-whitelist"
  | "toggle-global-chat"
  | "pause-server"
  | "toggle-ai"
  | "toggle-ai-learning"
  | "toggle-migrations"
  | "toggle-humans"
  | "toggle-net-distance-checks"
  | "wipe-corpses"
  | "ai-density"
  | "set-growth-multiplier"
  | "toggle-growth-multiplier"
  | "disable-ai-classes"
  | "update-playables";

const DEMO_PLAYERS: AdminPlayer[] = [
  {
    id: "demo-self",
    steamId: "sin-vincular",
    name: "Dino no detectado",
    species: "Sin especie vinculada",
    growth: 0,
    health: 0,
    stamina: 0,
    hunger: 0,
    thirst: 0,
    x: 466878,
    y: -106057,
    z: 26215,
    status: "pending",
    relation: "self",
  },
  {
    id: "demo-scout",
    steamId: "requiere-rcon",
    name: "Jugador RCON",
    species: "Esperando player list",
    growth: 0,
    health: 0,
    stamina: 0,
    hunger: 0,
    thirst: 0,
    x: 52,
    y: 38,
    z: 0,
    status: "pending",
    relation: "unknown",
  },
];

const TABS: { id: AdminTab; label: string }[] = [
  { id: "overview", label: "Mando" },
  { id: "live", label: "Mapa Live" },
  { id: "players", label: "Jugadores" },
  { id: "garage", label: "Garage DB" },
  { id: "skins", label: "Skins" },
  { id: "server", label: "Servidor" },
  { id: "systems", label: "Sistemas" },
  { id: "videos", label: "Guias" },
  { id: "audit", label: "Auditoria" },
];

const ACTIVE_CAPABILITIES = [
  "Mapa via agente",
  "Anuncio global",
  "Mensaje directo",
  "Kick por SteamID",
  "Ban RCON",
  "Whitelist",
  "Guardar servidor",
  "Server details",
  "World toggles",
  "AI density",
  "Growth multiplier",
  "Wipe corpses",
  "Lista de jugadores",
  "Ficha de dino online",
  "Garage read-only",
  "Skins queue",
  "Economia read-only",
];

const BACKEND_PENDING = [
  "Ban persistente",
  "Teleport",
  "Start/stop/restart",
  "Migracion DB propia",
  "Gacha DB propia",
  "Quests DB",
  "Weather hook",
  "Spawn manager hook",
  "Server link API",
];

const PHASE_ONE_MODULES = [
  ["Mapa", "Agente read-only"],
  ["Players", "Activo RCON"],
  ["Moderacion", "Activo RCON"],
  ["Whitelist", "Activo RCON"],
  ["World Controls", "Activo RCON"],
  ["Cosmeticos", "Contrato API"],
  ["Garage DB", "Bridge read-only"],
] as const;

const MAPA_LIVE_SIGNALS = [
  "Lectura segura del mapa",
  "Amigos vinculados",
  "Sesion Steam",
  "Marcadores online",
  "Solo lectura desde admin",
  "Subpagina mapa separada",
];

const ORACULO_DINO_ASSETS = [
  ["rex", "/oraculo/rex.png"],
  ["deino", "/oraculo/deinosuchus.png"],
  ["pachy", "/oraculo/Pachy.png"],
  ["stego", "/oraculo/Stegosaurus.png"],
  ["tricera", "/oraculo/triceratops-walk.gif"],
  ["carno", "/oraculo/carnotaurus.png"],
  ["cerato", "/oraculo/cerato.png"],
  ["dilo", "/oraculo/dilo.png"],
  ["tenonto", "/oraculo/tenonto.png"],
  ["omni", "/oraculo/omni.png"],
  ["ptera", "/oraculo/pteranodon.png"],
] as const;

const GUIDE_CARDS = [
  {
    module: "Mapa Live",
    note: "Lectura operativa del mapa sin tocar la subpagina principal.",
  },
  {
    module: "Admin Panel",
    note: "Centro de mando para jugadores, RCON, auditoria y acciones confirmadas.",
  },
  {
    module: "Cosmeticos",
    note: "Base preparada para presets, paletas, export y aplicacion live cuando el hook exista.",
  },
  {
    module: "Garage",
    note: "Inventario, tokens y swaps quedan listos para enlazar con DB real.",
  },
];

const MODULES = [
  {
    name: "Players",
    state: "Activo via RCON",
    details: "Listar, leer ficha, DM y kick.",
  },
  {
    name: "Live Map",
    state: "Agente read-only",
    details: "Espejo seguro del mapa; la subpagina y la telemetria quedan separadas.",
  },
  {
    name: "Server Control",
    state: "RCON ampliado",
    details: "Save, serverdetails, queue, whitelist, AI, migraciones, corpses y growth multiplier.",
  },
  {
    name: "Cosmeticos",
    state: "Contrato API",
    details: "Base de skins lista; aplicar cambios en vivo requiere hook confirmado.",
  },
  {
    name: "Economia",
    state: "Bridge read-only",
    details: "Tokens, garage, stats y skins se leen desde MariaDB local mientras se migra a Oraculo.",
  },
  {
    name: "Config",
    state: "Preparado",
    details: "Estructura visual para teleports, limites, comandos, weather y spawn.",
  },
  {
    name: "Audit",
    state: "Local UI",
    details: "El log persistente debe conectarse a base de datos o servicio admin.",
  },
];

function clampMetric(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value <= 1) return Math.round(value * 100);
  return Math.max(0, Math.min(100, Math.round(value)));
}

function metricLabel(value: number) {
  return `${clampMetric(value)}%`;
}

function dietLabel(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  return metricLabel(Number(value));
}

function mapPoint(player: AdminPlayer) {
  if (Math.abs(player.x) <= 100 && Math.abs(player.y) <= 100) {
    return { left: `${Math.max(5, Math.min(95, player.x))}%`, top: `${Math.max(5, Math.min(95, player.y))}%` };
  }

  const left = 46.35 + (player.x - -40040.547) / 8480;
  const top = 59.4 + (player.y - 114225.422) / 13670;
  return {
    left: `${Math.max(5, Math.min(95, left))}%`,
    top: `${Math.max(7, Math.min(93, top))}%`,
  };
}

function dinoAsset(species: string) {
  const value = species.toLowerCase();
  const found = ORACULO_DINO_ASSETS.find(([key]) => value.includes(key));
  return found?.[1] || "";
}

function normalizeLiveNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatOutput(data: unknown) {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

function commandFieldLabel(action: CommandAction) {
  if (action === "ban") return "Nombre del jugador";
  if (action === "ai-density" || action === "set-growth-multiplier") return "Valor numerico";
  if (action === "disable-ai-classes") return "Clases AI";
  if (action === "update-playables") return "Dinos permitidos";
  if (action === "console-command") return "Console command";
  return "Parametro opcional";
}

function commandFieldPlaceholder(action: CommandAction) {
  if (action === "ban") return "Nombre exacto del jugador para ban";
  if (action === "ai-density") return "Ejemplo: 0.5";
  if (action === "set-growth-multiplier") return "Ejemplo: 2.0";
  if (action === "disable-ai-classes") return "Ejemplo: Deer,Boar,Rabbit";
  if (action === "update-playables") return "Ejemplo: Carnotaurus,Stegosaurus";
  if (action === "console-command") return "Comando exacto del servidor";
  return "Solo si la accion lo requiere";
}

export default function AdminPanelClient() {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [players, setPlayers] = useState<AdminPlayer[]>(DEMO_PLAYERS);
  const [selectedId, setSelectedId] = useState(DEMO_PLAYERS[0].id);
  const [liveSnapshot, setLiveSnapshot] = useState<OraculoLiveSnapshot | null>(null);
  const [liveStatus, setLiveStatus] = useState("Mapa Live sin sincronizar.");
  const [legacySummary, setLegacySummary] = useState<LegacyDbSummary | null>(null);
  const [garageDinos, setGarageDinos] = useState<LegacyGarageDino[]>([]);
  const [garageStatus, setGarageStatus] = useState("Garage DB sin leer.");
  const [garageBusy, setGarageBusy] = useState(false);
  const [skinJobs, setSkinJobs] = useState<SkinQueueJob[]>([]);
  const [skinStatus, setSkinStatus] = useState("Cola de skins sin leer.");
  const [skinBusy, setSkinBusy] = useState(false);
  const [action, setAction] = useState<CommandAction>("player-list");
  const [steamId, setSteamId] = useState("");
  const [message, setMessage] = useState("");
  const [command, setCommand] = useState("");
  const [busy, setBusy] = useState(false);
  const [liveBusy, setLiveBusy] = useState(false);
  const [output, setOutput] = useState("Panel listo. Sesion admin protegida activa.");
  const [audit, setAudit] = useState<string[]>([
    "Sistema armado como drop-in sin tocar telemetria.",
    "Acciones admin via agente separado OVH.",
    "Mapa enlazado al agente en modo lectura.",
  ]);

  const selectedPlayer = useMemo(
    () => players.find((player) => player.id === selectedId) || players[0],
    [players, selectedId],
  );

  const onlineCount = players.filter((player) => player.status === "online").length;
  const riskCount = players.filter((player) => player.health < 35 || player.hunger < 25 || player.thirst < 25).length;
  const liveMapName = liveSnapshot?.server?.map || "Gateway";
  const liveServerLabel = liveSnapshot?.server?.linked ? "Servidor enlazado" : "Servidor sin enlace seguro";

  function normalizeLivePlayer(item: OraculoLivePlayer, index: number, fallbackRelation: AdminPlayer["relation"]): AdminPlayer {
    const id = item.id || item.steamId || `live-${index}`;
    const relation =
      item.relation === "self" || item.relation === "friend"
        ? item.relation
        : fallbackRelation;

    return {
      id,
      steamId: item.steamId || item.id || "sin-steamid",
      name: item.name || (relation === "self" ? "Dino no detectado" : `Live ${index + 1}`),
      species: item.species || "Sin especie vinculada",
      growth: normalizeLiveNumber(item.growth),
      health: normalizeLiveNumber(item.health),
      stamina: normalizeLiveNumber(item.stamina),
      hunger: normalizeLiveNumber(item.hunger),
      thirst: normalizeLiveNumber(item.thirst),
      diet: item.diet || null,
      x: normalizeLiveNumber(item.x),
      y: normalizeLiveNumber(item.y),
      z: normalizeLiveNumber(item.z),
      status: item.status || "pending",
      relation,
      confidence: item.confidence || "",
      raw: item.confidence ? `Mapa Live confianza=${item.confidence}` : "Mapa Live",
    };
  }

  function normalizeLiveSnapshot(snapshot: OraculoLiveSnapshot) {
    const next: AdminPlayer[] = [];
    const seen = new Set<string>();

    function add(player: OraculoLivePlayer | undefined, relation: AdminPlayer["relation"]) {
      if (!player) return;
      const normalized = normalizeLivePlayer(player, next.length, relation);
      if (seen.has(normalized.id)) return;
      seen.add(normalized.id);
      next.push(normalized);
    }

    add(snapshot.activePlayer, "self");
    (snapshot.mapPlayers || []).forEach((player) => add(player, player.relation || "unknown"));
    (snapshot.friends || []).forEach((player) => add(player, "friend"));

    return next;
  }

  async function syncOraculoLive() {
    setLiveBusy(true);

    try {
      const resp = await fetch("/api/admin/agent?op=mapa-live", {
        cache: "no-store",
      });
      const data = await resp.json();
      if (!resp.ok || data?.success === false) {
        throw new Error(data?.error || `Mapa via agente respondio HTTP ${resp.status}`);
      }

      const snapshot = (data?.snapshot || data) as OraculoLiveSnapshot;
      setLiveSnapshot(snapshot);

      const normalized = normalizeLiveSnapshot(snapshot);
      if (normalized.length > 0) {
        setPlayers(normalized);
        setSelectedId(normalized[0].id);
      }

      const server = snapshot.server;
      const status = `${server?.name || "Refugio Primitivo"} / ${server?.map || "Gateway"} / ${server?.onlinePlayers ?? "-"} de ${server?.maxPlayers ?? 200}`;
      setLiveStatus(status);
      setOutput(formatOutput(data));
      setAudit((items) => [`${new Date().toLocaleTimeString()} mapa live leido via agente`, ...items].slice(0, 12));
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setLiveStatus(text);
      setAudit((items) => [`${new Date().toLocaleTimeString()} mapa live ERROR: ${text}`, ...items].slice(0, 12));
    } finally {
      setLiveBusy(false);
    }
  }

  async function syncLegacyGarage(targetSteamId?: string) {
    setGarageBusy(true);

    try {
      const params = new URLSearchParams({ op: "legacy-garage", limit: "75" });
      if (targetSteamId?.trim()) params.set("steamId", targetSteamId.trim());
      const [summaryResp, garageResp] = await Promise.all([
        fetch("/api/admin/agent?op=legacy-summary", { cache: "no-store" }),
        fetch(`/api/admin/agent?${params.toString()}`, { cache: "no-store" }),
      ]);

      const summaryData = await summaryResp.json();
      const garageData = await garageResp.json();
      if (!summaryResp.ok || summaryData?.success === false) {
        throw new Error(summaryData?.error || `Legacy summary HTTP ${summaryResp.status}`);
      }
      if (!garageResp.ok || garageData?.success === false) {
        throw new Error(garageData?.error || `Legacy garage HTTP ${garageResp.status}`);
      }

      const summary = (summaryData.summary || {}) as LegacyDbSummary;
      const rows = Array.isArray(garageData.garage) ? garageData.garage as LegacyGarageDino[] : [];
      setLegacySummary(summary);
      setGarageDinos(rows);
      setGarageStatus(`${rows.length} dinos guardados leidos / ${summary.parkedDinos ?? 0} total`);
      setOutput(formatOutput({ readOnly: true, summary, garage: rows.slice(0, 10) }));
      setAudit((items) => [`${new Date().toLocaleTimeString()} garage DB read-only OK`, ...items].slice(0, 12));
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setGarageStatus(text);
      setOutput(text);
      setAudit((items) => [`${new Date().toLocaleTimeString()} garage DB ERROR: ${text}`, ...items].slice(0, 12));
    } finally {
      setGarageBusy(false);
    }
  }

  async function syncSkinQueue(targetSteamId?: string) {
    setSkinBusy(true);

    try {
      const params = new URLSearchParams({ op: "skin-jobs", limit: "75" });
      if (targetSteamId?.trim()) params.set("steamId", targetSteamId.trim());
      const resp = await fetch(`/api/admin/agent?${params.toString()}`, { cache: "no-store" });
      const data = await resp.json();
      if (!resp.ok || data?.success === false) {
        throw new Error(data?.error || `Skin queue HTTP ${resp.status}`);
      }

      const jobs = Array.isArray(data.jobs) ? data.jobs as SkinQueueJob[] : [];
      const totals = data.totals || {};
      setSkinJobs(jobs);
      setSkinStatus(`${jobs.length} trabajos / pendientes ${totals.pending ?? 0} / aplicados ${totals.applied ?? 0} / fallidos ${totals.failed ?? 0}`);
      setOutput(formatOutput(data));
      setAudit((items) => [`${new Date().toLocaleTimeString()} skins queue OK`, ...items].slice(0, 12));
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setSkinStatus(text);
      setOutput(text);
      setAudit((items) => [`${new Date().toLocaleTimeString()} skins queue ERROR: ${text}`, ...items].slice(0, 12));
    } finally {
      setSkinBusy(false);
    }
  }

  async function updateSkinJob(job: SkinQueueJob, status: "applied" | "failed" | "pending") {
    setSkinBusy(true);

    try {
      const data = await callAdmin({
        action: "skin-ack",
        jobId: job.id,
        status,
        message: status === "applied" ? "Aplicado por operador admin." : status === "failed" ? "Marcado fallido por operador admin." : "Devuelto a pendiente.",
      });
      setOutput(formatOutput(data));
      setAudit((items) => [`${new Date().toLocaleTimeString()} skin ${status}: ${job.steamId}`, ...items].slice(0, 12));
      await syncSkinQueue(steamId);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setOutput(text);
      setAudit((items) => [`${new Date().toLocaleTimeString()} skin ${status} ERROR: ${text}`, ...items].slice(0, 12));
    } finally {
      setSkinBusy(false);
    }
  }

  async function copySkinJob(job: SkinQueueJob) {
    const text = formatOutput({
      steamId: job.steamId,
      dino: job.dino,
      skin_code: job.skin_code,
      pattern_index: job.pattern_index,
      gender: job.gender,
      skin_variation: job.skin_variation,
      colors: job.colors,
    });

    try {
      await navigator.clipboard.writeText(text);
      setAudit((items) => [`${new Date().toLocaleTimeString()} skin copiada: ${job.steamId}`, ...items].slice(0, 12));
    } catch {
      setOutput(text);
    }
  }

  async function callAdmin(payload: Record<string, unknown>) {
    const resp = await fetch("/api/admin/agent", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok || data?.success === false) {
      throw new Error(data?.error || `Error HTTP ${resp.status}`);
    }
    return data;
  }

  async function logoutAdmin() {
    await fetch("/api/admin/session", { method: "DELETE" });
    window.location.href = "/admin/login";
  }

  function normalizePlayers(data: any): AdminPlayer[] {
    const incoming = Array.isArray(data?.players) ? data.players : [];
    if (!incoming.length) return players;

    return incoming.map((item: any, index: number) => {
      const id = item.steamId || `rcon-${index}`;
      return {
        id,
        steamId: item.steamId || "sin-steamid",
        name: item.name || `Jugador ${index + 1}`,
        species: "RCON player list",
        growth: 0,
        health: 100,
        stamina: 100,
        hunger: 100,
        thirst: 100,
        diet: null,
        x: 12 + ((index * 17) % 76),
        y: 18 + ((index * 13) % 68),
        z: 0,
        status: "online",
        relation: "unknown",
        raw: item.line,
      } satisfies AdminPlayer;
    });
  }

  async function runAction(overrideAction?: CommandAction, overrideSteamId?: string) {
    const nextAction = overrideAction || action;
    setBusy(true);

    try {
      const payload: Record<string, unknown> = { action: nextAction };
      const targetSteamId = overrideSteamId || steamId;
      if (targetSteamId.trim()) payload.steamId = targetSteamId.trim();
      if (message.trim()) payload.message = message.trim();
      if (command.trim()) payload.command = command.trim();
      if (nextAction === "kick" && message.trim()) payload.reason = message.trim();
      if (nextAction === "ban" && message.trim()) payload.reason = message.trim();
      if (nextAction === "ban" && command.trim()) payload.playerName = command.trim();
      if ((nextAction === "ai-density" || nextAction === "set-growth-multiplier") && command.trim()) {
        payload.value = command.trim();
      }
      if (nextAction === "disable-ai-classes" && command.trim()) payload.classList = command.trim();
      if (nextAction === "update-playables" && command.trim()) payload.dinoList = command.trim();

      const data = await callAdmin(payload);
      setOutput(formatOutput(data));
      setAudit((items) => [`${new Date().toLocaleTimeString()} ${nextAction} OK`, ...items].slice(0, 12));

      if (nextAction === "player-list" && Array.isArray(data.players)) {
        const normalized = normalizePlayers(data);
        setPlayers(normalized);
        setSelectedId(normalized[0]?.id || selectedId);
      }

      if (nextAction === "player-data" && data.player) {
        const player = normalizeRconPlayerData(data.player, targetSteamId || selectedPlayer.steamId);
        setPlayers((items) => {
          const exists = items.some((item) => item.steamId === player.steamId);
          if (!exists) return [player, ...items];
          return items.map((item) => (item.steamId === player.steamId ? { ...item, ...player } : item));
        });
        setSelectedId(player.id);
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setOutput(text);
      setAudit((items) => [`${new Date().toLocaleTimeString()} ${nextAction} ERROR: ${text}`, ...items].slice(0, 12));
    } finally {
      setBusy(false);
    }
  }

  function normalizeRconPlayerData(player: RconPlayerData, fallbackSteamId: string): AdminPlayer {
    const steam = player.steam_id || fallbackSteamId || "sin-steamid";
    const location = player.location || {};

    return {
      id: steam,
      steamId: steam,
      name: player.name || steam,
      species: player.class || "RCON playerdata",
      growth: normalizeLiveNumber(player.growth),
      health: normalizeLiveNumber(player.health),
      stamina: normalizeLiveNumber(player.stamina),
      hunger: normalizeLiveNumber(player.hunger),
      thirst: normalizeLiveNumber(player.thirst),
      diet: player.diet || (player.vitamins ? {
        carbs: player.vitamins.A ?? null,
        protein: player.vitamins.B ?? null,
        lipid: player.vitamins.Y ?? player.vitamins.G ?? null,
        vitamins: player.vitamins,
      } : null),
      x: normalizeLiveNumber(location.x),
      y: normalizeLiveNumber(location.y),
      z: normalizeLiveNumber(location.z),
      status: "online",
      relation: "unknown",
      raw: `${player.gender || "Dino"} ${player.class || ""}`.trim(),
    };
  }

  function renderMetrics(player: AdminPlayer) {
    return (
      <div className="admin-metrics">
        {[
          ["Growth", player.growth],
          ["Health", player.health],
          ["Stamina", player.stamina],
          ["Hunger", player.hunger],
          ["Thirst", player.thirst],
        ].map(([label, value]) => (
          <div className="admin-meter" key={label}>
            <span>{label}</span>
            <strong>{metricLabel(Number(value))}</strong>
            <i style={{ width: `${clampMetric(Number(value))}%` }} />
          </div>
        ))}
      </div>
    );
  }

  function renderDiet(player: AdminPlayer) {
    const diet = player.diet;
    return (
      <div className="op-diet-box">
        <span className="op-panel-kicker">Vitaminas / dieta</span>
        <div className="op-diet-grid">
          <div>
            <span>Carbs</span>
            <strong>A {dietLabel(diet?.carbs ?? diet?.vitamins?.A)}</strong>
          </div>
          <div>
            <span>Protein</span>
            <strong>B {dietLabel(diet?.protein ?? diet?.vitamins?.B)}</strong>
          </div>
          <div>
            <span>Lipid</span>
            <strong>Y/G {dietLabel(diet?.lipid ?? diet?.vitamins?.Y ?? diet?.vitamins?.G)}</strong>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="op-admin-shell">
      <section className="op-admin-topline">
        <div className="op-brand-card">
          <div className="op-brand-mark">RP</div>
          <div>
            <span>Refugio Primitivo</span>
            <strong>Panel Admin</strong>
            <em>Control sin tocar telemetria</em>
          </div>
        </div>

        <div className="op-command-banner">
          <span>{liveServerLabel}</span>
          <strong>ORACULO ADMIN</strong>
          <em>{liveStatus}</em>
        </div>

        <div className="op-token-box">
          <label>Sesion admin</label>
          <p className="op-session-note">Acceso autorizado por SteamID64.</p>
          <button type="button" onClick={logoutAdmin}>Salir</button>
        </div>
      </section>

      <nav className="op-admin-tabs" aria-label="Panel admin">
        {TABS.map((item) => (
          <button
            type="button"
            key={item.id}
            className={tab === item.id ? "active" : ""}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <section className="op-admin-grid">
        <aside className="op-admin-left">
          <div className="op-panel">
            <span className="op-panel-kicker">Estado real</span>
            <dl className="op-stat-list">
              <div>
                <dt>Jugadores online</dt>
                <dd>{onlineCount}</dd>
              </div>
              <div>
                <dt>Alertas vitales</dt>
                <dd>{riskCount}</dd>
              </div>
              <div>
                <dt>Acciones activas</dt>
                <dd>{ACTIVE_CAPABILITIES.length}</dd>
              </div>
              <div>
                <dt>Mapa</dt>
                <dd>{liveSnapshot ? "Agente" : "Pendiente"}</dd>
              </div>
            </dl>
          </div>

          <div className="op-panel">
            <span className="op-panel-kicker">Comandos activos</span>
            <div className="op-chip-list">
              {ACTIVE_CAPABILITIES.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>

          <div className="op-panel danger">
            <span className="op-panel-kicker">Pendiente por backend</span>
            <div className="op-chip-list muted">
              {BACKEND_PENDING.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
        </aside>

        <section className="op-admin-stage">
          {tab === "overview" && (
            <div className="op-stage-layout">
              <div className="op-map-frame">
                <img src="/oraculo/mapa-limpio.png" alt="Mapa Gateway" />
                {players.map((player) => (
                  <button
                    type="button"
                    key={player.id}
                    className={`op-map-dot ${player.relation} ${dinoAsset(player.species) ? "with-dino" : ""}`}
                    style={mapPoint(player)}
                    onClick={() => setSelectedId(player.id)}
                    title={`${player.name} ${player.steamId}`}
                  >
                    {dinoAsset(player.species) ? <img src={dinoAsset(player.species)} alt="" /> : null}
                  </button>
                ))}
                <div className="op-map-legend">
                  <strong>{liveMapName}</strong>
                  <span>Mapa solo lectura desde admin</span>
                  <button type="button" onClick={syncOraculoLive} disabled={liveBusy}>
                    {liveBusy ? "Sincronizando" : "Sincronizar Mapa Live"}
                  </button>
                </div>
              </div>

              <div className="op-panel op-focus-panel">
                <span className="op-panel-kicker">Perfil seleccionado</span>
                <h2>{selectedPlayer.name}</h2>
                <p>{selectedPlayer.species}</p>
                {dinoAsset(selectedPlayer.species) ? (
                  <div className="op-dino-preview">
                    <img src={dinoAsset(selectedPlayer.species)} alt={selectedPlayer.species} />
                  </div>
                ) : null}
                {renderMetrics(selectedPlayer)}
                {renderDiet(selectedPlayer)}
                <div className="op-coords">
                  <span>X {selectedPlayer.x}</span>
                  <span>Y {selectedPlayer.y}</span>
                  <span>Z {selectedPlayer.z}</span>
                </div>
                <div className="op-button-row">
                  <button type="button" onClick={() => runAction("player-data", selectedPlayer.steamId)} disabled={busy}>
                    Leer dino
                  </button>
                  <button type="button" onClick={() => runAction("direct-message", selectedPlayer.steamId)} disabled={busy}>
                    DM
                  </button>
                  <button type="button" className="danger" onClick={() => runAction("kick", selectedPlayer.steamId)} disabled={busy}>
                    Kick
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === "live" && (
            <div className="op-stage-layout">
              <div className="op-panel op-wide-panel">
                <div className="op-panel-header">
                  <div>
                    <span className="op-panel-kicker">Mapa via agente</span>
                    <h2>Lectura segura</h2>
                  </div>
                  <button type="button" onClick={syncOraculoLive} disabled={liveBusy}>
                    {liveBusy ? "Leyendo..." : "Leer ahora"}
                  </button>
                </div>

                <div className="op-live-grid">
                  <div>
                    <span>Conexion</span>
                    <strong>{liveSnapshot ? "Sincronizada" : "Pendiente"}</strong>
                  </div>
                  <div>
                    <span>Mapa</span>
                    <strong>{liveSnapshot?.server?.map || "Gateway"}</strong>
                  </div>
                  <div>
                    <span>Online</span>
                    <strong>{liveSnapshot?.server?.onlinePlayers ?? "-"}/{liveSnapshot?.server?.maxPlayers ?? 200}</strong>
                  </div>
                  <div>
                    <span>Steam</span>
                    <strong>{liveSnapshot?.viewer?.linked ? "Conectado" : "No conectado"}</strong>
                  </div>
                </div>

                <div className="op-mini-list">
                  {MAPA_LIVE_SIGNALS.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>

                <pre className="op-live-raw">{liveSnapshot ? formatOutput(liveSnapshot) : liveStatus}</pre>
              </div>

              <div className="op-panel op-wide-panel">
                <span className="op-panel-kicker">Biblioteca visual</span>
                <h2>Dinos del mapa</h2>
                <p>Referencia visual interna para identificar especies cuando la telemetria real las entregue.</p>
                <div className="op-asset-grid">
                  {ORACULO_DINO_ASSETS.map(([key, src]) => (
                    <div key={key}>
                      <img src={src} alt={key} />
                      <span>{key}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "players" && (
            <div className="op-panel op-wide-panel">
              <div className="op-panel-header">
                <div>
                  <span className="op-panel-kicker">Jugadores</span>
                  <h2>Control de player list</h2>
                </div>
                <button type="button" onClick={() => runAction("player-list")} disabled={busy}>
                  Actualizar RCON
                </button>
              </div>
              <div className="op-table-wrap">
                <table className="op-admin-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>SteamID</th>
                      <th>Dino</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player) => (
                      <tr key={player.id}>
                        <td>
                          <button type="button" className="op-link-button" onClick={() => setSelectedId(player.id)}>
                            {player.name}
                          </button>
                          {player.raw && <small>{player.raw}</small>}
                        </td>
                        <td>{player.steamId}</td>
                        <td>{player.species}</td>
                        <td>
                          <span className={`op-status ${player.status}`}>{player.status}</span>
                        </td>
                        <td>
                          <button type="button" onClick={() => { setSteamId(player.steamId); setAction("player-data"); }}>
                            Ficha
                          </button>
                          <button type="button" onClick={() => { setSteamId(player.steamId); setAction("direct-message"); }}>
                            DM
                          </button>
                          <button type="button" className="danger" onClick={() => { setSteamId(player.steamId); setAction("kick"); }}>
                            Kick
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "garage" && (
            <div className="op-panel op-wide-panel">
              <div className="op-panel-header">
                <div>
                  <span className="op-panel-kicker">Bridge read-only</span>
                  <h2>Garage DB</h2>
                </div>
                <button type="button" onClick={() => syncLegacyGarage(steamId)} disabled={garageBusy}>
                  {garageBusy ? "Leyendo..." : "Leer garage"}
                </button>
              </div>

              <p>{garageStatus}</p>

              <div className="op-db-summary">
                {[
                  ["Dinos guardados", legacySummary?.parkedDinos],
                  ["Skins jugador", legacySummary?.playerSkins],
                  ["Stats jugador", legacySummary?.playerStats],
                  ["Catalogo dino", legacySummary?.dinoCatalogue],
                  ["Catalogo skin", legacySummary?.skinCatalogue],
                  ["Unlocks", legacySummary?.speciesUnlocks],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <span>{label}</span>
                    <strong>{value ?? "-"}</strong>
                  </div>
                ))}
              </div>

              <label className="op-db-filter">
                SteamID64 opcional
                <input value={steamId} onChange={(event) => setSteamId(event.target.value)} placeholder="7656..." />
              </label>

              <div className="op-table-wrap">
                <table className="op-admin-table">
                  <thead>
                    <tr>
                      <th>Dino</th>
                      <th>SteamID</th>
                      <th>Growth</th>
                      <th>Health</th>
                      <th>Prime</th>
                      <th>Coords</th>
                      <th>Guardado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {garageDinos.map((dino, index) => (
                      <tr key={`${dino.saveId || index}-${dino.steamId || "steam"}`}>
                        <td>
                          <button
                            type="button"
                            className="op-link-button"
                            onClick={() => {
                              if (dino.steamId) setSteamId(dino.steamId);
                            }}
                          >
                            {dino.nickname || dino.species || "Dino guardado"}
                          </button>
                          <small>{dino.species || "Sin especie"}</small>
                        </td>
                        <td>{dino.steamId || "-"}</td>
                        <td>{metricLabel(Number(dino.growth || 0))}</td>
                        <td>{metricLabel(Number(dino.health || 0))}</td>
                        <td>{dino.primeElder ? "Si" : "No"}</td>
                        <td>
                          <small>
                            X {Math.round(Number(dino.x || 0))} / Y {Math.round(Number(dino.y || 0))} / Z {Math.round(Number(dino.z || 0))}
                          </small>
                        </td>
                        <td>{dino.parkedAt || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "skins" && (
            <div className="op-panel op-wide-panel">
              <div className="op-panel-header">
                <div>
                  <span className="op-panel-kicker">Weekend mode</span>
                  <h2>Cola de skins</h2>
                </div>
                <div className="op-panel-header-actions">
                  <a className="op-panel-action-link" href="/admin/skins">
                    Creador interno
                  </a>
                  <button type="button" onClick={() => syncSkinQueue(steamId)} disabled={skinBusy}>
                    {skinBusy ? "Leyendo..." : "Leer cola"}
                  </button>
                </div>
              </div>

              <p>{skinStatus}</p>

              <div className="op-skin-ops">
                <label className="op-db-filter">
                  SteamID64 opcional
                  <input value={steamId} onChange={(event) => setSteamId(event.target.value)} placeholder="7656..." />
                </label>
                <div className="op-skin-note">
                  <strong>Flujo rapido</strong>
                  <span>Oraculo guarda la skin y crea el trabajo. Un operador puede copiar datos, aplicarlo con la herramienta disponible y marcar el resultado aqui.</span>
                </div>
              </div>

              <div className="op-table-wrap">
                <table className="op-admin-table op-skin-table">
                  <thead>
                    <tr>
                      <th>Jugador</th>
                      <th>Dino</th>
                      <th>Skin</th>
                      <th>Estado</th>
                      <th>Colores</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skinJobs.length ? (
                      skinJobs.map((job) => (
                        <tr key={job.id}>
                          <td>
                            <button
                              type="button"
                              className="op-link-button"
                              onClick={() => setSteamId(job.steamId)}
                            >
                              {job.steamId}
                            </button>
                            <small>{job.id}</small>
                          </td>
                          <td>{job.dino || "-"}</td>
                          <td>
                            <strong>{job.skin_code || "-"}</strong>
                            <small>
                              Patron {job.pattern_index ?? "-"} / genero {job.gender ?? "-"} / variacion {job.skin_variation ?? "-"}
                            </small>
                          </td>
                          <td>
                            <span className={`op-status ${job.status}`}>{job.status}</span>
                            <small>Intentos {job.attempts ?? 0}</small>
                            {job.lastError ? <small>{job.lastError}</small> : null}
                          </td>
                          <td>
                            <div className="op-skin-swatches">
                              {Object.entries(job.colors || {}).slice(0, 7).map(([name, color]) => (
                                <i
                                  key={name}
                                  title={name}
                                  style={{
                                    background: `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${color.a})`,
                                  }}
                                />
                              ))}
                            </div>
                          </td>
                          <td>
                            <button type="button" onClick={() => copySkinJob(job)}>
                              Copiar
                            </button>
                            <button type="button" onClick={() => updateSkinJob(job, "applied")} disabled={skinBusy}>
                              Aplicada
                            </button>
                            <button type="button" onClick={() => updateSkinJob(job, "pending")} disabled={skinBusy}>
                              Reintentar
                            </button>
                            <button type="button" className="danger" onClick={() => updateSkinJob(job, "failed")} disabled={skinBusy}>
                              Fallo
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6}>No hay trabajos de skin cargados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "server" && (
            <div className="op-stage-layout">
              <div className="op-panel op-command-panel">
                <span className="op-panel-kicker">RCON</span>
                <h2>Centro de comandos</h2>
                <label>
                  Accion
                  <select value={action} onChange={(event) => setAction(event.target.value as CommandAction)}>
                    <option value="player-list">Listar jugadores</option>
                    <option value="player-data">Leer dino por SteamID</option>
                    <option value="server-details">Server details</option>
                    <option value="queue-status">Queue status</option>
                    <option value="playables">Dinos permitidos</option>
                    <option value="announce">Anuncio global</option>
                    <option value="direct-message">Mensaje directo</option>
                    <option value="kick">Kick</option>
                    <option value="ban">Ban RCON</option>
                    <option value="add-whitelist">Agregar whitelist</option>
                    <option value="remove-whitelist">Remover whitelist</option>
                    <option value="toggle-whitelist">Toggle whitelist</option>
                    <option value="toggle-global-chat">Toggle global chat</option>
                    <option value="save-server">Guardar servidor</option>
                    <option value="pause-server">Pausar/reanudar server</option>
                    <option value="toggle-ai">Toggle AI</option>
                    <option value="toggle-ai-learning">Toggle AI learning</option>
                    <option value="toggle-migrations">Toggle migraciones</option>
                    <option value="toggle-humans">Toggle humanos</option>
                    <option value="toggle-net-distance-checks">Toggle net distance checks</option>
                    <option value="wipe-corpses">Limpiar corpses</option>
                    <option value="ai-density">AI density</option>
                    <option value="set-growth-multiplier">Growth multiplier</option>
                    <option value="toggle-growth-multiplier">Toggle growth multiplier</option>
                    <option value="disable-ai-classes">Desactivar clases AI</option>
                    <option value="update-playables">Actualizar dinos permitidos</option>
                    <option value="console-command">Consola RCON</option>
                  </select>
                </label>
                <label>
                  SteamID64
                  <input value={steamId} onChange={(event) => setSteamId(event.target.value)} placeholder="7656..." />
                </label>
                <label>
                  Mensaje / razon
                  <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Texto para anuncio, DM o kick" />
                </label>
                <label>
                  {commandFieldLabel(action)}
                  <input value={command} onChange={(event) => setCommand(event.target.value)} placeholder={commandFieldPlaceholder(action)} />
                </label>
                <button type="button" onClick={() => runAction()} disabled={busy}>
                  {busy ? "Ejecutando..." : "Ejecutar"}
                </button>
              </div>

              <div className="op-panel op-output-panel">
                <span className="op-panel-kicker">Respuesta</span>
                <pre>{output}</pre>
              </div>
            </div>
          )}

          {tab === "systems" && (
            <div className="op-module-grid">
              <div className="op-panel op-module-card">
                <span className="op-panel-kicker">Fase 1 real</span>
                <h2>Estado</h2>
                <div className="op-chip-list">
                  {PHASE_ONE_MODULES.map(([name, state]) => (
                    <span key={name}>{name}: {state}</span>
                  ))}
                </div>
              </div>
              {MODULES.map((module) => (
                <div className="op-panel op-module-card" key={module.name}>
                  <span className="op-panel-kicker">{module.state}</span>
                  <h2>{module.name}</h2>
                  <p>{module.details}</p>
                  <button type="button" disabled={module.state !== "Activo via RCON" && module.state !== "RCON ampliado" && module.state !== "Parcial"}>
                    Abrir modulo
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === "videos" && (
            <div className="op-video-grid">
              {GUIDE_CARDS.map((video) => (
                <article className="op-panel op-video-card" key={video.module}>
                  <span className="op-panel-kicker">Guia interna</span>
                  <h2>{video.module}</h2>
                  <p>{video.note}</p>
                </article>
              ))}
              <article className="op-panel op-video-card ghost">
                <span className="op-panel-kicker">Pendiente</span>
                <h2>Documentacion privada</h2>
                <p>Espacio reservado para guias propias del equipo cuando se definan los flujos finales.</p>
              </article>
            </div>
          )}

          {tab === "audit" && (
            <div className="op-panel op-wide-panel">
              <span className="op-panel-kicker">Auditoria</span>
              <h2>Ultimos eventos de esta sesion</h2>
              <div className="op-audit-list">
                {audit.map((item, index) => (
                  <div key={`${item}-${index}`}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="op-admin-right">
          <div className="op-panel">
            <span className="op-panel-kicker">Perfil real</span>
            <h2>{selectedPlayer.steamId}</h2>
            <p>{selectedPlayer.raw || "Sin telemetria avanzada hasta leer RCON/playerdata."}</p>
            {renderDiet(selectedPlayer)}
          </div>

          <div className="op-panel">
            <span className="op-panel-kicker">Acceso rapido</span>
            <div className="op-button-column">
              <button type="button" onClick={() => runAction("player-list")} disabled={busy}>
                Actualizar jugadores
              </button>
              <button type="button" onClick={syncOraculoLive} disabled={liveBusy}>
                Leer Mapa Live
              </button>
              <button type="button" onClick={() => { setTab("garage"); syncLegacyGarage(steamId); }} disabled={garageBusy}>
                Leer Garage DB
              </button>
              <button type="button" onClick={() => { setTab("skins"); syncSkinQueue(steamId); }} disabled={skinBusy}>
                Leer Skins
              </button>
              <button type="button" onClick={() => runAction("save-server")} disabled={busy}>
                Guardar servidor
              </button>
              <button type="button" onClick={() => { setTab("server"); setAction("announce"); }}>
                Preparar anuncio
              </button>
            </div>
          </div>

          <div className="op-panel">
            <span className="op-panel-kicker">Notas</span>
            <p>
              El ZIP no modifica el mapa. El panel habla con un agente admin separado en OVH.
              Los modulos avanzados se activan cuando existan comandos o endpoints confirmados.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
