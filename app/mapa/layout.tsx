import Link from "next/link";
import type { ReactNode } from "react";
import "./mapa-menu.css";

export default function MapaLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Link className="rp-mapa-menu-button" href="/" aria-label="Volver al menu principal">
        Volver al menu
      </Link>
    </>
  );
}
