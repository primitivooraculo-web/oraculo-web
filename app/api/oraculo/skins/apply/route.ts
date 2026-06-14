import { NextRequest, NextResponse } from "next/server";
import {
  findAvailablePublicSkinPreset,
  publicSkinApplyPayload,
} from "../../../../../lib/oraculo-public-skins";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanEnvValue(value: string | undefined) {
  return (value || "").trim().replace(/^["']|["']$/g, "");
}

function cleanBaseUrl(value: string | undefined) {
  return cleanEnvValue(value).replace(/\/+$/, "");
}

function validSteamId(value: unknown) {
  const steamId = String(value || "").trim();
  return /^765\d{14}$/.test(steamId) ? steamId : "";
}

async function forwardPresetApply(payload: Record<string, unknown>) {
  const base = cleanBaseUrl(process.env.ORACULO_COSMETICS_API_URL || process.env.ORACULO_SKIN_API_URL);
  if (!base) return null;

  const token = cleanEnvValue(process.env.ORACULO_COSMETICS_API_TOKEN || process.env.ORACULO_SKIN_API_TOKEN);
  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: "Falta ORACULO_COSMETICS_API_TOKEN/ORACULO_SKIN_API_TOKEN.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const response = await fetch(`${base}/api/overlay.skineditor/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const text = await response.text();
    let data: unknown = text ? { success: response.ok, raw: text } : { success: response.ok };
    try {
      data = text ? JSON.parse(text) : data;
    } catch {
      // Keep wrapped non-JSON responses serializable.
    }

    return NextResponse.json(data, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const steamId = validSteamId((body as Record<string, unknown>).steamId || (body as Record<string, unknown>).targetId);
  if (!steamId) {
    return NextResponse.json(
      { success: false, error: "SteamID64 invalido." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const presetId = String((body as Record<string, unknown>).presetId || "").trim();
  const preset = findAvailablePublicSkinPreset(presetId);
  if (!preset) {
    return NextResponse.json(
      { success: false, error: "Preset no disponible." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const payload = publicSkinApplyPayload(preset, steamId);
  const proxied = await forwardPresetApply(payload);
  if (proxied) return proxied;

  return NextResponse.json(
    {
      success: true,
      message: "Preset validado.",
      queued: false,
      pendingBackend: "Preset aprobado, pero falta ORACULO_COSMETICS_API_URL/ORACULO_SKIN_API_URL para enviarlo al backend live.",
      preset: {
        id: preset.id,
        name: preset.name,
        dino: preset.dino,
      },
    },
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}
