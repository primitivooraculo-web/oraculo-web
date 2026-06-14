import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRequest } from "../../../../lib/oraculo-admin-guard";

function clean(value: string | undefined) {
  return (value || "").trim().replace(/^["']|["']$/g, "");
}

function urlIsValid(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const admin = requireAdminRequest(request);
  if (!admin.ok) return admin.response;

  const apiUrl = clean(process.env.ORACULO_COSMETICS_API_URL);
  const apiToken = clean(process.env.ORACULO_COSMETICS_API_TOKEN);

  return NextResponse.json(
    {
      success: true,
      service: "oraculo-cosmetics",
      mode: apiUrl ? "proxy" : "contract",
      status: "Cosmeticos preparados",
      proxy: {
        urlConfigured: Boolean(apiUrl),
        urlValid: apiUrl ? urlIsValid(apiUrl) : false,
        tokenConfigured: Boolean(apiToken),
      },
      liveApply: false,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
