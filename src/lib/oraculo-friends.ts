type FriendStatus = "pending_out" | "pending_in" | "accepted";

type FriendEdge = {
  from: string;
  to: string;
  createdAt: number;
  acceptedAt?: number;
};

type FriendView = {
  steamId: string;
  status: FriendStatus;
  createdAt: string;
  acceptedAt?: string;
};

type FriendStore = {
  edges: FriendEdge[];
};

const FRIENDS_KEY = "oraculo:mapa:friends:v1";
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

const globalStore = globalThis as typeof globalThis & {
  __oraculoFriendMemoryStore?: FriendStore;
};

const memoryStore = globalStore.__oraculoFriendMemoryStore || { edges: [] };
globalStore.__oraculoFriendMemoryStore = memoryStore;

function validSteamId(value: string | null | undefined) {
  return typeof value === "string" && /^765\d{14}$/.test(value);
}

function key(from: string, to: string) {
  return `${from}:${to}`;
}

function normalizeStore(value: unknown): FriendStore {
  const record = value && typeof value === "object" ? (value as { edges?: unknown }) : null;
  const edges = Array.isArray(record?.edges) ? record.edges : Array.isArray(value) ? value : [];

  return {
    edges: edges
      .map((edge) => edge && typeof edge === "object" ? (edge as Partial<FriendEdge>) : null)
      .filter((edge): edge is FriendEdge =>
        Boolean(edge && validSteamId(edge.from) && validSteamId(edge.to) && typeof edge.createdAt === "number"),
      ),
  };
}

async function kvCommand(command: unknown[]) {
  if (!KV_URL || !KV_TOKEN) return null;

  const response = await fetch(`${KV_URL.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([command]),
  });

  if (!response.ok) return null;
  const body = await response.json().catch(() => null);
  return Array.isArray(body) ? body[0]?.result : null;
}

async function readStore(): Promise<FriendStore> {
  const raw = await kvCommand(["GET", FRIENDS_KEY]).catch(() => null);
  if (typeof raw === "string") {
    return normalizeStore(JSON.parse(raw));
  }
  if (raw) return normalizeStore(raw);
  return memoryStore;
}

async function writeStore(next: FriendStore) {
  memoryStore.edges = next.edges;
  await kvCommand(["SET", FRIENDS_KEY, JSON.stringify(next)]).catch(() => null);
}

function toView(viewer: string, edge: FriendEdge): FriendView {
  const accepted = Boolean(edge.acceptedAt);
  const other = edge.from === viewer ? edge.to : edge.from;
  const status: FriendStatus = accepted ? "accepted" : edge.from === viewer ? "pending_out" : "pending_in";

  return {
    steamId: other,
    status,
    createdAt: new Date(edge.createdAt).toISOString(),
    acceptedAt: edge.acceptedAt ? new Date(edge.acceptedAt).toISOString() : undefined,
  };
}

function viewsFor(store: FriendStore, viewer: string) {
  if (!validSteamId(viewer)) return [];

  return store.edges
    .filter((edge) => edge.from === viewer || edge.to === viewer)
    .map((edge) => toView(viewer, edge))
    .sort((a, b) => {
      const order = { pending_in: 0, accepted: 1, pending_out: 2 };
      return order[a.status] - order[b.status] || a.steamId.localeCompare(b.steamId);
    });
}

export function friendStoreMode() {
  return KV_URL && KV_TOKEN ? "kv" : "memory";
}

export async function listFriendLinks(viewer: string) {
  return viewsFor(await readStore(), viewer);
}

export async function acceptedFriendIds(viewer: string) {
  return (await listFriendLinks(viewer))
    .filter((friend) => friend.status === "accepted")
    .map((friend) => friend.steamId);
}

export async function mapVisibleFriendIds(viewer: string) {
  return (await listFriendLinks(viewer))
    .filter((friend) => friend.status === "accepted" || friend.status === "pending_out")
    .map((friend) => friend.steamId);
}

export async function requestFriend(viewer: string, target: string) {
  const store = await readStore();
  if (!validSteamId(viewer) || !validSteamId(target) || viewer === target) return viewsFor(store, viewer);

  const now = Date.now();
  const reverseKey = key(target, viewer);
  const reverse = store.edges.find((edge) => key(edge.from, edge.to) === reverseKey);
  if (reverse) {
    reverse.acceptedAt = reverse.acceptedAt || now;
    await writeStore(store);
    return viewsFor(store, viewer);
  }

  const ownKey = key(viewer, target);
  if (!store.edges.some((edge) => key(edge.from, edge.to) === ownKey)) {
    store.edges.push({ from: viewer, to: target, createdAt: now });
    await writeStore(store);
  }

  return viewsFor(store, viewer);
}

export async function acceptFriend(viewer: string, target: string) {
  const store = await readStore();
  if (!validSteamId(viewer) || !validSteamId(target) || viewer === target) return viewsFor(store, viewer);

  const pendingKey = key(target, viewer);
  const pending = store.edges.find((edge) => key(edge.from, edge.to) === pendingKey);
  if (pending) {
    pending.acceptedAt = pending.acceptedAt || Date.now();
    await writeStore(store);
  }

  return viewsFor(store, viewer);
}

export async function removeFriend(viewer: string, target: string) {
  const store = await readStore();
  if (!validSteamId(viewer) || !validSteamId(target)) return viewsFor(store, viewer);

  store.edges = store.edges.filter((edge) => key(edge.from, edge.to) !== key(viewer, target) && key(edge.from, edge.to) !== key(target, viewer));
  await writeStore(store);
  return viewsFor(store, viewer);
}
