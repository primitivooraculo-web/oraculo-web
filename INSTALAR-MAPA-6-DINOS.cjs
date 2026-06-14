const fs = require("fs");
const path = require("path");

const root = process.cwd();
const here = __dirname;
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const backupRoot = path.join(root, ".oraculo-local-backups", `mapa-6-dinos-${stamp}`);

const dinoFiles = [
  "Allosaurus.png",
  "beipi.png",
  "carnotaurus.png",
  "cerato.png",
  "deinosuchus.png",
  "Diabloceraptops.png",
  "dilo.png",
  "Dryosaurus.png",
  "gallimimus.png",
  "herrera.png",
  "hipsi.png",
  "Maiasaurus.png",
  "omni.png",
  "Pachy.png",
  "pteranodon.png",
  "rex.png",
  "Stegosaurus.png",
  "tenonto.png",
  "Triceraptops.png",
  "trodon.png",
];

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

function copyWithBackup(src, dest) {
  if (!exists(src)) throw new Error(`Falta asset: ${src}`);
  ensureDir(path.dirname(dest));
  backupFile(dest);
  fs.copyFileSync(src, dest);
  console.log(`OK asset: ${path.relative(root, dest)}`);
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
  if (exists(path.dirname(gitExclude))) {
    appendLineOnce(gitExclude, ".oraculo-local-backups/");
  }
  appendLineOnce(path.join(root, ".vercelignore"), ".oraculo-local-backups/");
}

function installMap() {
  const src = path.join(here, "assets", "mapa", "mapita_6.0.png");
  const publicOraculo = path.join(root, "public", "oraculo");
  copyWithBackup(src, path.join(publicOraculo, "mapa-limpio.png"));
  copyWithBackup(src, path.join(publicOraculo, "mapita_6.0.png"));
}

function installDinos() {
  const publicOraculo = path.join(root, "public", "oraculo");
  for (const file of dinoFiles) {
    copyWithBackup(path.join(here, "assets", "dinos", file), path.join(publicOraculo, file));
  }
}

function patchAllosaurusPortrait() {
  const candidates = [
    path.join(root, "app", "mapa", "MapaDashboard.tsx"),
    path.join(root, "src", "app", "mapa", "MapaDashboard.tsx"),
  ];

  const file = candidates.find(exists);
  if (!file) {
    console.log("AVISO: no encontre MapaDashboard.tsx para agregar retrato de Allosaurus.");
    return;
  }

  const source = fs.readFileSync(file, "utf8");
  if (source.includes("/oraculo/Allosaurus.png")) {
    console.log(`OK Allosaurus ya estaba en: ${path.relative(root, file)}`);
    return;
  }

  let next = source;

  next = next.replace(
    /return\s+([A-Za-z_$][\w$]*)\.includes\(["']tyrann["']\)/,
    'return $1.includes("allo") ? "/oraculo/Allosaurus.png" : $1.includes("tyrann")'
  );

  next = next.replace(
    /return\s+([A-Za-z_$][\w$]*)\.includes\(["']rex["']\)/,
    'return $1.includes("allo") ? "/oraculo/Allosaurus.png" : $1.includes("rex")'
  );

  if (next === source) {
    console.log("AVISO: no pude parchear Allosaurus automaticamente. Los demas retratos quedan instalados.");
    return;
  }

  backupFile(file);
  fs.writeFileSync(file, next, "utf8");
  console.log(`OK patch Allosaurus: ${path.relative(root, file)}`);
}

protectBackups();
installMap();
installDinos();
patchAllosaurusPortrait();

console.log("");
console.log("Listo. Ahora ejecuta:");
console.log("npm run build");
console.log("");
console.log("Si el build pasa:");
console.log("npx vercel --prod");
console.log("");
console.log("Backups locales:");
console.log(path.relative(root, backupRoot));
