const fs = require("fs");
const path = require("path");

const root = process.cwd();
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const backupRoot = path.join(root, ".oraculo-local-backups", `pit-contador-${stamp}`);

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

function findMapaDashboard() {
  const candidates = [
    path.join(root, "app", "mapa", "MapaDashboard.tsx"),
    path.join(root, "src", "app", "mapa", "MapaDashboard.tsx"),
  ];
  return candidates.find(exists) || null;
}

function stripType(param) {
  return param.trim().replace(/=.*/, "").replace(/:.*/, "").trim();
}

function insertHelpers(source) {
  if (source.includes("function applyThePitLocalCalibration(")) return source;

  const helpers = `
const THE_PIT_LOCAL_CALIBRATION = [
  {
    label: "pit-west-farms",
    long: -351865.249,
    lat: 314279.962,
    oldLeft: 32.457,
    oldTop: 65.157,
    targetLeft: 19.584,
    targetTop: 77.469,
  },
  {
    label: "pit-northwest-sanctuary",
    long: -329678.945,
    lat: 165219.555,
    oldLeft: 26.191,
    oldTop: 60.153,
    targetLeft: 22.610,
    targetTop: 61.403,
  },
  {
    label: "south-plains-west-river",
    long: -179415.686,
    lat: 224438.711,
    oldLeft: 34.933,
    oldTop: 68.038,
    targetLeft: 34.213,
    targetTop: 68.386,
  },
  {
    label: "pit-south-beach",
    long: -245264.602,
    lat: 416562.472,
    oldLeft: 35.563,
    oldTop: 65.130,
    targetLeft: 27.962,
    targetTop: 88.858,
  },
];

function applyThePitLocalCalibration(long: number, lat: number, left: number, top: number) {
  if (long < -390000 || long > -120000 || lat < 120000 || lat > 450000) {
    return { left, top };
  }

  let weightTotal = 0;
  let leftDelta = 0;
  let topDelta = 0;

  for (const point of THE_PIT_LOCAL_CALIBRATION) {
    const distance = Math.hypot(long - point.long, lat - point.lat);
    const radius = 190000;
    if (distance > radius) continue;

    const fade = 1 - distance / radius;
    const weight = (fade * fade * fade) / Math.max(0.0001, Math.pow(distance / 65000, 2));

    leftDelta += (point.targetLeft - point.oldLeft) * weight;
    topDelta += (point.targetTop - point.oldTop) * weight;
    weightTotal += weight;
  }

  if (weightTotal <= 0) return { left, top };
  return {
    left: left + leftDelta / weightTotal,
    top: top + topDelta / weightTotal,
  };
}

function serverPopulationLabel(server: {
  onlinePlayers?: number;
  maxPlayers?: number;
  onlinePlayersReal?: number;
  playersOnline?: number;
  serverPlayers?: number;
  population?: number;
}) {
  const maxPlayers = Number(server.maxPlayers || 200);
  const realCount = [
    server.onlinePlayersReal,
    server.playersOnline,
    server.serverPlayers,
    server.population,
  ].find((value) => Number.isFinite(Number(value)));

  if (realCount !== undefined) {
    return \`\${Number(realCount)}/\${maxPlayers} jugadores\`;
  }

  return \`\${Number(server.onlinePlayers || 0)}/\${maxPlayers} con telemetria\`;
}

`;

  const marker = source.includes("export function MapaDashboard")
    ? "export function MapaDashboard"
    : source.includes("function MapaDashboard")
      ? "function MapaDashboard"
      : null;

  if (!marker) throw new Error("No encontre MapaDashboard para insertar helpers.");
  return source.replace(marker, `${helpers}${marker}`);
}

function patchCalibrationReturn(source) {
  if (source.includes("applyThePitLocalCalibration(") && source.includes("const pitCalibration =")) {
    return source;
  }

  const returnRegex = /return\s*\{\s*left:\s*`\$\{clamp\(left,\s*3,\s*97\)\}%`,\s*top:\s*`\$\{clamp\(top,\s*3,\s*97\)\}%`,?\s*\};/m;
  const match = returnRegex.exec(source);
  if (!match) {
    throw new Error("No encontre el return de posicion con clamp(left/top). Pegame la funcion de coordenadas si falla.");
  }

  const prefix = source.slice(0, match.index);
  const functionMatches = [...prefix.matchAll(/function\s+[\w$]+\s*\(([^)]*)\)\s*\{/g)];
  const lastFunction = functionMatches[functionMatches.length - 1];
  if (!lastFunction) {
    throw new Error("No pude detectar los parametros de la funcion de posicion.");
  }

  const params = lastFunction[1].split(",").map(stripType).filter(Boolean);
  const longName = params[0] || "long";
  const latName = params[1] || "lat";

  const replacement = `const pitCalibration = applyThePitLocalCalibration(${longName}, ${latName}, left, top);
  return {
    left: \`\${clamp(pitCalibration.left, 3, 97)}%\`,
    top: \`\${clamp(pitCalibration.top, 3, 97)}%\`,
  };`;

  return source.replace(returnRegex, replacement);
}

function patchCounterLabel(source) {
  if (source.includes("serverPopulationLabel(snapshot.server)") || source.includes("serverPopulationLabel(state.server)")) {
    return source;
  }

  const patterns = [
    {
      regex: /<span>\s*\{snapshot\.server\.onlinePlayers\}\s*\/\s*\{snapshot\.server\.maxPlayers\s*\|\|\s*200\}\s*jugadores\s*<\/span>/m,
      replacement: "<span>{serverPopulationLabel(snapshot.server)}</span>",
    },
    {
      regex: /<span>\s*\{state\.server\.onlinePlayers\}\s*\/\s*\{state\.server\.maxPlayers\s*\|\|\s*200\}\s*jugadores\s*<\/span>/m,
      replacement: "<span>{serverPopulationLabel(state.server)}</span>",
    },
    {
      regex: /<span>\s*\{[^}]+\.server\.onlinePlayers\}\s*\/\s*\{[^}]+\.server\.maxPlayers\s*\|\|\s*200\}\s*jugadores\s*<\/span>/m,
      replacement: (match) => {
        const name = match.match(/\{([^}.]+)\.server\.onlinePlayers\}/)?.[1];
        return name ? `<span>{serverPopulationLabel(${name}.server)}</span>` : match;
      },
    },
  ];

  let next = source;
  for (const pattern of patterns) {
    const before = next;
    next = next.replace(pattern.regex, pattern.replacement);
    if (next !== before) return next;
  }

  console.log("AVISO: no pude cambiar el contador automaticamente; la calibracion si queda aplicada.");
  return source;
}

function patchMapaDashboard() {
  const file = findMapaDashboard();
  if (!file) throw new Error("No encontre app/mapa/MapaDashboard.tsx.");

  const before = fs.readFileSync(file, "utf8");
  let after = before;
  after = insertHelpers(after);
  after = patchCalibrationReturn(after);
  after = patchCounterLabel(after);

  if (after === before) {
    throw new Error("No hubo cambios en MapaDashboard.tsx.");
  }

  backupFile(file);
  fs.writeFileSync(file, after, "utf8");
  console.log(`OK The Pit + contador: ${path.relative(root, file)}`);
}

protectBackups();
patchMapaDashboard();

console.log("");
console.log("Listo. Ahora ejecuta:");
console.log("npm run build");
console.log("");
console.log("Si el build pasa:");
console.log("npx vercel --prod");
console.log("");
console.log("Backups:");
console.log(path.relative(root, backupRoot));
