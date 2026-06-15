import { initialSnapshot, type OraculoPlayer, type OraculoSnapshot } from "@/lib/oraculo-data";
import { latestPrivatePlayers, latestSnapshot } from "@/lib/oraculo-store";

const BRIDGE_URL =
  process.env.ORACULO_AGENT_URL ||
  process.env.BRIDGE_URL ||
  process.env.BRIDGE_BASE_URL;

const BRIDGE_TOKEN = process.env.ORACULO_AGENT_TOKEN || process.env.BRIDGE_TOKEN;

const ADMIN_AGENT_URL =
  process.env.ORACULO_ADMIN_PROXY_URL ||
  process.env.ORACULO_ADMIN_AGENT_PROXY_URL ||
  "https://www.oraculoprimitivo.xyz/api/admin/agent";
const ADMIN_AGENT_DIRECT_URL =
  process.env.ORACULO_ADMIN_AGENT_URL ||
  process.env.ADMIN_AGENT_URL ||
  process.env.ORACULO_ADMIN_URL ||
  "https://admin-agent.oraculoprimitivo.xyz/api/admin/rcon";
const ADMIN_PROXY_TOKEN =
  process.env.ORACULO_ADMIN_TOKEN ||
  process.env.ADMIN_TOKEN ||
  process.env.ADMIN_AGENT_TOKEN ||
  process.env.ORACULO_ADMIN_AGENT_TOKEN ||
  process.env.ORACULO_AGENT_TOKEN ||
  "";
const ADMIN_AGENT_TOKEN =
  process.env.ADMIN_AGENT_TOKEN ||
  process.env.ORACULO_ADMIN_AGENT_TOKEN ||
  process.env.ORACULO_AGENT_TOKEN ||
  process.env.ORACULO_ADMIN_TOKEN ||
  process.env.ADMIN_TOKEN ||
  "";
const ADMIN_AGENT_FALLBACK_URL = ADMIN_AGENT_DIRECT_URL;
const ADMIN_CACHE_MS = 10000;
const ADMIN_STALE_MS = 120000;
const ADMIN_FETCH_TIMEOUT_MS = Math.max(3000, Number(process.env.ORACULO_ADMIN_FETCH_TIMEOUT_MS || 7000));

type AdminCacheEntry = {
  receivedAt: number;
  snapshot: OraculoSnapshot;
};

const globalCache = globalThis as typeof globalThis & {
  __oraculoAdminSnapshotCache?: Map<string, AdminCacheEntry>;
};

const adminSnapshotCache = globalCache.__oraculoAdminSnapshotCache || new Map<string, AdminCacheEntry>();
globalCache.__oraculoAdminSnapshotCache = adminSnapshotCache;

type BridgeSnapshot = {
  generatedAt?: string;
  server?: {
    running?: boolean;
    map?: string;
  };
  players?: {
    online?: number | null;
    list?: unknown[] | Record<string, unknown>;
    source?: string;
    error?: string | null;
  };
};

type BridgeLiveMap = {
  success?: boolean;
  players?: unknown[] | Record<string, unknown>;
  online_players?: unknown[] | Record<string, unknown>;
  timestamp?: string;
};

type AdminAgentResponse = {
  success?: boolean;
  player?: unknown;
  players?: unknown[] | Record<string, unknown>;
  online?: number;
  onlinePlayers?: number;
  online_players?: unknown[] | Record<string, unknown>;
  list?: unknown[] | Record<string, unknown>;
  data?: unknown;
};

