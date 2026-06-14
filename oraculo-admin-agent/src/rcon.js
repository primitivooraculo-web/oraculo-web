const net = require("node:net");

const OP = {
  ANNOUNCE: 0x10,
  DIRECT_MESSAGE: 0x11,
  KICK: 0x30,
  GET_PLAYER_LIST: 0x40,
  SAVE_SERVER: 0x50,
  CONSOLE_COMMAND: 0x70,
  GET_PLAYER_DATA: 0x77,
};

function getRconConfig() {
  const host = process.env.RCON_HOST || "127.0.0.1";
  const port = Number(process.env.RCON_PORT || 8888);
  const password = process.env.RCON_PASSWORD;

  if (!password) throw new Error("Falta RCON_PASSWORD.");
  if (!Number.isFinite(port) || port <= 0) throw new Error("RCON_PORT no es valido.");

  return { host, port, password };
}

function loginPacket(password) {
  return Buffer.concat([
    Buffer.from([0x01]),
    Buffer.from(password, "utf8"),
    Buffer.from([0x00]),
  ]);
}

function commandPacket(opcode, data = "") {
  return Buffer.concat([
    Buffer.from([0x02, opcode]),
    Buffer.from(data, "utf8"),
    Buffer.from([0x00]),
  ]);
}

function cleanRconText(buf) {
  return buf.toString("utf8").replace(/[^\x20-\x7E\r\n]/g, ".");
}

function sendRcon(packet) {
  return new Promise((resolve, reject) => {
    const { host, port, password } = getRconConfig();
    const socket = new net.Socket();
    let done = false;

    function finish(value) {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(value);
    }

    socket.setTimeout(10000);
    socket.connect(port, host, () => {
      socket.write(loginPacket(password));
    });
    socket.on("data", () => {
      socket.write(packet);
      socket.end();
      finish("OK");
    });
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("Timeout RCON"));
    });
    socket.on("error", reject);
  });
}

function sendRconRequest(opcode, data = "", timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const { host, port, password } = getRconConfig();
    const socket = new net.Socket();
    const chunks = [];
    let sent = false;
    let done = false;
    let timer = null;

    function finish() {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      socket.destroy();
      resolve(chunks.join("\n").trim());
    }

    function arm() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(finish, timeoutMs);
    }

    socket.setTimeout(10000);
    socket.connect(port, host, () => {
      socket.write(loginPacket(password));
    });
    socket.on("data", (buf) => {
      const text = cleanRconText(buf);
      if (!sent && text.includes("Password Accepted")) {
        sent = true;
        socket.write(commandPacket(opcode, data));
        const after = text
          .split("Password Accepted")
          .slice(1)
          .join("Password Accepted")
          .trim();
        if (after) chunks.push(after);
        arm();
        return;
      }
      if (sent) {
        chunks.push(text);
        arm();
      }
    });
    socket.on("timeout", () => {
      if (sent) return finish();
      socket.destroy();
      reject(new Error("Timeout RCON"));
    });
    socket.on("error", (error) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      reject(error);
    });
  });
}

