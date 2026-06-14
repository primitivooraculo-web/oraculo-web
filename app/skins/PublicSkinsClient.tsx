"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

type PublicSkinColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

type PublicSkinPreset = {
  id: string;
  name: string;
  status: "available" | "draft" | "disabled";
  dino: string;
  pattern_index: number;
  gender: number;
  skin_variation: number;
  colors: Record<string, PublicSkinColor>;
};

type PublicSkinsClientProps = {
  generatedAt: string | null;
  presets: PublicSkinPreset[];
};

const COLOR_LABELS: Record<string, string> = {
  male_display: "Display",
  markings: "Markings",
  body: "Body",
  flank: "Flank",
  underbelly: "Underbelly",
  detail: "Detail",
  eyes: "Eyes",
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function colorCss(color: PublicSkinColor) {
  const r = Math.round(clamp01(color.r) * 255);
  const g = Math.round(clamp01(color.g) * 255);
  const b = Math.round(clamp01(color.b) * 255);
  const a = clamp01(color.a ?? 1);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function generatedLabel(value: string | null) {
  if (!value) return "Pendiente";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function PublicSkinsClient({ generatedAt, presets }: PublicSkinsClientProps) {
  const [selectedId, setSelectedId] = useState(presets[0]?.id || "");
  const [steamId, setSteamId] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Elige un preset aprobado.");

  const selected = useMemo(
    () => presets.find((preset) => preset.id === selectedId) || presets[0] || null,
    [presets, selectedId],
  );

  async function applyPreset(event: FormEvent) {
    event.preventDefault();
    if (!selected) {
      setStatus("No hay preset seleccionado.");
      return;
    }

    const cleanSteamId = steamId.trim();
    if (!/^765\d{14}$/.test(cleanSteamId)) {
      setStatus("SteamID64 invalido.");
      return;
    }

    setBusy(true);
    setStatus("Enviando preset aprobado...");
    try {
      const response = await fetch("/api/oraculo/skins/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ presetId: selected.id, steamId: cleanSteamId }),
      });
      const data = await response.json();
      setStatus(response.ok ? data?.message || "Preset enviado." : data?.error || `HTTP ${response.status}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="rp-section-page rp-public-skins-page">
      <div className="rp-section-shell">
        <header className="rp-section-top">
          <div>
            <span className="rp-kicker">Refugio Primitivo</span>
            <h1>Skins</h1>
            <p className="rp-section-subtitle">
              Presets aprobados por el equipo. La creacion queda reservada para administracion.
            </p>
          </div>
          <Link className="rp-home-link" href="/">Volver al inicio</Link>
        </header>

        <section className="rp-public-skins">
          <div className="rp-public-skin-grid" aria-label="Presets aprobados">
            {presets.length ? (
              presets.map((preset) => (
                <button
                  className={`rp-public-skin-card ${preset.id === selected?.id ? "is-active" : ""}`}
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedId(preset.id)}
                >
                  <span className="rp-panel-kicker">{preset.dino}</span>
                  <strong>{preset.name}</strong>
                  <small>
                    Pattern {preset.pattern_index} / {preset.gender === 1 ? "Male" : "Female"}
                  </small>
                  <span className="rp-public-swatch-row" aria-hidden="true">
                    {Object.entries(preset.colors).map(([name, color]) => (
                      <i key={name} style={{ background: colorCss(color) }} title={COLOR_LABELS[name] || name} />
                    ))}
                  </span>
                </button>
              ))
            ) : (
              <div className="rp-section-panel rp-public-empty">
                <span className="rp-panel-kicker">Catalogo</span>
                <h2>No hay presets disponibles.</h2>
                <p>Cuando el equipo publique skins aprobadas, apareceran aqui.</p>
              </div>
            )}
          </div>

          <aside className="rp-section-panel rp-public-apply-panel">
            <span className="rp-panel-kicker">Aplicar</span>
            <h2>{selected ? selected.name : "Sin preset"}</h2>
            {selected ? (
              <>
                <div className="rp-public-preview" aria-hidden="true">
                  <div style={{ background: colorCss(selected.colors.body) }} />
                  <div style={{ background: colorCss(selected.colors.flank) }} />
                  <div style={{ background: colorCss(selected.colors.markings) }} />
                </div>

                <dl className="rp-public-skin-meta">
                  <div>
                    <dt>Dino</dt>
                    <dd>{selected.dino}</dd>
                  </div>
                  <div>
                    <dt>Variacion</dt>
                    <dd>{Math.round(selected.skin_variation * 100)}%</dd>
                  </div>
                  <div>
                    <dt>Actualizado</dt>
                    <dd>{generatedLabel(generatedAt)}</dd>
                  </div>
                </dl>

                <form className="rp-public-apply-form" onSubmit={applyPreset}>
                  <label>
                    SteamID64
                    <input
                      inputMode="numeric"
                      maxLength={17}
                      placeholder="7656..."
                      value={steamId}
                      onChange={(event) => setSteamId(event.target.value)}
                    />
                  </label>
                  <button type="submit" disabled={busy}>
                    {busy ? "Enviando..." : "Aplicar preset"}
                  </button>
                </form>
              </>
            ) : null}

            <p className="rp-public-status">{status}</p>
          </aside>
        </section>
      </div>
    </main>
  );
}
