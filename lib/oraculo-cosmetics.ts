import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRequest } from "./oraculo-admin-guard";

export type OraculoColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export type OraculoSkinColors = Record<string, OraculoColor>;

export const SKIN_COLOR_GROUPS = [
  "male_display",
  "markings",
  "body",
  "flank",
  "underbelly",
  "detail",
  "eyes",
] as const;

export const DEFAULT_SKIN_COLORS: OraculoSkinColors = {
  male_display: { r: 0.5, g: 0.3, b: 0.2, a: 1 },
  markings: { r: 0.4, g: 0.4, b: 0.4, a: 1 },
  body: { r: 0.6, g: 0.3, b: 0.2, a: 1 },
  flank: { r: 0.5, g: 0.3, b: 0.2, a: 1 },
  underbelly: { r: 0.7, g: 0.6, b: 0.4, a: 1 },
  detail: { r: 0.3, g: 0.2, b: 0.1, a: 1 },
  eyes: { r: 0.8, g: 0.7, b: 0.1, a: 1 },
};

export const TOKEN_COSTS = {
  apply_skin: 1,
  preset_save: 1,
  export: 1,
  purchase: 1000,
};

export const DEMO_PRESETS = [
  {
    name: "Refugio Bronce",
    pattern: 2,
    pattern_index: 2,
    gender: 1,
    skin_variation: 0.5,
    colors: DEFAULT_SKIN_COLORS,
  },
  {
    name: "Selva Turquesa",
    pattern: 1,
    pattern_index: 1,
    gender: 1,
    skin_variation: 0.35,
    colors: {
      male_display: { r: 0.04, g: 0.65, b: 0.52, a: 1 },
      markings: { r: 0.02, g: 0.22, b: 0.18, a: 1 },
      body: { r: 0.06, g: 0.38, b: 0.28, a: 1 },
      flank: { r: 0.08, g: 0.48, b: 0.34, a: 1 },
      underbelly: { r: 0.68, g: 0.58, b: 0.38, a: 1 },
      detail: { r: 0.72, g: 0.43, b: 0.06, a: 1 },
      eyes: { r: 0.95, g: 0.72, b: 0.12, a: 1 },
    },
  },
];

function clamp01(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
}

function normalizeColor(value: unknown, fallback: OraculoColor): OraculoColor {
  const src = typeof value === "object" && value ? (value as Partial<OraculoColor>) : {};
  return {
    r: clamp01(src.r, fallback.r),
    g: clamp01(src.g, fallback.g),
    b: clamp01(src.b, fallback.b),
    a: clamp01(src.a, fallback.a),
  };
}

export function normalizeColors(value: unknown) {
  const src = typeof value === "object" && value ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    SKIN_COLOR_GROUPS.map((group) => [group, normalizeColor(src[group], DEFAULT_SKIN_COLORS[group])]),
  ) as OraculoSkinColors;
}

export function normalizeSkinPayload(value: unknown) {
  const src = typeof value === "object" && value ? (value as Record<string, unknown>) : {};
  const pattern = Number(src.pattern_index ?? src.pattern ?? 0);
  const gender = Number(src.gender ?? 1);
  const variation = Number(src.skin_variation ?? 0.5);

  return {
    action: typeof src.action === "string" && src.action.trim() ? src.action.trim() : "apply_skin",
    pattern_index: Number.isFinite(pattern) ? Math.max(0, Math.min(2, Math.round(pattern))) : 0,
    gender: Number.isFinite(gender) ? Math.max(0, Math.min(1, Math.round(gender))) : 1,
    skin_variation: Number.isFinite(variation) ? Math.max(0, Math.min(1, variation)) : 0.5,
    colors: normalizeColors(src.colors),
  };
}

export function cosmeticsMode() {
  return process.env.ORACULO_COSMETICS_API_URL ? "proxy" : "contract";
}

function cleanEnvValue(value: string | undefined) {
  return (value || "").trim().replace(/^["']|["']$/g, "");
}

function cleanBaseUrl(value: string | undefined) {
  return cleanEnvValue(value).replace(/\/+$/, "");
}

export function cosmeticsResponse(extra: Record<string, unknown>) {
  return {
    success: true,
    mode: cosmeticsMode(),
    generatedAt: new Date().toISOString(),
    ...extra,
  };
}

export async function forwardCosmetics(request: NextRequest, path: string) {
  const admin = requireAdminRequest(request);
  if (!admin.ok) return admin.response;

  const base = cleanBaseUrl(process.env.ORACULO_COSMETICS_API_URL);
  if (!base) return null;

  const token = cleanEnvValue(process.env.ORACULO_COSMETICS_API_TOKEN);

  try {
    const target = new URL(`${base}${path}`);
    request.nextUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value));

    const headers = new Headers();
    headers.set("content-type", request.headers.get("content-type") || "application/json");
    if (token) headers.set("authorization", `Bearer ${token}`);

    const body = request.method === "GET" ? undefined : await request.text();
    const response = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
    });

    const text = await response.text();
    let data: unknown = text ? { success: response.ok, raw: text } : { success: response.ok };

    try {
      data = text ? JSON.parse(text) : data;
    } catch {
      // Keep non-JSON responses wrapped so Next can serialize them safely.
    }

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
