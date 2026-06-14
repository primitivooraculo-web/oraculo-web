import { callGarage, errorJson, json, resolveSteamId } from "@/lib/oraculo-garage-proxy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const steamId = await resolveSteamId(request);
    const data = await callGarage("list", { steamId });
    return json(data);
  } catch (error) {
    return errorJson(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const steamId = await resolveSteamId(request, body);
    const action = String(body.action || "list");
    const data = await callGarage(action, { ...body, steamId });
    return json(data);
  } catch (error) {
    return errorJson(error);
  }
}
