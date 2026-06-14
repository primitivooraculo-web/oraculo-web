"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

type Color = {
  r: number;
  g: number;
  b: number;
  a: number;
};

type Colors = Record<string, Color>;

type Preset = {
  name: string;
  dino: string;
  pattern_index: number;
  gender: number;
  skin_variation: number;
  colors: Colors;
};

const COLOR_GROUPS = [
  ["male_display", "Display"],
  ["markings", "Marking"],
  ["body", "Body"],
  ["flank", "Flank"],
  ["underbelly", "Underbelly"],
  ["detail", "Detail"],
  ["eyes", "Eyes"],
] as const;

const SPECIES = [
  "Tyrannosaurus",
  "Stegosaurus",
  "Triceratops",
  "Deinosuchus",
  "Carnotaurus",
  "Ceratosaurus",
  "Allosaurus",
  "Omniraptor",
  "Dilophosaurus",
  "Dryosaurus",
  "Gallimimus",
  "Pachycephalosaurus",
  "Maiasaura",
];

const DEFAULT_COLORS: Colors = {
  male_display: { r: 0.5, g: 0.3, b: 0.2, a: 1 },
  markings: { r: 0.4, g: 0.4, b: 0.4, a: 1 },
  body: { r: 0.6, g: 0.3, b: 0.2, a: 1 },
  flank: { r: 0.5, g: 0.3, b: 0.2, a: 1 },
  underbelly: { r: 0.7, g: 0.6, b: 0.4, a: 1 },
  detail: { r: 0.3, g: 0.2, b: 0.1, a: 1 },
  eyes: { r: 0.8, g: 0.7, b: 0.1, a: 1 },
};

const PRESET_KEY = "oraculo.skin.presets.v1";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function toHexByte(value: number) {
  return Math.round(clamp01(value) * 255)
    .toString(16)
    .padStart(2, "0");
}

function colorToHex(color: Color) {
  return `#${toHexByte(color.r)}${toHexByte(color.g)}${toHexByte(color.b)}`;
}

function hexToColor(hex: string, fallback: Color): Color {
  const clean = hex.replace("#", "").trim();
  if (!/^[0-9a-f]{6}$/i.test(clean)) return fallback;
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
    a: fallback.a ?? 1,
  };
}

function compactSkinCode(dino: string, pattern: number, gender: number, colors: Colors) {
  const colorPart = COLOR_GROUPS.map(([key]) => colorToHex(colors[key]).replace("#", "").slice(0, 2)).join("");
  return `orp-${dino.slice(0, 3).toLowerCase()}-${pattern}${gender}-${colorPart}`;
}