const SPECIES_ALIASES: Array<[string, string[]]> = [
  ["Allosaurus", ["allosaurus", "allo", "bp_allosaurus"]],
  ["Tyrannosaurus", ["tyrannosaurus", "tyranno", "trex", "t-rex", "rex", "bp_tyrannosaurus"]],
  ["Triceratops", ["triceratops", "triceraptops", "tricera", "trike", "trice", "bp_triceratops", "bp_triceraptops"]],
  ["Gallimimus", ["gallimimus", "galli", "bp_gallimimus"]],
  ["Beipiaosaurus", ["beipiaosaurus", "beipi", "bp_beipiaosaurus"]],
  ["Maiasaura", ["maiasaura", "maia", "maiasaurus", "bp_maiasaura", "bp_maiasaurus"]],
  ["Deinosuchus", ["deinosuchus", "deino", "bp_deinosuchus"]],
  ["Diabloceratops", ["diabloceratops", "diabloceraptops", "diablo", "bp_diabloceratops", "bp_diabloceraptops"]],
  ["Carnotaurus", ["carnotaurus", "carno", "bp_carnotaurus"]],
  ["Ceratosaurus", ["ceratosaurus", "ceratosauru", "cerato", "bp_ceratosaurus", "bp_ceratosauru"]],
  ["Dilophosaurus", ["dilophosaurus", "dilo", "bp_dilophosaurus"]],
  ["Tenontosaurus", ["tenontosaurus", "tenonto", "bp_tenontosaurus"]],
  ["Pachycephalosaurus", ["pachycephalosaurus", "pachy", "bp_pachycephalosaurus"]],
  ["Stegosaurus", ["stegosaurus", "stego", "bp_stegosaurus"]],
  ["Pteranodon", ["pteranodon", "ptera", "bp_pteranodon"]],
  ["Omniraptor", ["omniraptor", "omni", "utahraptor", "utah", "bp_omniraptor"]],
  ["Troodon", ["troodon", "trodon", "bp_troodon", "bp_trodon"]],
  ["Herrerasaurus", ["herrerasaurus", "herrera", "bp_herrerasaurus"]],
  ["Hypsilophodon", ["hypsilophodon", "hypsi", "bp_hypsilophodon"]],
  ["Dryosaurus", ["dryosaurus", "dryo", "bp_dryosaurus"]],
];

const LONG_KEYS = [
  "long",
  "Long",
  "lng",
  "Lng",
  "longitude",
  "Longitude",
  "x",
  "X",
  "location_x",
  "LocationX",
  "posX",
  "PosX",
];

const LAT_KEYS = [
  "lat",
  "Lat",
  "latitude",
  "Latitude",
  "y",
  "Y",
  "location_y",
  "LocationY",
  "posY",
  "PosY",
];

const ALT_KEYS = [
  "z",
  "Z",
  "alt",
  "Alt",
  "altitude",
  "Altitude",
  "location_z",
  "LocationZ",
  "posZ",
  "PosZ",
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function valuesArray(value: unknown) {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  return record ? Object.values(record) : [];
}

function readString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function readNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const normalized = value.trim().replace(/,/g, "");
      if (Number.isFinite(Number(normalized))) return Number(normalized);
    }
  }
  return null;
}

function readNumberFrom(records: Array<Record<string, unknown> | null>, keys: string[]) {
  for (const record of records) {
    if (!record) continue;
    const value = readNumber(record, keys);
    if (value !== null) return value;
  }
  return null;
}

function nestedRecords(record: Record<string, unknown>, keys: string[]) {
  return keys.map((key) => asRecord(record[key])).filter((item): item is Record<string, unknown> => Boolean(item));
}

function collectText(value: unknown, depth = 0): string {
  if (depth > 4 || value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((item) => collectText(item, depth + 1)).join(" ");
  const record = asRecord(value);
  return record ? Object.values(record).map((item) => collectText(item, depth + 1)).join(" ") : "";
}

function inferSpeciesFromText(text: string) {
  const normalized = text.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!normalized) return "";
  for (const [species, aliases] of SPECIES_ALIASES) {
    if (aliases.some((alias) => normalized.includes(alias.replace(/[^a-z0-9_-]/g, "")))) {
      return species;
    }
  }
  return "";
}

