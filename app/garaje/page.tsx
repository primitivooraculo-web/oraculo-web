export const metadata = {
  title: "Garage en pausa | Oraculo Primitivo",
  description: "Trabajando en ello mientras hacemos pruebas.",
};

export default function GarageTemporalPage() {
  return (
    <main style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      padding: "24px",
      background: "#090b10",
      color: "#f7f7fb",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    }}>
      <section style={{
        width: "min(560px, 100%)",
        border: "1px solid rgba(255,255,255,.14)",
        borderRadius: "8px",
        padding: "28px",
        background: "rgba(255,255,255,.045)",
        textAlign: "center"
      }}>
        <p style={{
          margin: "0 0 10px",
          color: "#aab2c5",
          fontSize: "13px",
          letterSpacing: ".08em",
          textTransform: "uppercase"
        }}>
          Oraculo Primitivo
        </p>
        <h1 style={{
          margin: "0 0 12px",
          fontSize: "clamp(30px, 7vw, 48px)",
          lineHeight: 1.05,
          fontWeight: 800
        }}>
          Garage en pausa
        </h1>
        <p style={{
          margin: 0,
          color: "#d9deeb",
          fontSize: "18px",
          lineHeight: 1.55
        }}>
          Trabajando en ello mientras hacemos pruebas.
        </p>
      </section>
    </main>
  );
}
