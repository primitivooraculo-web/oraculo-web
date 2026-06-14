import type { OraculoPlayer, OraculoSnapshot } from "@/lib/oraculo-data";

type Store = {
  latest: OraculoSnapshot | null;
  privatePlayers: OraculoPlayer[];
  receivedAt: string | null;
};

const globalStore = globalThis as typeof globalThis & {
  __oraculoStore?: Store;
};

export function getStore() {
  if (!globalStore.__oraculoStore) {
    globalStore.__oraculoStore = { latest: null, privatePlayers: [], receivedAt: null };
  }
  return globalStore.__oraculoStore;
}

export function saveSnapshot(snapshot: OraculoSnapshot, privatePlayers: OraculoPlayer[] = []) {
  const store = getStore();
  store.latest = snapshot;
  store.privatePlayers = privatePlayers;
  store.receivedAt = new Date().toISOString();
  return store;
}

export function latestSnapshot() {
  return getStore().latest;
}

export function latestPrivatePlayers() {
  return getStore().privatePlayers;
}
