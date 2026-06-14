const fs = require("fs");
const path = require("path");

const root = process.cwd();
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const backupRoot = path.join(root, ".oraculo-local-backups", `mapa-privacidad-${stamp}`);

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

function appRoot() {
  if (exists(path.join(root, "app"))) return "app";
  if (exists(path.join(root, "src", "app"))) return path.join("src", "app");
  throw new Error("No encontre app/ ni src/app/.");
}

function findMapaDashboard() {
  const candidates = [
    path.join(root, "app", "mapa", "MapaDashboard.tsx"),
    path.join(root, "src", "app", "mapa", "MapaDashboard.tsx"),
  ];
  return candidates.find(exists) || null;
}

function patchFriendQuery(source) {
  const replacements = [
    {
      from: /const\s+friendQuery\s*=\s*useMemo\(\s*\(\)\s*=>\s*friends\.map\(\s*\(?friend\)?\s*=>\s*friend\.steamId\s*\)\.join\(["']\,["']\)\s*,\s*\[friends\]\s*\);/m,
      to: `const friendQuery = useMemo(
    () =>
      friends
        .filter((friend) => friend.status === "accepted")
        .map((friend) => friend.steamId)
        .join(","),
    [friends]
  );`,
    },
    {
      from: /const\s+friendQuery\s*=\s*useMemo\(\s*\(\)\s*=>\s*friends\.map\(\s*\(?item\)?\s*=>\s*item\.steamId\s*\)\.join\(["']\,["']\)\s*,\s*\[friends\]\s*\);/m,
      to: `const friendQuery = useMemo(
    () =>
      friends
        .filter((friend) => friend.status === "accepted")
        .map((friend) => friend.steamId)
        .join(","),
    [friends]
  );`,
    },
  ];

  let next = source;
  for (const item of replacements) next = next.replace(item.from, item.to);
  return next;
}

function addPrivacyHelpers(source) {
  if (source.includes("function shouldRenderMapPlayer(")) return source;

  const helpers = `
function playerIdOf(player: { id?: string; steamId?: string }) {
  return String(player.id || player.steamId || "");
}

function acceptedFriendIdSet(friends: Array<{ steamId?: string; status?: string }>) {
  return new Set(
    friends
      .filter((friend) => friend.status === "accepted")
      .map((friend) => String(friend.steamId || ""))
      .filter(Boolean)
  );
}

function speciesKeyForPrivacy(value?: string | null) {
  return normalizeSpecies(String(value || "")) || String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function shouldRenderMapPlayer(
  player: { id?: string; steamId?: string; relation?: string; species?: string },
  viewerSteamId: string | null | undefined,
  activeSpecies: string | null | undefined,
  acceptedIds: Set<string>
) {
  const playerId = playerIdOf(player);
  if (!playerId) return false;
  if (viewerSteamId && playerId === viewerSteamId) return true;
  if (player.relation !== "friend") return false;
  if (!acceptedIds.has(playerId)) return false;

  const viewerSpecies = speciesKeyForPrivacy(activeSpecies);
  const friendSpecies = speciesKeyForPrivacy(player.species);
  return Boolean(viewerSpecies && friendSpecies && viewerSpecies === friendSpecies);
}

`;

  const marker = "export function MapaDashboard";
  if (source.includes(marker)) return source.replace(marker, `${helpers}${marker}`);
  return `${helpers}${source}`;
}

function patchVisiblePlayers(source) {
  const blockRegex = /const\s+visiblePlayers\s*=\s*useMemo\([\s\S]*?\n\s*\);\s*\n\s*const\s+isLinked\s*=/m;

  const replacement = `const acceptedIds = useMemo(() => acceptedFriendIdSet(friends), [friends]);

  const visiblePlayers = useMemo(
    () =>
      (snapshot.mapPlayers || [])
        .filter((player) => player.x !== 0 || player.y !== 0)
        .map((player) => {
          if (player.relation !== "friend" || speciesGifCandidates(player.species).length > 0) return player;
          const friend = (snapshot.friends || []).find((item) => item.id === player.id);
          return friend?.species ? { ...player, species: friend.species, name: player.name || friend.name } : player;
        })
        .filter((player) =>
          shouldRenderMapPlayer(
            player,
            snapshot.viewer?.steamId || null,
            snapshot.activePlayer?.species || null,
            acceptedIds
          )
        ),
    [snapshot.mapPlayers, snapshot.friends, snapshot.viewer?.steamId, snapshot.activePlayer?.species, acceptedIds]
  );

  const isLinked =`;

  if (blockRegex.test(source)) return source.replace(blockRegex, replacement);

  const looseRegex = /const\s+visiblePlayers\s*=\s*useMemo\([\s\S]*?\[snapshot\.mapPlayers,\s*snapshot\.friends\]\s*\);/m;
  if (looseRegex.test(source)) {
    return source.replace(
      looseRegex,
      `const acceptedIds = useMemo(() => acceptedFriendIdSet(friends), [friends]);

  const visiblePlayers = useMemo(
    () =>
      (snapshot.mapPlayers || [])
        .filter((player) => player.x !== 0 || player.y !== 0)
        .map((player) => {
          if (player.relation !== "friend" || speciesGifCandidates(player.species).length > 0) return player;
          const friend = (snapshot.friends || []).find((item) => item.id === player.id);
          return friend?.species ? { ...player, species: friend.species, name: player.name || friend.name } : player;
        })
        .filter((player) =>
          shouldRenderMapPlayer(
            player,
            snapshot.viewer?.steamId || null,
            snapshot.activePlayer?.species || null,
            acceptedIds
          )
        ),
    [snapshot.mapPlayers, snapshot.friends, snapshot.viewer?.steamId, snapshot.activePlayer?.species, acceptedIds]
  );`
    );
  }

  return source;
}

function patchMapaDashboard() {
  const file = findMapaDashboard();
  if (!file) throw new Error("No encontre app/mapa/MapaDashboard.tsx.");

  const before = fs.readFileSync(file, "utf8");
  let after = before;
  after = patchFriendQuery(after);
  after = addPrivacyHelpers(after);
  after = patchVisiblePlayers(after);

  if (after === before) {
    throw new Error("No pude parchear MapaDashboard automaticamente. Pegame el bloque de visiblePlayers/friendQuery.");
  }

  backupFile(file);
  fs.writeFileSync(file, after, "utf8");
  console.log(`OK privacidad mapa: ${path.relative(root, file)}`);
}

function liveRoutePath() {
  const candidates = [
    path.join(root, "app", "api", "oraculo", "live", "route.ts"),
    path.join(root, "src", "app", "api", "oraculo", "live", "route.ts"),
  ];
  return candidates.find(exists) || path.join(root, appRoot(), "api", "oraculo", "live", "route.ts");
}

function patchLiveRouteStale() {
  const file = liveRoutePath();
  if (!exists(file)) {
    console.log("AVISO: no encontre route live; solo queda aplicado filtro cliente.");
    return;
  }

  let source = fs.readFileSync(file, "utf8");
  if (!source.includes("staleSnapshot(")) {
    console.log("OK route live sin staleSnapshot de live-2s; no requiere parche stale.");
    return;
  }

  const before = source;
  source = source.replace(
    /(return\s*\{\s*\.\.\.lastGoodSnapshot,\s*generatedAt:[\s\S]*?lastGoodAt:[\s\S]*?\n\s*\};\s*\n\s*\})/m,
    `return {
    ...lastGoodSnapshot,
    generatedAt: new Date().toISOString(),
    stale: true,
    staleReason: reason,
    lastGoodAt: lastGoodAt ? new Date(lastGoodAt).toISOString() : null,
    mapPlayers: [],
    friends: [],
  };
}`
  );

  if (source !== before) {
    backupFile(file);
    fs.writeFileSync(file, source, "utf8");
    console.log(`OK stale no filtra secretos: ${path.relative(root, file)}`);
  } else {
    console.log("AVISO: no pude ajustar staleSnapshot automaticamente.");
  }
}

protectBackups();
patchMapaDashboard();
patchLiveRouteStale();

console.log("");
console.log("Listo. Ahora ejecuta:");
console.log("npm run build");
console.log("");
console.log("Si el build pasa:");
console.log("npx vercel --prod");
console.log("");
console.log("Este fix hace:");
console.log("- no pide live de amigos pendientes");
console.log("- no pinta jugadores que no sean tu dino o amigo aceptado de la misma especie");
console.log("- si live timeout devuelve stale, no conserva mapPlayers viejos");
console.log("");
console.log("Backups:");
console.log(path.relative(root, backupRoot));
