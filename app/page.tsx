import type { Metadata } from "next";
import Link from "next/link";
import "./oraculo-home.css";

export const metadata: Metadata = {
  title: "Refugio Primitivo",
  description: "Portal principal de Refugio Primitivo.",
};

const navItems = [
  { href: "/mapa", label: "Mapa", icon: "M", image: "/oraculo/portada/mapa.png" },
  { href: "/garaje", label: "Garage", icon: "G", image: "/oraculo/portada/garage.png" },
  { href: "/skins", label: "Skins", icon: "S", image: "/oraculo/portada/skin.png" },
  { href: "/patreon", label: "Patreon", icon: "P", image: "/oraculo/portada/patreon.png" },
];

export default function HomePage() {
  return (
    <main className="rp-home">
      <div className="rp-home-inner">
        <section className="rp-title-row">
          <div
            className="rp-home-title-art"
            aria-label="Refugio Primitivo. Refugio. El ecosistema. Nuestras reglas."
          >
            <img
              className="rp-home-title-image"
              src="/oraculo/portada/ecosistema.png"
              alt=""
              aria-hidden="true"
            />
            <div className="rp-home-title-copy" aria-hidden="true">
              <span className="rp-kicker">Refugio Primitivo</span>
              <h1>Refugio</h1>
              <p>El ecosistema. Nuestras reglas.</p>
            </div>
          </div>
          <Link className="rp-admin-link" href="/admin">
            Panel admin
          </Link>
        </section>

        <nav className="rp-nav-grid" aria-label="Refugio Primitivo">
          {navItems.map((item) => (
            <Link className="rp-nav-card" href={item.href} key={item.href} aria-label={item.label}>
              <span className="rp-nav-copy" aria-hidden="true">
                <span className="rp-nav-icon">{item.icon}</span>
                <strong>{item.label}</strong>
              </span>
              <img className="rp-nav-image" src={item.image} alt="" aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
