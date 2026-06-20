function agentConfig() {
  const url =
    process.env.ORACULO_ADMIN_AGENT_URL ||
    process.env.ADMIN_AGENT_URL ||
    process.env.ORACULO_AGENT_URL ||
    "";
  const token =
    process.env.ORACULO_ADMIN_AGENT_TOKEN ||
    process.env.ADMIN_AGENT_TOKEN ||
    process.env.ORACULO_AGENT_TOKEN ||
    "";

  if (!url || !token) {
    throw new Error("Falta ORACULO_ADMIN_AGENT_URL/ORACULO_ADMIN_AGENT_TOKEN.");
  }

  return {
    url: url.replace(/\/$/, ""),
    token,
  };
}

async function agentJson(path: string, init?: RequestInit) {
  const config = agentConfig();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${config.token}`);

  const response = await fetch(`${config.url}${path}`, {
    ...init,
    cache: "no-store",
    headers,
  });

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { success: false, raw: text };
  }

  return {
    status: response.status,
    ok: response.ok,
    data,
  };
}

export async function listGarageVaultSaves(steamId: string) {
  const query = new URLSearchParams({ op: "list", steamId });
  return agentJson(`/api/admin/garage-vault?${query.toString()}`);
}

export async function saveActiveGarageDino(steamId: string) {
  return agentJson("/api/admin/garage-vault", {
    method: "POST",
    body: JSON.stringify({ action: "save-active", steamId }),
  });
}

// 🚀 LA MAGIA: Ahora el mensajero empaca las mutaciones y la dieta
export async function reuseGarageDino(
  steamId: string, 
  saveId: string, 
  mutations: string[] = [], 
  diet: { lipids: number; carbs: number; proteins: number } = { lipids: 0, carbs: 0, proteins: 0 }
) {
  return agentJson("/api/admin/garage-vault", {
    method: "POST",
    body: JSON.stringify({ action: "reuse", steamId, saveId, mutations, diet }),
  });
}