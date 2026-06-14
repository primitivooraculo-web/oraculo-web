"use client";

import { useEffect, useMemo, useState } from "react";

type GarageVaultSave = {
  id: string;
  species: string;
  growth: number;
  health: number;
  stamina: number;
  hunger: number;
  thirst: number;
  location?: { x?: number; y?: number; z?: number } | null;
  diet?: unknown;
  mutations?: unknown;
  primeElder?: boolean;
  hasSkin?: boolean;
  capturedAt: string;
  used: boolean;
  usedAt?: string | null;
  status: "available" | "used";
};

type VaultResponse = {
  success?: boolean;
  error?: string;
  rules?: {
    saveMinGrowth?: number;
    reuseMaxGrowth?: number;
    reuseOnce?: boolean;
    sameSpecies?: boolean;
  };
  saves?: GarageVaultSave[];
};

function percent(value: number | undefined) {
  const n = Number(value || 0);
  return `${Math.round(Math.max(0, Math.min(1, n)) * 100)}%`;
}

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function locationLabel(value?: GarageVaultSave["location"]) {
  if (!value) return "Coordenadas guardadas: no detectadas";
  const coords = [value.x, value.y, value.z].map((item) => Number(item || 0).toFixed(0));
  return `Coordenadas: ${coords.join(" / ")}`;
}

async function jsonFetch(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");

  const response = await fetch(path, {
    ...init,
    headers,
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

export default function GarageActionsClient() {
  const [saves, setSaves] = useState<GarageVaultSave[]>([]);
  const [rules, setRules] = useState<VaultResponse["rules"]>({});
  const [status, setStatus] = useState("Sincronizando dinos guardados...");
  const [busy, setBusy] = useState("");

  const available = useMemo(() => saves.filter((save) => !save.used), [saves]);

  async function loadSaves() {
    const { response, data } = await jsonFetch("/api/oraculo/garage/vault");
    const payload = data as VaultResponse;
    if (!response.ok || payload.success === false) {
      setStatus(payload.error || "No se pudo leer la boveda del garaje.");
      return;
    }
    setSaves(Array.isArray(payload.saves) ? payload.saves : []);
    setRules(payload.rules || {});
    setStatus("Boveda de garaje sincronizada.");
  }

  useEffect(() => {
    loadSaves().catch((error) => {
      setStatus(error instanceof Error ? error.message : String(error));
    });
  }, []);

  async function saveDino() {
    if (!window.confirm("Guardar tu dinosaurio captura su estado actual y luego ejecuta la muerte del dino. Continuar?")) {
      return;
    }
    setBusy("save");
    setStatus("Leyendo tu dino activo y preparando guardado...");
    try {
      const { response, data } = await jsonFetch("/api/oraculo/garage/save", { method: "POST" });
      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || "No se pudo guardar el dinosaurio.");
      }
      setStatus("Dinosaurio guardado. El uso queda disponible una sola vez.");
      await loadSaves();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy("");
    }
  }

  async function reuseDino(save: GarageVaultSave) {
    if (save.used) return;
    if (!window.confirm(`Reutilizar ${save.species}? Debes tener esa misma especie activa y menos de 30% growth.`)) {
      return;
    }
    setBusy(save.id);
    setStatus("Validando especie/growth y aplicando snapshot...");
    try {
      const { response, data } = await jsonFetch("/api/oraculo/garage/reuse", {
        method: "POST",
        body: JSON.stringify({ saveId: save.id }),
      });
      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || "No se pudo reutilizar el dinosaurio.");
      }
      setStatus("Dinosaurio reutilizado. Este guardado ya quedo consumido.");
      await loadSaves();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="rp-section-panel rp-garage-panel rp-garage-vault">
      <div className="rp-garage-vault-top">
        <div>
          <span className="rp-panel-kicker">PrimalCore</span>
          <h2>Guardar y Reutilizar</h2>
          <p>
            Guarda un dinosaurio con al menos {percent(rules?.saveMinGrowth ?? 0.75)} de growth.
            Reutilizalo una sola vez con la misma especie antes del {percent(rules?.reuseMaxGrowth ?? 0.3)}.
          </p>
        </div>
        <button className="rp-garage-command rp-garage-command-save" type="button" onClick={saveDino} disabled={Boolean(busy)}>
          {busy === "save" ? "Guardando..." : "Guardar dinosaurio"}
        </button>
      </div>

      <p className="rp-garage-vault-status">{status}</p>

      <div className="rp-garage-save-grid">
        {saves.length ? (
          saves.map((save) => (
            <article className={`rp-garage-save-card ${save.used ? "is-used" : ""}`} key={save.id}>
              <div>
                <span className="rp-panel-kicker">{save.used ? "Usado" : "Disponible"}</span>
                <h3>{save.species}</h3>
                <p>{dateLabel(save.capturedAt)} - {locationLabel(save.location)}</p>
              </div>
              <dl>
                <div><dt>Growth</dt><dd>{percent(save.growth)}</dd></div>
                <div><dt>Vida</dt><dd>{percent(save.health)}</dd></div>
                <div><dt>Comida</dt><dd>{percent(save.hunger)}</dd></div>
                <div><dt>Sed</dt><dd>{percent(save.thirst)}</dd></div>
                <div><dt>Skin</dt><dd>{save.hasSkin ? "Guardada" : "No detectada"}</dd></div>
                <div><dt>Dieta</dt><dd>{save.diet ? "Guardada" : "No detectada"}</dd></div>
              </dl>
              <button
                className="rp-garage-command"
                type="button"
                onClick={() => reuseDino(save)}
                disabled={Boolean(busy) || save.used}
              >
                {save.used ? "Consumido" : busy === save.id ? "Aplicando..." : "Reutilizar dinosaurio"}
              </button>
            </article>
          ))
        ) : (
          <div className="rp-garage-empty">
            No tienes dinosaurios guardados para reutilizar. Guarda tu dino activo cuando tenga 75% o mas.
          </div>
        )}
      </div>

      <div className="rp-garage-vault-note">
        <strong>{available.length}</strong>
        <span>guardado{available.length === 1 ? "" : "s"} disponible{available.length === 1 ? "" : "s"}</span>
      </div>
    </div>
  );
}
