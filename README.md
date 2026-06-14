# Oraculo Web - Refugio Primitivo

## Que trae

- Next.js con App Router.
- Ruta principal `/player`; `/` redirige ahi.
- Endpoint `/api/oraculo/live` para la pagina Mapa.
- Endpoint `/api/oraculo/ingest` para recibir snapshots del agente v3.
- Conexion server-side opcional al agente con `ORACULO_AGENT_URL` y `ORACULO_AGENT_TOKEN`.
- Assets REFU en `public/oraculo`.
- Modulos visuales preparados: Mapa, Garage, Skins y Patreon.

## Como probar

```powershell
npm.cmd install
npm.cmd run dev
```

Luego abrir:

```text
http://localhost:3000/player
```

## Como reemplazar en Codespace

1. Hacer backup del proyecto actual.
2. Descomprimir este zip dentro del repo `oraculo-web`.
3. Ejecutar `npm install` si faltan dependencias.
4. Configurar las variables en Vercel.
5. Deploy.

## Variables en Vercel

Minimo para el modo push del agente Windows:

```text
ORACULO_INGEST_TOKEN=token_largo_limpio
```

Opcional si expones el agente por HTTPS y quieres lectura directa:

```text
ORACULO_AGENT_URL=https://bridge.oraculoprimitivo.xyz
ORACULO_AGENT_TOKEN=token_largo_limpio
```

Tambien reconoce `BRIDGE_URL` y `BRIDGE_TOKEN` para compatibilidad.

## Flujo recomendado

```text
Agente Windows v3 -> https://oraculoprimitivo.xyz/api/oraculo/ingest -> /player
```

La web no habla con RCON directo. RCON queda solo en Windows/OVH.
