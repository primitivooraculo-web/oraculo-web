"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent, WheelEvent } from "react";
import type { OraculoPlayer, OraculoSnapshot } from "@/lib/oraculo-data";
import styles from "./mapa.module.css";

type Props = {
  initialSnapshot: OraculoSnapshot;
};

type MapPan = {
  x: number;
  y: number;
};

type MapDrag = {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

type FriendLink = {
  steamId: string;
  status: "pending_out" | "pending_in" | "accepted";
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 2.8;
const ZOOM_STEP = 0.25;
const FRIEND_STORAGE_KEY = "oraculo:mapa:friends:v31";

const DINO_GIF_KEYS = [
  "allosaurus",
  "beipiaosaurus",
  "carnotaurus",
  "ceratosauru",
  "ceratosaurus",
  "deinosuchus",
  "diablo",
  "diabloceratops",
  "diabloceraptops",
  "dilophosaurus",
  "dryosaurus",
  "gallimimus",
  "herrerasaurus",
  "hypsilophodon",
  "maiasaura",
  "omniraptor",
  "pachy",
  "pachycephalosaurus",
  "pteranodon",
  "stegosaurus",
  "tenontosaurio",
  "tenontosaurus",
  "triceratops-locomotion-v0-hfxdanw7uxfc1",
  "triceratops",
  "troodon",
  "tyrannosaurus-rex",
  "tyrannosaurus",
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeSpeciesText(species: string) {
  return species
    .toLowerCase()
    .replace(/bp_/g, "")
    .replace(/_c\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function mapPoint(long: number, lat: number) {
  // The Isle reports X as LONG and Y as LAT.
  let left = 49.5464416567 + lat * -0.00000349681805579 + long * 0.0000700322483989;
  let top = 49.6673583153 + lat * 0.0000923587529034 + long * 0.0000129818662733;

  const calibrationPoints = [
    { long: 234570.211, lat: 135741.792, left: 66.076, top: 65.587 },
    { long: 532901.667, lat: 65641.669, left: 86.104, top: 62.822 },
    { long: -325091.101, lat: 150423.73, left: 25.864, top: 59.866 },
    { long: -261964.437, lat: 230646.071, left: 30.301, top: 68.118 },
    { long: -194618.104, lat: 231519.154, left: 35.019, top: 68.237 },
    { long: -40585.124, lat: 114012.011, left: 46.827, top: 58.274 },
    { long: 316441.478, lat: -388536.618, left: 73.072, top: 17.987 },
  ];

  let weightedLeft = 0;
  let weightedTop = 0;
  let weightTotal = 0;

  for (const point of calibrationPoints) {
    const baseLeft = 49.5464416567 + point.lat * -0.00000349681805579 + point.long * 0.0000700322483989;
    const baseTop = 49.6673583153 + point.lat * 0.0000923587529034 + point.long * 0.0000129818662733;
    const dx = (long - point.long) / 180000;
    const dy = (lat - point.lat) / 180000;
    const distanceSq = dx * dx + dy * dy;
    const weight = 1 / Math.max(0.0001, distanceSq);

    weightedLeft += (point.left - baseLeft) * weight;
    weightedTop += (point.top - baseTop) * weight;
    weightTotal += weight;
  }

  if (weightTotal > 0) {
    left += weightedLeft / weightTotal;
    top += weightedTop / weightTotal;
  }

  const pitCalibration = applyThePitLocalCalibration(long, lat, left, top);
  return {
    left: `${clamp(pitCalibration.left, 3, 97)}%`,
    top: `${clamp(pitCalibration.top, 3, 97)}%`,
  };
}

function speciesKey(species: string) {
  const key = normalizeSpeciesText(species);
  if (key.includes("allo")) return "allosaurus";
  if (key.includes("tyrann") || key.includes("rex")) return "tyrannosaurus";
  if (key.includes("tricera") || key.includes("trike") || key.includes("trice")) return "triceratops";
  if (key.includes("diablo")) return "diabloceratops";
  if (key.includes("diabloceraptop")) return "diabloceratops";
  if (key.includes("beip")) return "beipiaosaurus";
  if (key.includes("maia")) return "maiasaura";
  if (key.includes("deino")) return "deinosuchus";
  if (key.includes("carno")) return "carnotaurus";
  if (key.includes("cerato")) return "ceratosaurus";
  if (key.includes("dilo")) return "dilophosaurus";
  if (key.includes("galli")) return "gallimimus";
  if (key.includes("herrera")) return "herrerasaurus";
  if (key.includes("hypsi")) return "hypsilophodon";
  if (key.includes("dryo")) return "dryosaurus";
  if (key.includes("pachy")) return "pachycephalosaurus";
  if (key.includes("stego")) return "stegosaurus";
  if (key.includes("tenonto")) return "tenontosaurus";
  if (key.includes("ptera")) return "pteranodon";
  if (key.includes("omni") || key.includes("utah")) return "omniraptor";
  if (key.includes("troodon") || key.includes("trodon")) return "troodon";
  return "";
}

function dinoAssetKeys(species: string) {
  const key = speciesKey(species);
  if (!key) return [];

  const aliases: Record<string, string[]> = {
    ceratosaurus: ["ceratosaurus", "ceratosauru"],
    diabloceratops: ["diabloceratops", "diabloceraptops", "diablo"],
    pachycephalosaurus: ["pachycephalosaurus", "pachy"],
    tenontosaurus: ["tenontosaurus", "tenontosaurio"],
    triceratops: ["triceratops", "triceratops-locomotion-v0-hfxdanw7uxfc1"],
    tyrannosaurus: ["tyrannosaurus", "tyrannosaurus-rex"],
  };

  return (aliases[key] || [key]).filter((item) => DINO_GIF_KEYS.includes(item));
}

function dinoAssets(species: string) {
  return dinoAssetKeys(species).map((key) => `/oraculo/${key}.gif`);
}

function profileAsset(species: string) {
  const key = species.toLowerCase();
  if (key.includes("tyrann") || key.includes("rex")) return "/oraculo/rex.png";
  if (key.includes("beip")) return "/oraculo/beipi.png";
  if (key.includes("maia")) return "/oraculo/Maiasaurus.png";
  if (key.includes("galli")) return "/oraculo/gallimimus.png";
  if (key.includes("herrera")) return "/oraculo/herrera.png";
  if (key.includes("hypsi")) return "/oraculo/hipsi.png";
  if (key.includes("dryo")) return "/oraculo/Dryosaurus.png";
  if (key.includes("troodon")) return "/oraculo/trodon.png";
  if (key.includes("diablo")) return "/oraculo/Diabloceraptops.png";
  if (key.includes("deino")) return "/oraculo/deinosuchus.png";
  if (key.includes("pachy")) return "/oraculo/Pachy.png";
  if (key.includes("stego")) return "/oraculo/Stegosaurus.png";
  if (key.includes("tricera")) return "/oraculo/Triceraptops.png";
  if (key.includes("carno")) return "/oraculo/carnotaurus.png";
  if (key.includes("cerato")) return "/oraculo/cerato.png";
  if (key.includes("dilo")) return "/oraculo/dilo.png";
  if (key.includes("tenonto")) return "/oraculo/tenonto.png";
  if (key.includes("omni")) return "/oraculo/omni.png";
  if (key.includes("ptera")) return "/oraculo/pteranodon.png";
  return "";
}

function markerLabel(player: OraculoPlayer) {
  const name = player.name || "Dino";
  const species = player.species || "Especie desconocida";
  return `${name} / ${species}`;
}

function sameShownSpecies(a?: string | null, b?: string | null) {
  const left = speciesKey(a || "") || String(a || "").toLowerCase().trim();
  const right = speciesKey(b || "") || String(b || "").toLowerCase().trim();
  return Boolean(left && right && left === right);
}

function formatPercent(value: number) {
  if (value < 0) return "Sin dato";
  return Number.isFinite(value) ? `${Math.round(value)}%` : "-%";
}

function formatCoord(value: number) {
  if (!Number.isFinite(value) || value === 0) return "-";
  return value.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

function mergeFriendLinks(...groups: FriendLink[][]) {
  const rank = { accepted: 0, pending_in: 1, pending_out: 2 };
  const map = new Map<string, FriendLink>();

  for (const group of groups) {
    for (const link of group) {
      if (!/^765\d{14}$/.test(link.steamId)) continue;
      const current = map.get(link.steamId);
      if (!current || rank[link.status] < rank[current.status]) {
        map.set(link.steamId, link);
      }
    }
  }

  return [...map.values()].sort((a, b) => rank[a.status] - rank[b.status] || a.steamId.localeCompare(b.steamId));
}

function PlayerMarker({
  player,
  markerStyle,
  relationClass,
}: {
  player: OraculoPlayer;
  markerStyle: { left: string; top: string };
  relationClass: string;
}) {
  const [assetIndex, setAssetIndex] = useState(0);
  const assets = dinoAssets(player.species);
  const asset = assets[assetIndex] || "";
  const label = markerLabel(player);

  useEffect(() => {
    setAssetIndex(0);
  }, [player.species]);

  if (asset) {
    return (
      <span className={`${styles.dinoMarker} ${relationClass}`} data-label={label} style={markerStyle} title={label}>
        <img key={asset} src={asset} alt="" onError={() => setAssetIndex((index) => index + 1)} />
      </span>
    );
  }

  return null;
}


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
  return normalizeSpeciesText(String(value || "")) || String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
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
    return `${Number(realCount)}/${maxPlayers} jugadores`;
  }

  return `${Number(server.onlinePlayers || 0)}/${maxPlayers} con telemetria`;
}

export function MapaDashboard({ initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [friendLinks, setFriendLinks] = useState<FriendLink[]>([]);
  const [friendInput, setFriendInput] = useState("");
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPan, setMapPan] = useState<MapPan>({ x: 0, y: 0 });
  const [mapDragging, setMapDragging] = useState(false);
  const mapStageRef = useRef<HTMLDivElement | null>(null);
  const mapDragRef = useRef<MapDrag | null>(null);
  const friendListRef = useRef<HTMLDivElement | null>(null);
  const liveRequestRef = useRef(false);
  const friendQuery = useMemo(() => friendLinks.map((link) => link.steamId).join(","), [friendLinks]);

  const saveFriendLinks = (links: FriendLink[]) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(FRIEND_STORAGE_KEY, JSON.stringify(links));
  };

  const refreshFriends = async () => {
    try {
      const response = await fetch("/api/oraculo/friends", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      if (Array.isArray(payload.friends)) {
        setFriendLinks((current) => {
          const next = mergeFriendLinks(payload.friends, current);
          saveFriendLinks(next);
          return next;
        });
      }
    } catch {
      // Friend state stays on screen until the next successful refresh.
    }
  };

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(FRIEND_STORAGE_KEY) || "[]");
      if (Array.isArray(saved)) {
        setFriendLinks((current) => mergeFriendLinks(saved, current));
      }
    } catch {
      // Ignore malformed local friend cache.
    }
    refreshFriends();
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;

    const tick = async () => {
      if (liveRequestRef.current) {
        if (!stopped) timer = window.setTimeout(tick, document.hidden ? 60000 : 8000);
        return;
      }
      liveRequestRef.current = true;

      try {
        const params = new URLSearchParams();
        if (friendQuery) params.set("friends", friendQuery);
        const response = await fetch(`/api/oraculo/live${params.toString() ? `?${params}` : ""}`, { cache: "no-store" });
        if (!response.ok) return;
        const nextSnapshot = await response.json();
        setSnapshot((current) => {
          const nextHasTelemetry =
            nextSnapshot.activePlayer?.confidence === "live" ||
            (Array.isArray(nextSnapshot.mapPlayers) && nextSnapshot.mapPlayers.length > 0) ||
            (Array.isArray(nextSnapshot.friends) && nextSnapshot.friends.length > 0);
          const currentHasTelemetry =
            current.activePlayer?.confidence === "live" ||
            (Array.isArray(current.mapPlayers) && current.mapPlayers.length > 0) ||
            (Array.isArray(current.friends) && current.friends.length > 0);

          const nextLooksDisconnected = nextSnapshot.server?.linked === false && !nextHasTelemetry;
          return !nextHasTelemetry && (currentHasTelemetry || (current.server?.linked && nextLooksDisconnected))
            ? current
            : nextSnapshot;
        });
        refreshFriends();
      } catch {
        // Keep the map visible even if telemetry is unavailable.
      } finally {
        liveRequestRef.current = false;
        if (!stopped) timer = window.setTimeout(tick, document.hidden ? 60000 : 8000);
      }
    };

    tick();
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [friendQuery]);

  const mapMarkers = useMemo(
    () =>
      (snapshot.mapPlayers || [])
        .filter((player) => player.x !== 0 || player.y !== 0)
        .map((player) => {
          if (player.relation !== "friend" || dinoAssets(player.species).length > 0) return player;

          const friend = (snapshot.friends || []).find((item) => item.id === player.id);
          return friend?.species ? { ...player, species: friend.species, name: player.name || friend.name } : player;
        }),
    [snapshot.mapPlayers, snapshot.friends],
  );

  const steamLinked = snapshot.viewer?.linked;
  const activeDino =
    steamLinked && snapshot.activePlayer.status === "online" && snapshot.activePlayer.confidence === "live"
      ? snapshot.activePlayer
      : null;

  const sendFriendAction = async (steamId: string, action: "request" | "accept" | "remove") => {
    try {
      const response = await fetch("/api/oraculo/friends", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steamId, action }),
      });
      if (!response.ok) return;
      const payload = await response.json();
      if (Array.isArray(payload.friends)) {
        setFriendLinks((current) => {
          const next = mergeFriendLinks(payload.friends, current);
          saveFriendLinks(next);
          return next;
        });
      }
    } catch {
      // Keep current friend state.
    }
  };

  const addFriend = () => {
    const match = friendInput.match(/765\d{14}/);
    if (!match) return;

    setFriendInput("");
    setFriendLinks((current) => {
      const next = mergeFriendLinks([{ steamId: match[0], status: "pending_out" }], current);
      saveFriendLinks(next);
      return next;
    });
    sendFriendAction(match[0], "request");
  };

  const removeFriend = (id: string) => {
    setFriendLinks((current) => {
      const next = current.filter((link) => link.steamId !== id);
      saveFriendLinks(next);
      return next;
    });
    sendFriendAction(id, "remove");
  };

  const scrollFriends = (direction: -1 | 1) => {
    friendListRef.current?.scrollBy({ top: direction * 96, behavior: "smooth" });
  };

  const clampMapPan = (pan: MapPan, zoom = mapZoom) => {
    if (zoom <= 1) return { x: 0, y: 0 };

    const frame = mapStageRef.current?.parentElement?.getBoundingClientRect();
    if (!frame) return pan;

    const maxX = ((zoom - 1) * frame.width) / 2;
    const maxY = ((zoom - 1) * frame.height) / 2;

    return {
      x: clamp(pan.x, -maxX, maxX),
      y: clamp(pan.y, -maxY, maxY),
    };
  };

  useEffect(() => {
    setMapPan((pan) => clampMapPan(pan, mapZoom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapZoom]);

  const zoomBy = (delta: number, anchor?: { clientX: number; clientY: number }) => {
    setMapZoom((currentZoom) => {
      const nextZoom = clamp(Number((currentZoom + delta).toFixed(2)), MIN_ZOOM, MAX_ZOOM);
      if (nextZoom === currentZoom) return currentZoom;

      setMapPan((pan) => {
        if (nextZoom <= 1) return { x: 0, y: 0 };

        const frame = mapStageRef.current?.parentElement?.getBoundingClientRect();
        if (!anchor || !frame) return clampMapPan(pan, nextZoom);

        const anchorX = anchor.clientX - frame.left - frame.width / 2;
        const anchorY = anchor.clientY - frame.top - frame.height / 2;

        return clampMapPan(
          {
            x: anchorX - ((anchorX - pan.x) / currentZoom) * nextZoom,
            y: anchorY - ((anchorY - pan.y) / currentZoom) * nextZoom,
          },
          nextZoom,
        );
      });

      return nextZoom;
    });
  };

  const zoomIn = () => zoomBy(ZOOM_STEP);
  const zoomOut = () => zoomBy(-ZOOM_STEP);
  const centerMap = () => {
    setMapZoom(1);
    setMapPan({ x: 0, y: 0 });
  };

  const wheelZoom = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP, event);
  };

  const beginMapDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (mapZoom <= 1) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    mapDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: mapPan.x,
      originY: mapPan.y,
    };
    setMapDragging(true);
  };

  const moveMapDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = mapDragRef.current;
    if (!drag) return;

    event.preventDefault();
    setMapPan(
      clampMapPan({
        x: drag.originX + event.clientX - drag.startX,
        y: drag.originY + event.clientY - drag.startY,
      }),
    );
  };

  const endMapDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!mapDragRef.current) return;

    mapDragRef.current = null;
    setMapDragging(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer may already have been released by the browser.
    }
  };

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Datos del mapa">
        <section className={styles.panel}>
          <strong>{snapshot.server.linked ? "Servidor enlazado" : "Servidor sin enlace"}</strong>
          <span>{snapshot.server.map}</span>
          <span>{serverPopulationLabel(snapshot.server)}</span>
          {steamLinked ? (
            <>
              <span>Steam conectado</span>
              <a className={styles.steamButton} href="/api/auth/steam/logout">
                Salir
              </a>
            </>
          ) : (
            <>
              <em>Conecta Steam para ver tu dino y amigos</em>
              <a className={styles.steamButton} href="/api/auth/steam/login?next=/mapa">
                Conectar Steam
              </a>
            </>
          )}
        </section>

        <section className={styles.panel}>
          <strong>Perfil</strong>
          <span>{activeDino ? "Dino detectado" : "Dino no detectado"}</span>
          {activeDino ? <span>{activeDino.species}</span> : <span>Sin especie vinculada</span>}
          {activeDino && profileAsset(activeDino.species) ? (
            <div className={styles.profileCard}>
              <img src={profileAsset(activeDino.species)} alt={activeDino.species} />
            </div>
          ) : activeDino ? (
            <div className={styles.profileFallback}>{activeDino.species}</div>
          ) : null}
          {steamLinked && !activeDino ? <em>Esperando tu dino en telemetria</em> : null}
          {activeDino ? (
            <div className={styles.dataList}>
              <span>Growth {formatPercent(activeDino.growth)}</span>
              <span>Health {formatPercent(activeDino.health)}</span>
              <span>Stamina {formatPercent(activeDino.stamina)}</span>
              <span>Hunger {formatPercent(activeDino.hunger)}</span>
              <span>Thirst {formatPercent(activeDino.thirst)}</span>
              <span>X/LONG {formatCoord(activeDino.x)}</span>
              <span>Y/LAT {formatCoord(activeDino.y)}</span>
              <span>Z/ALT {formatCoord(activeDino.z)}</span>
            </div>
          ) : null}
        </section>

        <section className={styles.panel}>
          <strong>Amigos</strong>
          <em>Agrega SteamID64. Aparecen si estan online, son amigos y van con tu misma especie.</em>
          <div className={styles.friendForm}>
            <input
              inputMode="numeric"
              placeholder="SteamID64"
              value={friendInput}
              onChange={(event) => setFriendInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addFriend();
              }}
            />
            <button type="button" onClick={addFriend}>
              Agregar
            </button>
          </div>
          {friendLinks.length > 0 ? (
            <div className={styles.friendScroller}>
              <button type="button" aria-label="Subir amigos" onClick={() => scrollFriends(-1)}>
                ^
              </button>
              <div className={styles.friendList} ref={friendListRef}>
                {friendLinks.map((link) => {
                  const id = link.steamId;
                  const friend = snapshot.friends.find((item) => item.id === id);
                  const visible = snapshot.mapPlayers.find((item) => item.id === id);
                  const label = friend ? markerLabel(friend) : `Steam ${id.slice(-4)}`;
                  const status = visible
                    ? "visible en mapa"
                    : friend
                      ? sameShownSpecies(activeDino?.species, friend.species)
                        ? "mismo dino, esperando posicion"
                        : "otro dino, oculto"
                      : link.status === "pending_in"
                        ? "solicitud pendiente"
                        : "agregado, buscando telemetria";
                  return (
                    <div className={styles.friendRow} key={id}>
                      <span>
                        <b>{label}</b>
                        <small>{status}</small>
                      </span>
                      {link.status === "pending_in" ? (
                        <button type="button" aria-label="Aceptar amigo" onClick={() => sendFriendAction(id, "accept")}>
                          OK
                        </button>
                      ) : (
                        <button type="button" aria-label="Eliminar amigo" onClick={() => removeFriend(id)}>
                          X
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <button type="button" aria-label="Bajar amigos" onClick={() => scrollFriends(1)}>
                v
              </button>
            </div>
          ) : (
            <span>Sin amigos agregados</span>
          )}
        </section>
      </aside>

      <section className={styles.mapCard} aria-label="Mapa Refugio Primitivo">
        <div className={styles.controls} aria-label="Controles del mapa">
          <button type="button" onClick={zoomIn} aria-label="Aumentar zoom">
            +
          </button>
          <button type="button" onClick={zoomOut} aria-label="Alejar zoom">
            -
          </button>
          <button type="button" onClick={centerMap} aria-label="Centrar mapa">
            0
          </button>
        </div>

        <div
          ref={mapStageRef}
          className={`${styles.mapStage} ${mapZoom > 1 ? styles.zoomed : ""} ${mapDragging ? styles.dragging : ""}`}
          style={{ transform: `translate3d(${mapPan.x}px, ${mapPan.y}px, 0)` }}
          onPointerDown={beginMapDrag}
          onPointerMove={moveMapDrag}
          onPointerUp={endMapDrag}
          onPointerCancel={endMapDrag}
          onLostPointerCapture={endMapDrag}
          onWheel={wheelZoom}
        >
          <div className={styles.mapLayer} style={{ transform: `scale(${mapZoom})` }}>
            <img className={styles.mapImage} src="/oraculo/mapa-limpio.png" alt="Mapa Gateway" />

            {mapMarkers.map((player, index) => {
              const markerStyle = mapPoint(player.x, player.y);
              const relationClass = player.relation === "friend" ? styles.friend : styles.self;

              return (
                <PlayerMarker
                  key={`${player.id}-${index}`}
                  player={player}
                  markerStyle={markerStyle}
                  relationClass={relationClass}
                />
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
