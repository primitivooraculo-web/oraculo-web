import { cookies } from "next/headers";
import { initialSnapshot } from "@/lib/oraculo-data";
import { MapaDashboard } from "./MapaDashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MapaPage() {
  const cookieStore = await cookies();
  const steamId = cookieStore.get("oraculo_steam_id")?.value || null;

  return (
    <MapaDashboard
      initialSnapshot={{
        ...initialSnapshot,
        generatedAt: new Date().toISOString(),
        viewer: {
          steamId,
          linked: Boolean(steamId),
        },
        server: {
          ...initialSnapshot.server,
          linked: false,
          map: "Gateway",
          positionMode: "private",
        },
      }}
    />
  );
}
