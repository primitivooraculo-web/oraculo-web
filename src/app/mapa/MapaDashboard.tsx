"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
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

const MIN_ZOOM = 1;
const MAX_ZOOM = 2.8;
const ZOOM_STEP = 0.25;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function mapPoint(long: number, lat: number) {
  // The Isle reports Location X as LONG and Location Y as LAT.
  const left = 50.768908858 + lat * -0.0000009025321571032 + long * 0.00006431112670525434;
  const top = 51.309668499 + lat * 0.00009743005399230205 + long * -0.000004179099883339923;

  return {
    left: `${clamp(left, 3, 97)}%`,
    top: `${clamp(top, 3, 97)}%`,
  };
}

function dinoAsset(species: string) {
  const key = species.toLowerCase();
  if (key.includes("tricera")) return "/oraculo/triceratops-walk.gif";
  return "";
}

function profileAsset(species: string) {
  const key = species.toLowerCase();
  if (key.includes("tyrann") || key.includes("rex")) return "/oraculo/rex.png";
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

export function MapaDashboard({ initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [friendInput, setFriendInput] = useState("");
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPan, setMapPan] = useState<MapPan>({ x: 0, y: 0 });
  const [mapDragging, setMapDragging] = useState(false);
  const mapStageRef = useRef<HTMLDivElement | null>(null);
  const mapDragRef = useRef<MapDrag | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("oraculo_friend_ids") || "[]");
      if (Array.isArray(saved)) {
        setFriendIds(saved.filter((id) => typeof id === "string" && /^765\d{14}$/.test(id)).slice(0, 20));
      }
    } catch {
      setFriendIds([]);
    }
  }, []);

  useEffect(() => {
    const tick = async () => {
      try {
        const params = new URLSearchParams();
        if (friendIds.length > 0) params.set("friends", friendIds.join(","));
        const query = params.toString();
        const response = await fetch(`/api/oraculo/live${query ? `?${query}` : ""}`, { cache: "no-store" });
        if (!response.ok) return;
        setSnapshot(await response.json());
      } catch {
        // Keep the map visible even if telemetry is unavailable.
      }
    };

    // 🔥 AQUÍ ESTÁ LA CURA DEL LOOP INFINITO 🔥
    // Eliminamos el setInterval que bombardeaba el servidor cada 4 segundos.
    // Ahora, el mapa ejecuta esta consulta UNA SOLA VEZ y se detiene.
    tick();
  }, [friendIds]);

  const mapMarkers = useMemo(
    () => (snapshot.mapPlayers || []).filter((player) => player.x !== 0 || player.y !== 0),
    [snapshot.mapPlayers],
  );

  const steamLinked = snapshot.viewer?.linked;
  const activeDino =
    steamLinked && snapshot.activePlayer.status === "online" && snapshot.activePlayer.confidence === "live"
      ? snapshot.activePlayer
      : null;

  const addFriend = () => {
    const match = friendInput.match(/765\d{14}/);
    if (!match) return;

    const next = Array.from(new Set([...friendIds, match[0]])).slice(0, 20);
    setFriendIds(next);
    setFriendInput("");
    window.localStorage.setItem("oraculo_friend_ids", JSON.stringify(next));
  };

  const removeFriend = (id: string) => {
    const next = friendIds.filter((friendId) => friendId !== id);
    setFriendIds(next);
    window.localStorage.setItem("oraculo_friend_ids", JSON.stringify(next));
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

  const zoomIn = () => setMapZoom((zoom) => clamp(Number((zoom + ZOOM_STEP).toFixed(2)), MIN_ZOOM, MAX_ZOOM));
  const zoomOut = () => setMapZoom((zoom) => clamp(Number((zoom - ZOOM_STEP).toFixed(2)), MIN_ZOOM, MAX_ZOOM));
  const centerMap = () => {
    setMapZoom(1);
    setMapPan({ x: 0, y: 0 });
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
          <span>
            {snapshot.server.onlinePlayers}/{snapshot.server.maxPlayers || 200} jugadores
          </span>
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
              <a className={styles.steamButton} href="/api/auth/steam/login">
                Conectar Steam
              </a>
            </>
          )}
        </section>

        <section className={styles.panel}>
          <strong>Perfil</strong>
          <span>{activeDino ? "Dino detectado" : "Dino no detectado"}</span>
          {activeDino && profileAsset(activeDino.species) ? (
            <div className={styles.profileCard}>
              <img src={profileAsset(activeDino.species)} alt={activeDino.species} />
            </div>
          ) : (
            <span>Sin especie vinculada</span>
          )}
          {steamLinked && !activeDino ? <em>Esperando tu dino en telemetria</em> : null}
          {activeDino ? (
            <div className={styles.dataList}>
              <span>Growth {activeDino.growth || "-"}%</span>
              <span>Health {activeDino.health || "-"}%</span>
              <span>Stamina {activeDino.stamina || "-"}%</span>
              <span>Hunger {activeDino.hunger || "-"}%</span>
              <span>Thirst {activeDino.thirst || "-"}%</span>
            </div>
          ) : null}
        </section>

        <section className={styles.panel}>
          <strong>Amigos</strong>
          <em>Agrega SteamID64. Solo aparecen en el mapa si estan online con tu mismo dino.</em>
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
          {friendIds.length > 0 ? (
            <div className={styles.friendList}>
              {friendIds.map((id) => {
                const visible = snapshot.friends.find((friend) => friend.id === id);
                return (
                  <div className={styles.friendRow} key={id}>
                    <span>{visible ? markerLabel(visible) : `${id.slice(-4)} esperando`}</span>
                    <button type="button" aria-label="Eliminar amigo" onClick={() => removeFriend(id)}>
                      X
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <span>Sin amigos visibles</span>
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
        >
          <div className={styles.mapLayer} style={{ transform: `scale(${mapZoom})` }}>
            <img className={styles.mapImage} src="/oraculo/mapa-limpio.png" alt="Mapa Gateway" />

            {mapMarkers.map((player, index) => {
              const asset = dinoAsset(player.species);
              const label = markerLabel(player);
              const markerStyle = mapPoint(player.x, player.y);
              const relationClass = player.relation === "friend" ? styles.friend : styles.self;

              return asset ? (
                <span
                  className={`${styles.dinoMarker} ${relationClass}`}
                  data-label={label}
                  key={`${player.id}-${index}`}
                  style={markerStyle}
                  title={label}
                >
                  <img src={asset} alt="" />
                </span>
              ) : (
                <span
                  className={`${styles.liveMarker} ${styles.unknown} ${relationClass}`}
                  data-label={label}
                  key={`${player.id}-${index}`}
                  style={markerStyle}
                  title={label}
                />
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}