function cleanSpecies(value?: string | null) {
  return String(value || "")
    .toLowerCase()
    .replace(/^bp_/, "")
    .replace(/_c$/, "")
    .replace(/character|class/g, "")
    .replace(/[_-]/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sameSpecies(a?: string | null, b?: string | null) {
  const left = inferSpeciesFromText(a || "") || cleanSpecies(a);
  const right = inferSpeciesFromText(b || "") || cleanSpecies(b);
  return Boolean(left && right && left === right);
}

function findSteamId(value: unknown): string {
  if (typeof value === "string") {
    const match = value.match(/\b765\d{14}\b/);
    return match?.[0] || "";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const text = String(Math.trunc(value));
    return /^765\d{14}$/.test(text) ? text : "";
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findSteamId(item);
      if (found) return found;
    }
  }
  const record = asRecord(value);
  if (record) {
    for (const item of Object.values(record)) {
      const found = findSteamId(item);
      if (found) return found;
    }
  }
  return "";
}

function pct(value: number | null) {
  if (value === null) return -1;
  const normalized = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

function hasPosition(player: OraculoPlayer) {
  return player.x !== 0 || player.y !== 0;
}

function isLivePlayer(player: OraculoPlayer) {
  return player.confidence === "live" && hasPosition(player);
}

function snapshotHasLivePlayers(snapshot: OraculoSnapshot) {
  return (snapshot.mapPlayers || []).some(isLivePlayer) || snapshot.activePlayer?.confidence === "live";
}

function cacheKey(viewerSteamId: string | null, friendSteamIds: string[]) {
  return [viewerSteamId || "anon", ...friendSteamIds].join("|");
}

function withViewer(
  snapshot: OraculoSnapshot,
  viewerSteamId: string | null,
  privatePlayers: OraculoPlayer[],
  friendSteamIds: string[] = [],
) {
  const activePlayer = viewerSteamId
    ? privatePlayers.find((player) => player.id === viewerSteamId && isLivePlayer(player)) || initialSnapshot.activePlayer
    : initialSnapshot.activePlayer;
  const friendSet = new Set(friendSteamIds);
  const playerById = new Map(privatePlayers.map((player) => [player.id, player]));
  const liveFriends = viewerSteamId
    ? privatePlayers
        .filter((player) => friendSet.has(player.id))
        .filter(isLivePlayer)
        .map((player) => {
          const detail = playerById.get(player.id);
          return {
            ...player,
            name: player.name || detail?.name || "Amigo online",
            species: inferSpeciesFromText(player.species) || inferSpeciesFromText(detail?.species || "") || player.species || detail?.species || "Especie pendiente",
            relation: "friend" as const,
          };
        })
    : [];
  const visibleFriends = viewerSteamId
    ? liveFriends.filter((player) => activePlayer.id === viewerSteamId && isLivePlayer(activePlayer) && sameSpecies(activePlayer.species, player.species))
    : [];
  const visiblePlayers = viewerSteamId
    ? [
        ...(activePlayer.id === viewerSteamId && isLivePlayer(activePlayer)
          ? [{ ...activePlayer, name: activePlayer.name || "Tu dino", relation: "self" as const }]
          : []),
        ...visibleFriends,
      ]
    : [];

  return {
    ...snapshot,
    viewer: {
      steamId: viewerSteamId,
      linked: Boolean(viewerSteamId),
    },
    activePlayer,
    mapPlayers: visiblePlayers,
    friends: liveFriends,
  };
}

function toPlayer(raw: unknown, index: number): OraculoPlayer | null {
  const record = asRecord(raw);
  if (!record) return null;

  const state = asRecord(record.state) || asRecord(record.State) || record;
  const location =
    asRecord(state.location) ||
    asRecord(state.Location) ||
    asRecord(state.position) ||
    asRecord(state.Position) ||
    asRecord(record.location) ||
    asRecord(record.Location) ||
    asRecord(record.position) ||
    asRecord(record.Position) ||
    state;
  const statsRecords = [
    ...nestedRecords(record, ["stats", "Stats", "status", "Status", "vitals", "Vitals", "attributes", "Attributes", "profile", "Profile"]),
    ...nestedRecords(state, ["stats", "Stats", "status", "Status", "vitals", "Vitals", "attributes", "Attributes", "profile", "Profile"]),
  ];
  const steamId =
    readString(record, ["steam_id", "steamId", "steamid", "steam64", "steamId64", "playerId", "PlayerId", "id"]) ||
    readString(state, ["steam_id", "steamId", "steamid", "steam64", "steamId64", "playerId", "PlayerId", "id"]) ||
    findSteamId(record);
  const explicitSpecies =
    readString(record, ["species", "Species", "dino", "Dino", "dino_species", "DinoSpecies", "DinoName", "dinoName"]) ||
    readString(state, ["species", "Species", "dino", "Dino", "dino_species", "DinoSpecies", "DinoName", "dinoName"]) ||
    readString(record, ["class", "Class", "characterClass", "CharacterClass", "asset", "Asset", "assetName", "AssetName"]) ||
    readString(state, ["class", "Class", "characterClass", "CharacterClass", "asset", "Asset", "assetName", "AssetName"]);
  const inferredSpecies = inferSpeciesFromText(explicitSpecies) || inferSpeciesFromText(collectText(record));
  const long = readNumberFrom([location, state, record], LONG_KEYS);
  const lat = readNumberFrom([location, state, record], LAT_KEYS);
  const alt = readNumberFrom([location, state, record], ALT_KEYS);

  return {
    id: steamId || `bridge-player-${index}`,
    name:
      readString(record, ["name", "Name", "gamertag", "displayName", "playerName", "PlayerName"]) ||
      readString(state, ["name", "Name", "gamertag", "displayName", "playerName", "PlayerName"]) ||
      "Jugador online",
    species: inferredSpecies || explicitSpecies || "Especie pendiente",
    growth: pct(readNumberFrom([...statsRecords, state, record], ["growth", "Growth", "grow", "Grow", "growth_percent", "GrowthPercent", "growthRate", "GrowthRate", "growth_rate", "Growth_Rate"])),
    health: pct(readNumberFrom([...statsRecords, state, record], ["health", "Health", "health_percent", "HealthPercent", "hp", "HP", "currentHealth", "CurrentHealth"])),
    stamina: pct(readNumberFrom([...statsRecords, state, record], ["stamina", "Stamina", "stamina_percent", "StaminaPercent", "stam", "Stam", "currentStamina", "CurrentStamina"])),
    hunger: pct(readNumberFrom([...statsRecords, state, record], ["hunger", "Hunger", "hunger_percent", "HungerPercent", "hungerPercent", "currentHunger", "CurrentHunger", "food", "Food", "food_percent", "FoodPercent", "foodPercent", "currentFood", "CurrentFood", "nutrition", "Nutrition"])),
    thirst: pct(readNumberFrom([...statsRecords, state, record], ["thirst", "Thirst", "thirst_percent", "ThirstPercent", "thirstPercent", "currentThirst", "CurrentThirst", "water", "Water", "water_percent", "WaterPercent", "waterPercent", "currentWater", "CurrentWater", "hydration", "Hydration", "hydrate", "Hydrate", "fluids", "Fluids", "fluid", "Fluid", "moisture", "Moisture"])),
    x: long ?? 0,
    y: lat ?? 0,
    z: alt ?? 0,
    status: "online",
    relation: index === 0 ? "self" : "hidden",
    confidence:
      readString(record, ["confidence", "Confidence"]) ||
      readString(state, ["confidence", "Confidence"]) ||
      (long !== null && lat !== null ? "live" : "partial"),
  };
}

function normalizeAdminPlayer(raw: unknown) {
  const record = asRecord(raw);
  if (!record) return raw;
  const player = asRecord(record.player) || record;
  const location =
    asRecord(player.location) ||
    asRecord(player.Location) ||
    asRecord(player.position) ||
    asRecord(player.Position);

  return {
    ...player,
    steamId:
      readString(player, ["steam_id", "steamId", "steamid", "steam64", "playerId", "id"]) ||
      findSteamId(player),
    species:
      readString(player, ["species", "Species", "dino", "Dino"]) ||
      readString(player, ["class", "Class", "characterClass", "CharacterClass"]),
    position: location || undefined,
    location: location || undefined,
    confidence: "live",
  };
}

function normalizeAdminAgentBaseUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  if (url.pathname === "/" || !url.pathname) url.pathname = "/api/admin/agent";
  url.search = "";
  return url.toString();
}

function adminAgentAttemptUrls(includeFallback = false) {
  const urls = [ADMIN_AGENT_URL, ...(includeFallback ? [ADMIN_AGENT_FALLBACK_URL] : [])]
    .filter(Boolean)
    .map(normalizeAdminAgentBaseUrl);
  return [...new Set(urls)];
}

function adminAuthHeaders(url: URL) {
  const isWebProxy = url.pathname.endsWith("/api/admin/agent");
  const token = isWebProxy ? ADMIN_PROXY_TOKEN : ADMIN_AGENT_TOKEN;
  return {
    Authorization: `Bearer ${token}`,
    "x-oraculo-admin-token": token,
    "x-oraculo-agent-token": token,
    "Content-Type": "application/json",
  };
}

async function fetchAdminAgentUrl(baseUrl: string, params: Record<string, string>) {
  const url = new URL(baseUrl);
  if (url.pathname === "/" || !url.pathname) url.pathname = "/api/admin/agent";
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ADMIN_FETCH_TIMEOUT_MS);

  const response = await fetch(url.toString(), {
    cache: "no-store",
    signal: controller.signal,
    headers: adminAuthHeaders(url),
  }).finally(() => clearTimeout(timeout));

  const body = (await response.json().catch(() => null)) as AdminAgentResponse | null;
  return { response, body, url };
}

