import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import "../oraculo-home.css";
import GarageActionsClient from "./GarageActionsClient";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "../../lib/oraculo-admin-auth";
import { getGaragePlayerData } from "../../lib/oraculo-garage-data";
import { PLAYER_SESSION_COOKIE, verifyPlayerSessionToken } from "../../lib/oraculo-player-auth";

export const metadata: Metadata = {
  title: "Mi Garaje | Refugio Primitivo",
  description: "Garaje privado de Refugio Primitivo.",
};

function steamLabel(steamId: string) {
  return steamId ? `Steam ${steamId.slice(-4)}` : "Steam";
}

function GarageLoginGate() {
  return (
    <main className="rp-section-page">
      <div className="rp-section-shell">
        <header className="rp-section-top">
          <div>
            <span className="rp-kicker">Refugio Primitivo</span>
            <h1>Mi Garaje</h1>
            <p className="rp-section-subtitle">Tu inventario privado de dinos, tokens y skins.</p>
          </div>
          <Link className="rp-home-link" href="/">Volver al inicio</Link>
        </header>

        <section className="rp-section-content">
          <div className="rp-section-hero">
            <span className="rp-panel-kicker">Acceso privado</span>
            <h1>Conecta Steam</h1>
            <p>El garaje ya no muestra dinos de otros jugadores. Entra con Steam para ver solo tus dinos guardados.</p>
            <div className="rp-garage-actions">
              <a className="rp-home-link" href="/api/auth/steam/login?next=/garaje">Entrar con Steam</a>
            </div>
          </div>

          <div className="rp-section-panel">
            <span className="rp-panel-kicker">Privacidad</span>
            <h2>Solo tu cuenta</h2>
            <p>La pagina publica no entrega el resumen global del garage. La lectura completa queda reservada al panel admin.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default async function GaragePage() {
  const cookieStore = await cookies();
  const playerSession = verifyPlayerSessionToken(cookieStore.get(PLAYER_SESSION_COOKIE)?.value);
  const adminSession = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const steamId = playerSession.ok ? playerSession.steamId : adminSession.ok ? adminSession.steamId : "";

  if (!steamId) return <GarageLoginGate />;

  const garage = getGaragePlayerData(steamId);

  return (
    <main className="rp-section-page">
      <div className="rp-section-shell">
        <header className="rp-section-top">
          <div>
            <span className="rp-kicker">Refugio Primitivo</span>
            <h1>Mi Garaje</h1>
            <p className="rp-section-subtitle">Inventario privado vinculado a tu SteamID64.</p>
          </div>
          <div className="rp-garage-actions">
            <a className="rp-home-link" href="/api/auth/steam/logout?next=/">Salir</a>
            <Link className="rp-home-link" href="/">Volver al inicio</Link>
          </div>
        </header>

        <section className="rp-garage-layout">
          <div className="rp-section-hero rp-garage-hero">
            <span className="rp-panel-kicker">Estado</span>
            <h1>{garage.hasPlayerData ? "Garaje Activo" : "Garaje Sin Dinos"}</h1>
            <p>
              {garage.hasPlayerData
                ? "Tus dinos, tokens y cosmeticos ya estan filtrados por tu cuenta Steam."
                : "Tu cuenta esta vinculada, pero no encontramos dinos guardados para este SteamID."}
            </p>
            <span className="rp-garage-session">{steamLabel(steamId)}</span>
          </div>

          <div className="rp-garage-metrics" aria-label="Resumen de mi garaje">
            <div><span>Mis Dinos</span><strong>{garage.totals.garageDinos}</strong></div>
            <div><span>Wallets</span><strong>{garage.totals.wallets}</strong></div>
            <div><span>Mis Skins</span><strong>{garage.totals.playerSkins}</strong></div>
            <div><span>Steam</span><strong>{steamId.slice(-4)}</strong></div>
          </div>

          <GarageActionsClient />

          <div className="rp-section-panel rp-garage-panel">
            <span className="rp-panel-kicker">Inventario</span>
            <h2>Mis Dinos Guardados</h2>
            <div className="rp-garage-table" role="table" aria-label="Mis dinos guardados">
              <div className="rp-garage-row rp-garage-row-personal rp-garage-head" role="row">
                <span>Dino</span>
                <span>Growth</span>
                <span>Health</span>
                <span>Estado</span>
              </div>
              {garage.latestDinos.length ? (
                garage.latestDinos.map((dino) => (
                  <div className="rp-garage-row rp-garage-row-personal" role="row" key={dino.id}>
                    <strong>{dino.nickname}<small>{dino.species}</small></strong>
                    <span>{dino.growth}%</span>
                    <span>{dino.health}%</span>
                    <span>{dino.primeElder ? "Prime Elder" : dino.parkedAt}</span>
                  </div>
                ))
              ) : (
                <div className="rp-garage-empty">No tienes dinos guardados todavia.</div>
              )}
            </div>
          </div>

          <aside className="rp-section-panel rp-garage-side">
            <span className="rp-panel-kicker">Balance</span>
            <h2>Mis Tokens</h2>
            <div className="rp-status-list">
              <div><span>Monedas</span><strong>{garage.walletTotals.currency}</strong></div>
              <div><span>Dino Tokens</span><strong>{garage.walletTotals.dinoTokens}</strong></div>
              <div><span>Apex Tokens</span><strong>{garage.walletTotals.apexTokens}</strong></div>
              <div><span>Growth Medio</span><strong>{garage.averages.growth}%</strong></div>
            </div>
          </aside>

          <div className="rp-section-panel rp-garage-panel">
            <span className="rp-panel-kicker">Especies</span>
            <h2>Mi Resumen</h2>
            <div className="rp-garage-species">
              {garage.species.length ? (
                garage.species.map((item) => (
                  <div key={item.label}>
                    <strong>{item.label}</strong>
                    <span>{item.count} guardado{item.count === 1 ? "" : "s"}</span>
                    <small>{item.prime} Prime Elder</small>
                  </div>
                ))
              ) : (
                <p>No tienes especies cargadas aun.</p>
              )}
            </div>
          </div>

          <aside className="rp-section-panel rp-garage-side">
            <span className="rp-panel-kicker">Cosmeticos</span>
            <h2>Mis Skins</h2>
            <div className="rp-garage-skins">
              {garage.skinSamples.length ? (
                garage.skinSamples.map((skin) => (
                  <div key={skin.id}>
                    <strong>{skin.skinName}</strong>
                    <span>{skin.species}</span>
                  </div>
                ))
              ) : (
                <p>Sin skins importadas para tu cuenta.</p>
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
