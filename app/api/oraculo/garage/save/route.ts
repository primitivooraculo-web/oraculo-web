import { callGarage, errorJson, json, resolveSteamId } from "@/lib/oraculo-garage-proxy";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const steamId = await resolveSteamId(request, body);
    const data = await callGarage("save-active", { ...body, steamId });
    return json(data);
  } catch (error) {
    return errorJson(error);
  }
}
