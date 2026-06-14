import { initialSnapshot } from "@/lib/oraculo-data";
import { MapaDashboard } from "./MapaDashboard";

export const dynamic = "force-static";
export const revalidate = 30;

export default function MapaPage() {
  return <MapaDashboard initialSnapshot={initialSnapshot} />;
}
