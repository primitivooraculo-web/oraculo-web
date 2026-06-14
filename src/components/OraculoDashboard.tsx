"use client";

import { useEffect, useMemo, useState } from "react";
import type { OraculoPlayer, OraculoSnapshot } from "@/lib/oraculo-data";

type Props = {
  initialSnapshot: OraculoSnapshot;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 2.4;
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

export function OraculoDashboard({ initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [friendInput, setFriendInput] = useState("");
  const [mapZoom, setMapZoom] = useState(1);

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

    const timer = window.setInterval(tick, 4000);
    tick();
    return () => window.clearInterval(timer);
  }, [friendIds]);

  const mapMarkers = useMemo(
    () => (snapshot.mapPlayers || []).filter((player) => player.x !== 0 || player.y !== 0),
    [snapshot.mapPlayers],
  );

  const steamLinked = snapshot.viewer?.linked;
  const hasActiveDino =
    steamLinked && snapshot.activePlayer.status === "online" && snapshot.activePlayer.confidence === "live";
  const activeDino = hasActiveDino ? snapshot.activePlayer : null;

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

  const zoomIn = () => setMapZoom((zoom) => clamp(Number((zoom + ZOOM_STEP).toFixed(2)), MIN_ZOOM, MAX_ZOOM));
  const zoomOut = () => setMapZoom((zoom) => clamp(Number((zoom - ZOOM_STEP).toFixed(2)), MIN_ZOOM, MAX_ZOOM));
  const centerMap = () => setMapZoom(1);

  return (
    <main className="clean-shell">
      <aside className="clean-sidebar" aria-label="Datos del mapa">
        <section className="clean-panel">
          <strong>{snapshot.server.linked ? "Servidor enlazado" : "Servidor sin enlace"}</strong>
          <span>{snapshot.server.map}</span>
          <span>{snapshot.server.onlinePlayers}/200 jugadores</span>
          {steamLinked ? (
            <>
              <span>Steam conectado</span>
              <a className="clean-steam-button" href="/api/auth/steam/logout">
                Salir
              </a>
            </>
          ) : (
            <>
              <em>Conecta Steam para ver tu dino y amigos</em>
              <a className="clean-steam-button" href="/api/auth/steam/login">
                Conectar Steam
              </a>
            </>
          )}
        </section>

        <section className="clean-panel">
          <strong>Perfil</strong>
          <span>{activeDino ? "Dino detectado" : "Dino no detectado"}</span>
          {activeDino && profileAsset(activeDino.species) ? (
            <div className="profile-dino-card">
              <img src={profileAsset(activeDino.species)} alt={activeDino.species} />
            </div>
          ) : (
            <span>Sin especie vinculada</span>
          )}
          {steamLinked && !activeDino ? <em>Esperando tu dino en telemetria</em> : null}
          {activeDino ? (
            <div className="clean-data-list">
              <span>Growth {activeDino.growth || "-"}%</span>
              <span>Health {activeDino.health || "-"}%</span>
              <span>Stamina {activeDino.stamina || "-"}%</span>
              <span>Hunger {activeDino.hunger || "-"}%</span>
              <span>Thirst {activeDino.thirst || "-"}%</span>
            </div>
          ) : null}
        </section>

        <section className="clean-panel">
          <strong>Amigos</strong>
          <em>Agrega SteamID64. Solo aparecen en el mapa si estan online con tu mismo dino.</em>
          <div className="friend-form">
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
            <div className="clean-friend-list">
              {friendIds.map((id) => {
                const visible = snapshot.friends.find((friend) => friend.id === id);
                return (
                  <div className="friend-row" key={id}>
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

      <section className="clean-map-card" aria-label="Mapa Refugio Primitivo">
        <div className="map-controls" aria-label="Controles del mapa">
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

        <div className="clean-map-stage" style={{ transform: `scale(${mapZoom})` }}>
          <img className="clean-map" src="/oraculo/mapa-limpio.png" alt="Mapa Gateway" />

          {mapMarkers.map((player, index) => {
            const asset = dinoAsset(player.species);
            const label = markerLabel(player);
            const markerStyle = mapPoint(player.x, player.y);

            return asset ? (
              <span
                className={`clean-dino-marker ${player.relation}`}
                data-label={label}
                key={`${player.id}-${index}`}
                style={markerStyle}
                title={label}
              >
                <img src={asset} alt="" />
              </span>
            ) : (
              <span
                className={`clean-live-marker unknown ${player.relation}`}
                data-label={label}
                key={`${player.id}-${index}`}
                style={markerStyle}
                title={label}
              />
            );
          })}
        </div>
      </section>
    </main>
  );
}