async function adminAgentFetch(params: Record<string, string>): Promise<AdminAgentResponse | null> {
  if ((!ADMIN_PROXY_TOKEN && !ADMIN_AGENT_TOKEN) || !ADMIN_AGENT_URL) return null;

  for (const baseUrl of adminAgentAttemptUrls(false)) {
    try {
      const { response, body } = await fetchAdminAgentUrl(baseUrl, params);
      if (response.ok && body?.success !== false) return body;
    } catch {}
  }

  return null;
}

function sanitizeAdminAgentUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  return {
    host: url.host,
    path: url.pathname === "/" || !url.pathname ? "/api/admin/agent" : url.pathname,
  };
}

async function probeAdminAgentUrl(baseUrl: string, params: Record<string, string>) {
  try {
    const { response, body, url } = await fetchAdminAgentUrl(baseUrl, params);
    const list = valuesArray(body?.players || body?.online_players || body?.list || asRecord(body?.data)?.players || asRecord(body?.data)?.list || []);
    return {
      urlHost: url.host,
      urlPath: url.pathname,
      ok: response.ok,
      status: response.status,
      success: body?.success === true,
      hasPlayer: Boolean(body?.player),
      playerKeys: asRecord(body?.player) ? Object.keys(asRecord(body?.player) || {}).slice(0, 20) : [],
      hasList: list.length > 0,
      listCount: list.length,
      online:
        typeof body?.onlinePlayers === "number"
          ? body.onlinePlayers
          : typeof body?.online === "number"
            ? body.online
            : null,
      error: body?.success === false ? readString(body as Record<string, unknown>, ["error", "message"]) : null,
    };
  } catch (error) {
    const safeUrl = sanitizeAdminAgentUrl(baseUrl);
    return {
      urlHost: safeUrl.host,
      urlPath: safeUrl.path,
      ok: false,
      status: 0,
      success: false,
      hasPlayer: false,
      playerKeys: [],
      hasList: false,
      listCount: 0,
      online: null,
      error: error instanceof Error ? error.message : "admin-probe-error",
    };
  }
}

