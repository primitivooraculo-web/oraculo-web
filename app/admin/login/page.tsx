import type { Metadata } from "next";
import "../admin-panel.css";
import "./admin-login.css";

export const metadata: Metadata = {
  title: "Acceso Admin | Refugio Primitivo",
  description: "Acceso protegido al panel admin de Refugio Primitivo.",
};

type AdminLoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const params = searchParams ? await searchParams : {};
  const rawError = params.error;
  const error = Array.isArray(rawError) ? rawError[0] : rawError;

  return (
    <main className="op-admin-login">
      <section className="op-admin-login-card">
        <span className="op-panel-kicker">Refugio Primitivo</span>
        <h1>Acceso Admin</h1>
        <p>Solo cuentas Steam autorizadas pueden abrir el panel.</p>
        {error ? <p className="op-login-error">{error}</p> : null}

        <a className="op-steam-login-button" href="/api/admin/steam/login">
          Entrar con Steam
        </a>
      </section>
    </main>
  );
}
