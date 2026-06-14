import fs from "node:fs";
import path from "node:path";

export type PublicSkinColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export type PublicSkinPreset = {
  id: string;
  name: string;
  status: "available" | "draft" | "disabled";
  dino: string;
  pattern_index: number;
  gender: number;
  skin_variation: number;
  colors: Record<string, PublicSkinColor>;
};

type PublicSkinPresetStore = {
  schemaVersion: number;
  generatedAt: string | null;
  presets: PublicSkinPreset[];
};

const EMPTY_STORE: PublicSkinPresetStore = {
  schemaVersion: 1,
  generatedAt: null,
  presets: [],
};

const COLOR_GROUPS = [
  "male_display",
  "markings",
  "body",
  "flank",
  "underbelly",
  "detail",
  "eyes",
] as const;

const DEFAULT_COLORS: Record<(typeof COLOR_GROUPS)[number], PublicSkinColor> = {
  male_display: { r: 0.5, g: 0.3, b: 0.2, a: 1 },
  markings: { r: 0.4, g: 0.4, b: 0.4, a: 1 },
  body: { r: 0.6, g: 0.3, b: 0.2, a: 1 },
  flank: { r: 0.5, g: 0.3, b: 0.2, a: 1 },
  underbelly: { r: 0.7, g: 0.6, b: 0.4, a: 1 },
  detail: { r: 0.3, g: 0.2, b: 0.1, a: 1 },
  eyes: { r: 0.8, g: 0.7, b: 0.1, a: 1 },
};

function dataPath() {
  return path.join(process.cwd(), "data", "oraculo-skins", "public-presets.json");
}

function clamp01(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
}

function normalizeColor(value: unknown, fallback: PublicSkinColor): PublicSkinColor {
  const src = typeof value === "object" && value ? (value as Partial<PublicSkinColor>) : {};
  return {
    r: clamp01(src.r, fallback.r),
    g: clamp01(src.g, fallback.g),
    b: clamp01(src.b, fallback.b),
    a: clamp01(src.a, fallback.a),
  };
}

function normalizeColors(value: unknown) {
  const src = typeof value === "object" && value ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    COLOR_GROUPS.map((group) => [group, normalizeColor(src[group], DEFAULT_COLORS[group])]),
  ) as Record<string, PublicSkinColor>;
}

function slug(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizePreset(value: unknown, index: number): PublicSkinPreset | null {
  const src = typeof value === "object" && value ? (value as Record<string, unknown>) : {};
  const name = String(src.name || "").trim();
  const dino = String(src.dino || src.species || "").trim();
  if (!name || !dino) return null;

  const status = src.status === "draft" || src.status === "disabled" ? src.status : "available";
  const pattern = Number(src.pattern_index ?? 0);
  const gender = Number(src.gender ?? 1);
  const variation = Number(src.skin_variation ?? 0.5);

  return {
    id: slug(src.id || name) || `preset-${index + 1}`,
    name: name.slice(0, 48),
    status,
    dino: dino.slice(0, 64),
    pattern_index: Number.isFinite(pattern) ? Math.max(0, Math.min(12, Math.round(pattern))) : 0,
    gender: Number.isFinite(gender) ? Math.max(0, Math.min(1, Math.round(gender))) : 1,
    skin_variation: Number.isFinite(variation) ? Math.max(0, Math.min(1, variation)) : 0.5,
    colors: normalizeColors(src.colors),
  };
}

export function getPublicSkinPresetStore(): PublicSkinPresetStore {
  try {
    const file = dataPath();
    if (!fs.existsSync(file)) return EMPTY_STORE;
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<PublicSkinPresetStore>;
    const presets = Array.isArray(parsed.presets)
      ? parsed.presets.map(normalizePreset).filter((item): item is PublicSkinPreset => Boolean(item))
      : [];

    return {
      schemaVersion: Number(parsed.schemaVersion || 1),
      generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : null,
      presets,
    };
  } catch {
    return EMPTY_STORE;
  }
}

export function getAvailablePublicSkinPresets() {
  return getPublicSkinPresetStore().presets.filter((preset) => preset.status === "available");
}

export function findAvailablePublicSkinPreset(id: string) {
  const wanted = slug(id);
  return getAvailablePublicSkinPresets().find((preset) => preset.id === wanted) || null;
}

export function publicSkinApplyPayload(preset: PublicSkinPreset, steamId: string) {
  return {
    steamId,
    targetId: steamId,
    presetId: preset.id,
    approvedPreset: true,
    dino: preset.dino,
    pattern_index: preset.pattern_index,
    gender: preset.gender,
    skin_variation: preset.skin_variation,
    colors: preset.colors,
  };
}
