const fs = require("fs");
const path = require("path");

const root = process.cwd();
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const backupRoot = path.join(root, ".oraculo-local-backups", `live-2s-${stamp}`);

function exists(file) {
  return fs.existsSync(file);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function backupFile(file) {
  if (!exists(file)) return null;
  const rel = path.relative(root, file);
  const target = path.join(backupRoot, rel);
  ensureDir(path.dirname(target));
  fs.copyFileSync(file, target);
  return target;
}

function appendLineOnce(file, line) {
  let current = "";
  if (exists(file)) current = fs.readFileSync(file, "utf8");
  const lines = current.split(/\r?\n/).filter(Boolean);
  if (!lines.includes(line)) {
    fs.writeFileSync(file, `${current}${current.endsWith("\n") || !current ? "" : "\n"}${line}\n`, "utf8");
  }
}

function protectBackups() {
  ensureDir(backupRoot);
  const gitExclude = path.join(root, ".git", "info", "exclude");
  if (exists(path.dirname(gitExclude))) appendLineOnce(gitExclude, ".oraculo-local-backups/");
  appendLineOnce(path.join(root, ".vercelignore"), ".oraculo-local-backups/");
}

function routeRoot() {
  if (exists(path.join(root, "app"))) return "app";
  if (exists(path.join(root, "src", "app"))) return path.join("src", "app");
  throw new Error("No encontre app/ ni src/app/.");
}

function liveRoutePath() {
  const candidates = [
    path.join(root, "app", "api", "oraculo", "live", "route.ts"),
    path.join(root, "src", "app", "api", "oraculo", "live", "route.ts"),
  ];
  const found = candidates.find(exists);
  if (found) return found;
  return path.join(root, routeRoot(), "api", "oraculo", "live", "route.ts");
}

function patchLiveRoute() {
  const file = liveRoutePath();
  ensureDir(path.dirname(file));
  backupFile(file);

  const source = `import { NextRequest, NextResponse } from "next/server";
import { getOraculoSnapshot } from "@/lib/oraculo-bridge";
import { initialSnapshot } from "@/lib/oraculo-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LIVE_TIMEOUT_MS = Number(process.env.ORACULO_LIVE_FAST_TIMEOUT_MS || 1800);

let lastGoodSnapshot = initialSnapshot;
let lastGoodAt = 0;

function responseJson(data: unknown) {
  const response = NextResponse.json(data);
  response.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("X-Oraculo-Live-Timeout-Ms", String(LIVE_TIMEOUT_MS));
  return response;
}

function friendsFrom(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("friends") || "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => /^765\\d{14}$/.test(value));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });

  return Promise.race([
    promise.catch(() => null),
    timeout,
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function staleSnapshot(reason: string) {
  return {
    ...lastGoodSnapshot,
    generatedAt: new Date().toISOString(),
    stale: true,
    staleReason: reason,
    lastGoodAt: lastGoodAt ? new Date(lastGoodAt).toISOString() : null,
  };
}

export async function GET(request: NextRequest) {
  const steamId = request.cookies.get("oraculo_steam_id")?.value || null;
  const friends = friendsFrom(request);

  const snapshot = await withTimeout(
    getOraculoSnapshot(steamId, friends),
    LIVE_TIMEOUT_MS
  );

  if (snapshot) {
    lastGoodSnapshot = snapshot;
    lastGoodAt = Date.now();
    return responseJson(snapshot);
  }

  return responseJson(staleSnapshot("live_timeout"));
}
`;

  fs.writeFileSync(file, source, "utf8");
  console.log(`OK API live rapida: ${path.relative(root, file)}`);
}

function patchMapaDashboard() {
  const candidates = [
    path.join(root, "app", "mapa", "MapaDashboard.tsx"),
    path.join(root, "src", "app", "mapa", "MapaDashboard.tsx"),
  ];
  const file = candidates.find(exists);
  if (!file) {
    console.log("AVISO: no encontre MapaDashboard.tsx para bajar polling.");
    return;
  }

  let source = fs.readFileSync(file, "utf8");
  backupFile(file);

  source = source
    .replace(/window\.setTimeout\(([^,]+),\s*5e3\)/g, "window.setTimeout($1, 2e3)")
    .replace(/setTimeout\(([^,]+),\s*5000\)/g, "setTimeout($1, 2000)")
    .replace(/window\.setTimeout\(([^,]+),\s*1e3\)/g, "window.setTimeout($1, 250)")
    .replace(/setTimeout\(([^,]+),\s*1000\)/g, "setTimeout($1, 250)");

  fs.writeFileSync(file, source, "utf8");
  console.log(`OK mapa polling 2s: ${path.relative(root, file)}`);
}

protectBackups();
patchLiveRoute();
patchMapaDashboard();

console.log("");
console.log("Listo. Ahora ejecuta:");
console.log("npm run build");
console.log("");
console.log("Si el build pasa:");
console.log("npx vercel --prod");
console.log("");
console.log("Prueba tiempo despues del deploy:");
console.log('curl -s -o /dev/null -w "live_total=%{time_total}s\\\\n" https://www.oraculoprimitivo.xyz/api/oraculo/live');
console.log("");
console.log("Backups:");
console.log(path.relative(root, backupRoot));