async function adminAgentProbe(params: Record<string, string>) {
  if (!ADMIN_AGENT_TOKEN || !ADMIN_AGENT_URL) {
    return {
      configured: Boolean(ADMIN_AGENT_TOKEN && ADMIN_AGENT_URL),
      ok: false,
      status: 0,
      success: false,
      error: !ADMIN_AGENT_TOKEN ? "missing-admin-token" : "missing-admin-url",
      attempts: [],
    };
  }

  const attempts = await Promise.all(adminAgentAttemptUrls(true).map((url) => probeAdminAgentUrl(url, params)));
  const winner = attempts.find((attempt) => attempt.ok && attempt.success) || attempts.find((attempt) => attempt.ok) || attempts[0];

  return {
    configured: true,
    ok: Boolean(winner?.ok),
    status: winner?.status || 0,
    success: Boolean(winner?.success),
    hasPlayer: Boolean(winner?.hasPlayer),
    playerKeys: winner?.playerKeys || [],
    hasList: Boolean(winner?.hasList),
    listCount: winner?.listCount || 0,
    online: winner?.online ?? null,
    error: winner?.error || null,
    attempts,
  };
}

function playersFromAdminList(payload: AdminAgentResponse | null) {
  if (!payload) return [];
  return valuesArray(
    payload.players ||
      payload.online_players ||
      payload.list ||
      asRecord(payload.data)?.players ||
      asRecord(payload.data)?.list ||
      [],
  );
}

