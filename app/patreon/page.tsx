import type { Metadata } from "next";
import Link from "next/link";
import "../oraculo-home.css";

export const metadata: Metadata = {
  title: "Patreon | Refugio Primitivo",
  description: "Beneficios Patreon de Refugio Primitivo.",
};

export default function PatreonPage() {
  return (
    <main className="rp-section-page">
      <div className="rp-section-shell">
        <header className="rp-section-top">
          <div>
            <span className="rp-kicker">Refugio Primitivo</span>
            <h1>Patreon</h1>
          </div>
          <Link className="rp-home-link" href="/">Volver al inicio</Link>
        </header>

        <section className="rp-section-content">
          <div className="rp-section-hero">
            <span className="rp-panel-kicker">Beneficios</span>
            <h1>Soporte</h1>
            <p>Espacio preparado para perks, skins, slots, roles y beneficios cuando conectemos pagos/roles reales.</p>
          </div>
          <div className="rp-section-panel">
            <span className="rp-panel-kicker">Estado</span>
            <h2>Listo para enlazar</h2>
            <div className="rp-status-list">
              <div><span>Roles</span><strong>Requiere Discord/DB</strong></div>
              <div><span>Perks</span><strong>Requiere reglas</strong></div>
              <div><span>Pagos</span><strong>Requiere proveedor</strong></div>
              <div><span>Auditoria</span><strong>Requiere DB</strong></div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

