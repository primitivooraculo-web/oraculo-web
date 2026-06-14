import fs from "node:fs";
import path from "node:path";

type GarageDino = {
  id: string;
  saveId?: number;
  steamId?: string;
  species?: string;
  displaySpecies?: string;
  nickname?: string;
  growth?: number;
  health?: number;
  primeElder?: boolean;
  location?: { x: number | null; y: number | null; z: number | null };
  parkedAt?: string | null;
};

type Wallet = {
  id: string;
  steamId?: string;
  currency?: number;
  alltimeCurrency?: number;
  dinoTokens?: number;
  apexTokens?: number;
};

type PlayerSkin = {
  id: string;
  steamId?: string;
  skinName?: string;
  skinCode?: string;
  species?: string;
  amount?: number;
  infinite?: boolean;
};

type GarageNativeData = {
  schemaVersion: number;
  generatedAt: string | null;
  totals: {
    players: number;
    garageDinos: number;
    wallets: number;
    playerSkins: number;
    skinPresets: number;
    dailyRewards: number;
  };
  garageDinos: GarageDino[];
  wallets: Wallet[];
  playerSkins: PlayerSkin[];
  skinPresets: unknown[];
  dailyRewards: unknown[];
  idLinks: unknown[];
};

const EMPTY_DATA: GarageNativeData = {
  schemaVersion: 1,
  generatedAt: null,
  totals: {
    players: 0,
    garageDinos: 0,
    wallets: 0,
    playerSkins: 0,
    skinPresets: 0,
    dailyRewards: 0,
  },
  garageDinos: [],
  wallets: [],
  playerSkins: [],
  skinPresets: [],
  dailyRewards: [],
  idLinks: [],
};

function dataPath() {
  return path.join(process.cwd(), "data", "oraculo-garage", "garage-data.json");
}

function maskSteamId(value?: string) {
  const id = String(value || "").trim();
  if (id.length < 8) return "Jugador privado";
  return `Jugador ${id.slice(-4)}`;
}

function normalizeSteamId(value?: string) {
  const id = String(value || "").trim();
  return /^\d{17}$/.test(id) ? id : "";
}

function sameSteamId(value: string | undefined, steamId: string) {
  return normalizeSteamId(value) === steamId;
}

function percent(value?: number) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n > 1 ? n : n * 100));
}

function dateLabel(value?: string | null) {
  if (!value) return "Pendiente";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function getGarageNativeData(): GarageNativeData {
  try {
    const file = dataPath();
    if (!fs.existsSync(file)) return EMPTY_DATA;
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as GarageNativeData;
    return {
      ...EMPTY_DATA,
      ...parsed,
      totals: { ...EMPTY_DATA.totals, ...(parsed.totals || {}) },
      garageDinos: Array.isArray(parsed.garageDinos) ? parsed.garageDinos : [],
      wallets: Array.isArray(parsed.wallets) ? parsed.wallets : [],
      playerSkins: Array.isArray(parsed.playerSkins) ? parsed.playerSkins : [],
      skinPresets: Array.isArray(parsed.skinPresets) ? parsed.skinPresets : [],
      dailyRewards: Array.isArray(parsed.dailyRewards) ? parsed.dailyRewards : [],
      idLinks: Array.isArray(parsed.idLinks) ? parsed.idLinks : [],
    };
  } catch {
    return EMPTY_DATA;
  }
}

function buildGarageView(data: GarageNativeData, scopeSteamId = "") {
  const steamId = normalizeSteamId(scopeSteamId);
  const scopedDinos = steamId ? data.garageDinos.filter((dino) => sameSteamId(dino.steamId, steamId)) : data.garageDinos;
  const scopedWallets = steamId ? data.wallets.filter((wallet) => sameSteamId(wallet.steamId, steamId)) : data.wallets;
  const scopedSkins = steamId ? data.playerSkins.filter((skin) => sameSteamId(skin.steamId, steamId)) : data.playerSkins;
  const species = new Map<string, { label: string; count: number; prime: number }>();
  let totalGrowth = 0;
  let totalHealth = 0;

  for (const dino of scopedDinos) {
    const label = dino.displaySpecies || dino.species || "Desconocido";
    const current = species.get(label) || { label, count: 0, prime: 0 };
    current.count += 1;
    if (dino.primeElder) current.prime += 1;
    species.set(label, current);
    totalGrowth += percent(dino.growth);
    totalHealth += percent(dino.health);
  }

  const latestDinos = scopedDinos.slice(0, 12).map((dino) => ({
    id: dino.id,
    owner: maskSteamId(dino.steamId),
    species: dino.displaySpecies || dino.species || "Desconocido",
    nickname: dino.nickname || "Sin nombre",
    growth: Math.round(percent(dino.growth)),
    health: Math.round(percent(dino.health)),
    primeElder: Boolean(dino.primeElder),
    parkedAt: dateLabel(dino.parkedAt),
  }));

  const walletTotals = scopedWallets.reduce(
    (acc, wallet) => ({
      currency: acc.currency + Number(wallet.currency || 0),
      dinoTokens: acc.dinoTokens + Number(wallet.dinoTokens || 0),
      apexTokens: acc.apexTokens + Number(wallet.apexTokens || 0),
    }),
    { currency: 0, dinoTokens: 0, apexTokens: 0 },
  );

  const hasPlayerData = Boolean(scopedDinos.length || scopedWallets.length || scopedSkins.length);
  const totals = steamId
    ? {
        players: hasPlayerData ? 1 : 0,
        garageDinos: scopedDinos.length,
        wallets: scopedWallets.length,
        playerSkins: scopedSkins.length,
        skinPresets: 0,
        dailyRewards: 0,
      }
    : data.totals;

  return {
    scope: steamId ? "player" : "public",
    steamId: steamId || null,
    generatedAt: data.generatedAt,
    ready: Boolean(data.generatedAt),
    hasPlayerData,
    totals,
    averages: {
      growth: scopedDinos.length ? Math.round(totalGrowth / scopedDinos.length) : 0,
      health: scopedDinos.length ? Math.round(totalHealth / scopedDinos.length) : 0,
    },
    walletTotals,
    species: Array.from(species.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    latestDinos,
    skinSamples: scopedSkins.slice(0, 8).map((skin) => ({
      id: skin.id,
      owner: maskSteamId(skin.steamId),
      skinName: skin.skinName || "Skin",
      species: skin.species || "General",
      amount: skin.amount || 1,
      infinite: Boolean(skin.infinite),
    })),
  };
}

export function getGaragePublicData() {
  return buildGarageView(getGarageNativeData());
}

export function getGaragePlayerData(steamId: string) {
  return buildGarageView(getGarageNativeData(), steamId);
}