async function snapshotFromAdminAgent(
  viewerSteamId: string | null,
  friendSteamIds: string[] = [],
): Promise<OraculoSnapshot | null> {
  if (!ADMIN_PROXY_TOKEN && !ADMIN_AGENT_TOKEN) return null;

  const key = cacheKey(viewerSteamId, friendSteamIds);
  const cached = adminSnapshotCache.get(key);
  if (cached && Date.now() - cached.receivedAt < ADMIN_CACHE_MS) return cached.snapshot;

  const targetIds = [
    ...(viewerSteamId ? [viewerSteamId] : []),
    ...friendSteamIds,
  ].filter((id, index, all) => /^765\d{14}$/.test(id) && all.indexOf(id) === index).slice(0, 12);

  const listPayload = await adminAgentFetch({ op: "player-list" }).catch(() => null);
  const listPlayers = playersFromAdminList(listPayload);
  const onlinePlayers = listPlayers
    .map((player, index) => toPlayer(normalizeAdminPlayer(player), index))
    .filter((player): player is OraculoPlayer => Boolean(player));

  const onlineIds = new Set(onlinePlayers.map((player) => player.id));

  const detailTargetIds = listPayload
    ? targetIds.filter((steamId) => onlineIds.has(steamId))
    : targetIds.filter((steamId) => steamId === viewerSteamId).slice(0, 1);

  const detailPlayers = (
    await Promise.all(
      detailTargetIds.map(async (steamId) => {
        const payload = await adminAgentFetch({ op: "player-data", steamId }).catch(() => null);
        return payload?.player ? normalizeAdminPlayer(payload.player) : null;
      }),
    )
  ).filter(Boolean);

  const fallbackPlayers = detailPlayers.length > 0
    ? detailPlayers
    : onlinePlayers;

  const parsedPlayers = fallbackPlayers
    .map((player, index) => toPlayer(player, index))
    .filter((player): player is OraculoPlayer => Boolean(player));

  if (parsedPlayers.length === 0 && !listPayload) {
    if (cached && Date.now() - cached.receivedAt < ADMIN_STALE_MS) return cached.snapshot;
    return null;
  }

  const snapshot = withViewer({
    ...initialSnapshot,
    generatedAt: new Date().toISOString(),
    server: {
      ...initialSnapshot.server,
      linked: parsedPlayers.length > 0 || Boolean(listPayload),
      map: "Gateway",
      onlinePlayers: typeof listPayload?.onlinePlayers === "number"
        ? listPayload.onlinePlayers
        : typeof listPayload?.online === "number"
          ? listPayload.online
          : onlinePlayers.length || parsedPlayers.length,
    },
    mapPlayers: [],
    friends: [],
  }, viewerSteamId, parsedPlayers, friendSteamIds);

  if (snapshotHasLivePlayers(snapshot) || parsedPlayers.length > 0 || Boolean(listPayload)) {
    adminSnapshotCache.set(key, { receivedAt: Date.now(), snapshot });
  }

  return snapshot;
}

export function playersFromBridgePayload(status: BridgeSnapshot, liveMap: BridgeLiveMap | null = null) {
  const rawPlayers = valuesArray(liveMap?.online_players || liveMap?.players || status.players?.list || []);
  return rawPlayers
    .map((player, index) => toPlayer(player, index))
    .filter((player): player is OraculoPlayer => Boolean(player));
}

