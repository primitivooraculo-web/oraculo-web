import { NextResponse } from "next/server";
import { getAvailablePublicSkinPresets, getPublicSkinPresetStore } from "../../../../../lib/oraculo-public-skins";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const store = getPublicSkinPresetStore();

  return NextResponse.json(
    {
      success: true,
      generatedAt: store.generatedAt,
      presets: getAvailablePublicSkinPresets(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