function smartSplitByComma(text) {
  const parts = [];
  let cur = "";
  let depth = 0;

  for (const ch of text) {
    if (ch === "[" || ch === "(") depth++;
    else if (ch === "]" || ch === ")") depth--;

    if (ch === "," && depth === 0) {
      parts.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }

  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function parseMutationSlots(value) {
  if (!value) return null;
  const match = value.match(/\[([^\]]+)\]/);
  if (!match) return null;

  const slots = {};
  for (const item of match[1].split(",")) {
    const [slot, val] = item.split("=").map((x) => x.trim());
    if (slot && val) slots[slot] = val;
  }
  return slots;
}

function parseLocation(value) {
  if (!value) return null;
  const match = value.match(/X=([-\d.]+)\s+Y=([-\d.]+)\s+Z=([-\d.]+)/i);
  if (!match) return null;
  return { x: Number(match[1]), y: Number(match[2]), z: Number(match[3]) };
}

function firstNumber(...values) {
  for (const value of values) {
    if (value == null) continue;
    const match = String(value).match(/-?\d+(?:\.\d+)?/);
    if (!match) continue;
    const parsed = Number.parseFloat(match[0]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function findDietValue(fields, text, names) {
  for (const name of names) {
    const direct = firstNumber(fields[name]);
    if (direct != null) return direct;
  }

  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = text.match(new RegExp(`(?:^|[\\s,;\\[\\(])${escaped}\\s*[:=]\\s*(-?\\d+(?:\\.\\d+)?)`, "i"));
    if (match) return Number.parseFloat(match[1]);
  }

  return null;
}

function parseDiet(fields, text) {
  const carbs = findDietValue(fields, text, ["Carbs", "Carb", "Carbohydrate", "Carbohydrates", "DietA", "VitaminA", "A"]);
  const protein = findDietValue(fields, text, ["Protein", "Proteins", "DietB", "VitaminB", "B"]);
  const lipid = findDietValue(fields, text, ["Lipid", "Lipids", "Fat", "Fats", "DietY", "VitaminY", "Y", "DietG", "VitaminG", "G"]);

  if (carbs == null && protein == null && lipid == null) return null;

  return {
    carbs,
    protein,
    lipid,
    vitamins: {
      A: carbs,
      B: protein,
      Y: lipid,
      G: lipid,
    },
  };
}

function parsePlayerData(text) {
  if (!text || !text.includes("PlayerData")) return null;

  const start = text.indexOf("PlayerData");
  const end = text.indexOf("PlayerDataEnd");
  const body =
    end > 0
      ? text.slice(start + "PlayerData".length, end)
      : text.slice(start + "PlayerData".length);
  const cleaned = body.replace(/[\r\n]+/g, " ").trim();
  const parts = smartSplitByComma(cleaned);
  const fields = {};

  for (const part of parts) {
    const i = part.indexOf(":");
    if (i === -1) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (key) fields[key] = value;
  }

  if (!fields.Name && !fields.PlayerID) return null;

  const num = (key) => {
    const parsed = Number.parseFloat(fields[key]);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const diet = parseDiet(fields, cleaned);

  return {
    name: fields.Name || null,
    steam_id: fields.PlayerID || null,
    gender: fields.Gender || null,
    location: parseLocation(fields.Location),
    class: fields.Class || null,
    growth: num("Growth"),
    health: num("Health"),
    stamina: num("Stamina"),
    hunger: num("Hunger"),
    thirst: num("Thirst"),
    diet,
    vitamins: diet?.vitamins || null,
    mutations: {
      slots: parseMutationSlots(fields.MutationSlots),
      parent: parseMutationSlots(fields.ParentMutationSlots),
      elderA: parseMutationSlots(fields.ElderMutationSlotsA),
      elderB: parseMutationSlots(fields.ElderMutationSlotsB),
    },
    prime_elder: fields.PrimeElder === "true",
  };
}

function parsePlayerList(raw) {
  if (!raw.trim()) return [];

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const idLineIndex = lines.findIndex((line) => /\b\d{17}\b/.test(line));
  if (idLineIndex >= 0) {
    const steamIds = lines[idLineIndex].match(/\b\d{17}\b/g) || [];
    const nameLine = lines
      .slice(idLineIndex + 1)
      .find((line) => !/\b\d{17}\b/.test(line) && line.toLowerCase() !== "playerlist");
    const names = nameLine
      ? nameLine
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean)
      : [];

    return steamIds.map((steamId, index) => ({
      line: names[index] ? `${steamId},${names[index]}` : steamId,
      steamId,
      name: names[index] || null,
    }));
  }

  return lines
    .filter((line) => line.toLowerCase() !== "playerlist")
    .map((line) => {
      const steamId = line.match(/\b\d{17}\b/)?.[0] || null;
      const withoutSteam = steamId ? line.replace(steamId, "").trim() : line;
      const name =
        withoutSteam
          .replace(/^[\s,:;|#-]+/, "")
          .replace(/[\s,:;|#-]+$/, "")
          .trim() || null;
      return { line, steamId, name };
    });
}

async function getPlayerData(steamId) {
  const raw = await sendRconRequest(OP.GET_PLAYER_DATA, "", 5000);
  if (!raw) return null;
  const line = raw.split(/\r?\n/).find((item) => item.includes("PlayerID: " + steamId));
  if (!line) return null;
  return parsePlayerData("PlayerData\n" + line);
}

module.exports = {
  OP,
  commandPacket,
  sendRcon,
  sendRconRequest,
  announce: (message) => sendRcon(commandPacket(OP.ANNOUNCE, message)),
  directMessage: (steamId, message) => sendRcon(commandPacket(OP.DIRECT_MESSAGE, `${steamId},${message}`)),
  kick: (steamId, reason = "Kicked") => sendRcon(commandPacket(OP.KICK, `${steamId},${reason}`)),
  saveServer: () => sendRcon(Buffer.from([0x02, OP.SAVE_SERVER, 0x00])),
  consoleCommand: (text) => sendRconRequest(OP.CONSOLE_COMMAND, text, 4000),
  getPlayerListRaw: () => sendRconRequest(OP.GET_PLAYER_LIST, "", 4000),
  getPlayerData,
  parsePlayerData,
  parsePlayerList,
};
