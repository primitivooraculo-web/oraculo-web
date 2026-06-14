import type { Metadata } from "next";
import "../oraculo-home.css";
import { getAvailablePublicSkinPresets, getPublicSkinPresetStore } from "../../lib/oraculo-public-skins";
import PublicSkinsClient from "./PublicSkinsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Skins | Refugio Primitivo",
  description: "Presets publicos de skins aprobadas por Refugio Primitivo.",
};

export default function SkinsPage() {
  const store = getPublicSkinPresetStore();

  return (
    <PublicSkinsClient
      generatedAt={store.generatedAt}
      presets={getAvailablePublicSkinPresets()}
    />
  );
}
