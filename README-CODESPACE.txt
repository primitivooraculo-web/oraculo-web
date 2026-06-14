ORACULO THE PIT + CONTADOR

Usar en:

  /workspaces/oraculo-web

Pasos:

  cd /workspaces/oraculo-web
  unzip ORACULO-PIT-CONTADOR.zip
  node INSTALAR-PIT-CONTADOR.cjs
  npm run build
  npx vercel --prod

Que cambia:

- Agrega calibracion local para The Pit / zona oeste-sur usando 4 referencias:

  P2 Lat 314279.962 Long -351865.249
  P3 Lat 165219.555 Long -329678.945
  P4 Lat 224438.711 Long -179415.686
  P5 Lat 416562.472 Long -245264.602

- La correccion solo actua dentro de una caja local:

  Long: -390000 a -120000
  Lat:   120000 a  450000

- Fuera de esa zona no cambia la telemetria.

- Cambia el contador para no mentir:
  si hay contador real, muestra "jugadores";
  si solo viene del live map, muestra "con telemetria".

No toca:

- APIs.
- Steam.
- Privacidad.
- Mapa visual.
- Fotos de dinos.

Backups:

  .oraculo-local-backups/pit-contador-YYYYMMDDHHMMSS/