export default function SkinsClient() {
  const [dino, setDino] = useState("Tyrannosaurus");
  const [patternIndex, setPatternIndex] = useState(0);
  const [gender, setGender] = useState(1);
  const [skinVariation, setSkinVariation] = useState(0.5);
  const [colors, setColors] = useState<Colors>(DEFAULT_COLORS);
  const [targetId, setTargetId] = useState("");
  const [presetName, setPresetName] = useState("");
  const [presets, setPresets] = useState<Preset[]>([]);
  const [activeModal, setActiveModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Listo para crear skin.");

  const localCode = useMemo(
    () => compactSkinCode(dino, patternIndex, gender, colors),
    [colors, dino, gender, patternIndex],
  );

  useEffect(() => {
    const raw = window.localStorage.getItem(PRESET_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setPresets(parsed.slice(0, 24));
    } catch {
      setPresets([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(PRESET_KEY, JSON.stringify(presets.slice(0, 24)));
  }, [presets]);

  function payload() {
    return {
      steamId: targetId.trim(),
      targetId: targetId.trim(),
      dino,
      pattern_index: patternIndex,
      gender,
      skin_variation: skinVariation,
      colors,
    };
  }

  function updateColor(key: string, hex: string) {
    setColors((current) => ({
      ...current,
      [key]: hexToColor(hex, current[key] || DEFAULT_COLORS[key]),
    }));
  }

  function resetColors() {
    setColors(DEFAULT_COLORS);
    setPatternIndex(0);
    setGender(1);
    setSkinVariation(0.5);
    setStatus("Paleta reiniciada.");
  }

  async function loadCurrent() {
    setBusy(true);
    setStatus("Leyendo skin actual...");
    try {
      const params = new URLSearchParams({ steamId: targetId.trim(), dino });
      const response = await fetch(`/api/overlay.skineditor/current?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (data?.skin?.colors) setColors(data.skin.colors);
      if (typeof data?.skin?.pattern_index === "number") setPatternIndex(data.skin.pattern_index);
      if (typeof data?.skin?.gender === "number") setGender(data.skin.gender);
      if (typeof data?.skin?.skin_variation === "number") setSkinVariation(data.skin.skin_variation);
      setStatus(response.ok ? "Skin actual cargada." : "No se pudo leer la skin.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function savePreset(event?: FormEvent) {
    event?.preventDefault();
    const name = presetName.trim() || `${dino} ${new Date().toLocaleTimeString()}`;
    const preset = {
      name: name.slice(0, 32),
      dino,
      pattern_index: patternIndex,
      gender,
      skin_variation: skinVariation,
      colors,
    };

    setPresets((current) => [preset, ...current.filter((item) => item.name !== preset.name)].slice(0, 24));
    setPresetName("");
    setStatus(`Preset guardado: ${preset.name}`);

    try {
      await fetch("/api/overlay.skineditor/preset/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ preset_name: preset.name, ...payload() }),
      });
    } catch {
      // Local preset remains saved even if the live API is unavailable.
    }
  }

  function loadPreset(preset: Preset) {
    setDino(preset.dino);
    setPatternIndex(preset.pattern_index);
    setGender(preset.gender);
    setSkinVariation(preset.skin_variation);
    setColors(preset.colors);
    setStatus(`Preset cargado: ${preset.name}`);
  }

  async function applySkin(event?: FormEvent) {
    event?.preventDefault();
    const id = targetId.trim();
    if (!/^765\d{14}$/.test(id)) {
      setStatus("SteamID64 invalido.");
      return;
    }

    setBusy(true);
    setStatus("Enviando skin a la cola...");
    try {
      const response = await fetch("/api/overlay.skineditor/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const data = await response.json();
      const jobId = data?.live?.job?.id || data?.job?.id || data?.skin?.skin_code || localCode;
      setStatus(response.ok ? `Skin en cola: ${jobId}` : `Error: ${data?.error || response.status}`);
      if (response.ok) setActiveModal(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="rp-section-page rp-skin-page">
      <div className="rp-section-shell">
        <header className="rp-section-top">
          <div>
            <span className="rp-kicker">Refugio Primitivo</span>
            <h1>Skins</h1>
          </div>
          <Link className="rp-home-link" href="/">Volver al inicio</Link>
        </header>

        <section className="rp-skin-editor">
          <aside className="rp-skin-controls">
            <span className="rp-panel-kicker">Skin Creator</span>

            <label>
              Especie
              <select value={dino} onChange={(event) => setDino(event.target.value)}>
                {SPECIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Patron
              <select value={patternIndex} onChange={(event) => setPatternIndex(Number(event.target.value))}>
                <option value={0}>Pattern A</option>
                <option value={1}>Pattern B</option>
                <option value={2}>Pattern C</option>
              </select>
            </label>

            <label>
              Variacion
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={skinVariation}
                onChange={(event) => setSkinVariation(Number(event.target.value))}
              />
            </label>

            <div className="rp-skin-toggle" role="group" aria-label="Genero">
              <button className={gender === 1 ? "is-active" : ""} type="button" onClick={() => setGender(1)}>
                Male
              </button>
              <button className={gender === 0 ? "is-active" : ""} type="button" onClick={() => setGender(0)}>
                Female
              </button>
            </div>

            <div className="rp-skin-color-list">
              {COLOR_GROUPS.map(([key, label]) => (
                <label className="rp-skin-color" key={key}>
                  <span>{label}</span>
                  <input value={colorToHex(colors[key])} type="color" onChange={(event) => updateColor(key, event.target.value)} />
                </label>
              ))}
            </div>

            <div className="rp-skin-code">
              <span>Skin code</span>
              <strong>{localCode}</strong>
            </div>

            <button className="rp-skin-button" type="button" onClick={resetColors}>
              Reset colors
            </button>
            <button className="rp-skin-button rp-skin-button-green" type="button" onClick={() => void savePreset()}>
              Guardar preset
            </button>
            <button className="rp-skin-button rp-skin-button-gold" type="button" onClick={() => setActiveModal(true)}>
              Aplicar skin
            </button>
          </aside>

          <section className="rp-skin-preview-panel">
            <div className="rp-skin-preview-top">
              <div>
                <span className="rp-panel-kicker">{dino}</span>
                <h2>Vista de color</h2>
              </div>
              <button className="rp-skin-mini-button" type="button" onClick={loadCurrent} disabled={busy}>
                Leer actual
              </button>
            </div>

            <div className="rp-skin-dino-preview" style={{ "--body": colorToHex(colors.body), "--flank": colorToHex(colors.flank), "--mark": colorToHex(colors.markings), "--detail": colorToHex(colors.detail), "--eye": colorToHex(colors.eyes) } as CSSProperties}>
              <div className="rp-skin-dino-body" />
              <div className="rp-skin-dino-neck" />
              <div className="rp-skin-dino-head" />
              <div className="rp-skin-dino-tail" />
              <i className="rp-skin-leg one" />
              <i className="rp-skin-leg two" />
              <i className="rp-skin-spike s1" />
              <i className="rp-skin-spike s2" />
              <i className="rp-skin-spike s3" />
            </div>

            <div className="rp-skin-swatch-grid">
              {COLOR_GROUPS.map(([key, label]) => (
                <button className="rp-skin-swatch" key={key} type="button" onClick={() => updateColor(key, colorToHex(colors[key]))}>
                  <i style={{ background: colorToHex(colors[key]) }} />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <form className="rp-skin-preset-form" onSubmit={savePreset}>
              <input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Nombre del preset" />
              <button type="submit">Guardar</button>
            </form>

            <div className="rp-skin-presets">
              {presets.length === 0 ? (
                <p>No hay presets guardados en este navegador.</p>
              ) : (
                presets.map((preset) => (
                  <button key={`${preset.name}-${preset.dino}`} type="button" onClick={() => loadPreset(preset)}>
                    <span>{preset.name}</span>
                    <small>{preset.dino}</small>
                  </button>
                ))
              )}
            </div>

            <div className="rp-skin-status">
              <strong>{busy ? "Procesando..." : status}</strong>
            </div>
          </section>
        </section>
      </div>

      {activeModal ? (
        <div className="rp-skin-modal" role="dialog" aria-modal="true" aria-label="Aplicar skin">
          <form className="rp-skin-modal-box" onSubmit={applySkin}>
            <h2>Aplicar skin</h2>
            <label>
              SteamID64
              <input
                autoFocus
                inputMode="numeric"
                maxLength={17}
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
                placeholder="7656..."
              />
            </label>
            <dl>
              <div>
                <dt>Dino</dt>
                <dd>{dino}</dd>
              </div>
              <div>
                <dt>Codigo</dt>
                <dd>{localCode}</dd>
              </div>
            </dl>
            <div className="rp-skin-modal-actions">
              <button type="button" onClick={() => setActiveModal(false)}>
                Cancelar
              </button>
              <button className="rp-skin-button-gold" type="submit" disabled={busy}>
                Aplicar
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