export function snapshotFromBridgePayload(
  status: BridgeSnapshot,
  liveMap: BridgeLiveMap | null = null,
  viewerSteamId: string | null = null,
  friendSteamIds: string[] = [],
): OraculoSnapshot {
  const parsedPlayers = playersFromBridgePayload(status, liveMap);

  return withViewer({
    ...initialSnapshot,
    generatedAt: status.generatedAt || liveMap?.timestamp || new Date().toISOString(),
    server: {
      ...initialSnapshot.server,
      linked: true,
      map: status.server?.map || initialSnapshot.server.map,
      onlinePlayers:
        parsedPlayers.length || (typeof status.players?.online === "number" ? status.players.online : 0),
    },
    mapPlayers: [],
    friends: [],
  }, viewerSteamId, parsedPlayers, friendSteamIds);
}

async function bridgeFetch<T>(path: string): Promise<T> {
  if (!BRIDGE_URL || !BRIDGE_TOKEN) throw new Error("bridge-not-configured");

  const response = await fetch(`${BRIDGE_URL.replace(/\/$/, "")}${path}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${BRIDGE_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`bridge-error-${response.status}: ${body.slice(0, 160)}`);
  }

  return response.json();
}

export async function getOraculoSnapshot(
  viewerSteamId: string | null = null,
  friendSteamIds: string[] = [],
): Promise<OraculoSnapshot> {
  try {
    if (BRIDGE_URL && BRIDGE_TOKEN) {
      const [status, liveMap] = await Promise.all([
        bridgeFetch<BridgeSnapshot>("/api/status"),
        bridgeFetch<BridgeLiveMap>("/api/rpvt/livemap/data").catch(() => null),
      ]);
      const bridgePlayers = playersFromBridgePayload(status, liveMap);
      const bridgeSnapshot = snapshotFromBridgePayload(status, liveMap, viewerSteamId, friendSteamIds);
      if (bridgePlayers.some(isLivePlayer)) return bridgeSnapshot;

      const adminSnapshot = await snapshotFromAdminAgent(viewerSteamId, friendSteamIds);
      return adminSnapshot || bridgeSnapshot;
    }

    const stored = latestSnapshot() || initialSnapshot;
    const storedPrivatePlayers = latestPrivatePlayers();
    const storedSnapshot = withViewer(stored, viewerSteamId, storedPrivatePlayers, friendSteamIds);
    const storedHasLivePlayers = storedPrivatePlayers.some(isLivePlayer);
    if (storedHasLivePlayers) return storedSnapshot;

    const adminSnapshot = await snapshotFromAdminAgent(viewerSteamId, friendSteamIds);
    return adminSnapshot || storedSnapshot;
  } catch {
    const stored = latestSnapshot() || initialSnapshot;
    return (await snapshotFromAdminAgent(viewerSteamId, friendSteamIds).catch(() => null)) ||
      withViewer(stored, viewerSteamId, latestPrivatePlayers(), friendSteamIds);
  }
}

export async function getOraculoAdminDebug(viewerSteamId: string | null = null, friendSteamIds: string[] = []) {
  const ids = [
    ...(viewerSteamId ? [viewerSteamId] : []),
    ...friendSteamIds,
  ].filter((id, index, all) => /^765\d{14}$/.test(id) && all.indexOf(id) === index).slice(0, 5);

  const playerData = await Promise.all(
    ids.map(async (steamId) => ({
      steamId,
      probe: await adminAgentProbe({ op: "player-data", steamId }),
    })),
  );

  return {
    env: {
      hasAdminToken: Boolean(ADMIN_AGENT_TOKEN),
      adminTokenLength: ADMIN_AGENT_TOKEN.length,
      hasAdminUrl: Boolean(ADMIN_AGENT_URL),
      adminUrlHost: ADMIN_AGENT_URL ? new URL(ADMIN_AGENT_URL).host : null,
      hasBridgeUrl: Boolean(BRIDGE_URL),
      hasBridgeToken: Boolean(BRIDGE_TOKEN),
    },
    viewerSteamId,
    friendSteamIds,
    list: await adminAgentProbe({ op: "player-list" }),
    playerData,
  };
}