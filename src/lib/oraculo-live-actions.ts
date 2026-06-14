import { cookies } from "next/headers";

type JsonRecord = Record<string, unknown>;

type KillAfterSaveResult = {
  requested: boolean;
  queued: boolean;
  steamId?: string;
  jobId?: string;
  action?: string;
  error?: string;
  status?: number;
};

const ACTIONS_URL =
  process.env.ORACULO_LIVE_ACTIONS_URL ||
  process.env.ORACULO_ADMIN_ACTIONS_URL ||
  process.env.ORACULO_ADMIN_AGENT_ACTIONS_URL ||
  deriveActionsUrl(process.env.ORACULO_ADMIN_AGENT_URL || process.env.ORACULO_ADMIN_URL || "");

const ACTIONS_TOKEN =
  process.env.ORACULO_LIVE_ACTIONS_TOKEN ||
  process.env.ORACULO_ADMIN_ACTIONS_TOKEN ||
  process.env.ORACULO_ADMIN_AGENT_TOKEN ||
  process.env.ADMIN_AGENT_TOKEN ||
  process.env.ORACULO_ADMIN_TOKEN ||
  process.env.ADMIN_TOKEN ||
  "";

const KILL_AFTER_SAVE_ENABLED = process.env.ORACULO_GARAGE_KILL_AFTER_SAVE !== "0";
const KILL_AFTER_SAVE_DELAY_MS = Math.max(0, Number(process.env.ORACULO_GARAGE_KILL_DELAY_MS || 1200));
const ACTIONS_TIMEOUT_MS = Math.max(2500, Number(process.env.ORACULO_LIVE_ACTIONS_TIMEOUT_MS || 9000));

function deriveActionsUrl(base: string) {
  if (!base) return "";
  try {
    const url = new URL(base);
    url.pathname = "/api/admin/actions";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" ? (value as JsonRecord) : null;
}

function findSteamId(value: unknown): string {
  if (typeof value === "string") {
    const match = value.match(/\b765\d{14}\b/);
    return match?.[0] || "";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const text = String(Math.trunc(value));
    return /^765\d{14}$/.test(text) ? text : "";
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findSteamId(item);
      if (found) return found;
    }
    return "";
  }
  const record = asRecord(value);
  if (!record) return "";

  for (const key of ["steamId", "steam_id", "steamid", "steam64", "steamId64", "playerId", "id"]) {
    const found = findSteamId(record[key]);
    if (found) return found;
  }
  for (const item of Object.values(record)) {
    const found = findSteamId(item);
    if (found) return found;
  }
  return "";
}

async function sessionSteamId() {
  const cookieStore = await cookies();
  for (const name of ["oraculo_steam_id", "steamId", "steam_id", "steamid"]) {
    const value = cookieStore.get(name)?.value;
    const found = findSteamId(value);
    if (found) return found;
  }
  return "";
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function enqueueKillDino(steamId: string): Promise<KillAfterSaveResult> {
  if (!KILL_AFTER_SAVE_ENABLED) {
    return { requested: false, queued: false, steamId, error: "disabled" };
  }
  if (!steamId) {
    return { requested: false, queued: false, error: "missing-steam-id" };
  }
  if (!ACTIONS_URL || !ACTIONS_TOKEN) {
    return { requested: false, queued: false, steamId, error: "missing-actions-config" };
  }

  await sleep(KILL_AFTER_SAVE_DELAY_MS);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ACTIONS_TIMEOUT_MS);

  try {
    const response = await fetch(ACTIONS_URL, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${ACTIONS_TOKEN}`,
        "x-oraculo-admin-token": ACTIONS_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "kill-dino",
        steamId,
        reason: "garage-save-auto-kill",
      }),
    });

    const body = (await response.json().catch(() => null)) as JsonRecord | null;
    const job = asRecord(body?.job);
    const queued = response.ok && body?.success !== false && (body?.queued === true || Boolean(job?.id));

    return {
      requested: true,
      queued,
      steamId,
      action: String(body?.action || "kill-dino"),
      jobId: typeof job?.id === "string" ? job.id : undefined,
      status: response.status,
      error: queued ? undefined : String(body?.error || response.statusText || "queue-failed"),
    };
  } catch (error) {
    return {
      requested: true,
      queued: false,
      steamId,
      error: error instanceof Error ? error.message : "queue-error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function enqueueGarageKillAfterSave<T>(request: Request, payload: T): Promise<T & { killAfterSave?: KillAfterSaveResult }> {
  const record = asRecord(payload);
  if (!record || record.success !== true) return payload as T & { killAfterSave?: KillAfterSaveResult };

  const steamId = findSteamId(record) || findSteamId(request.url) || (await sessionSteamId());
  const killAfterSave = await enqueueKillDino(steamId);

  return {
    ...record,
    killAfterSave,
  } as T & { killAfterSave?: KillAfterSaveResult };
}
