# Oraculo Skins Live Agent

Este paquete activa el motor de skins en el agente OVH.

## Que queda funcionando

- `GET /api/overlay.skineditor/current`
- `GET /api/overlay.skineditor/defaults`
- `GET /api/overlay.skineditor/skin-config`
- `GET /api/overlay.skineditor/presets`
- `POST /api/overlay.skineditor/save`
- `POST /api/overlay.skineditor/preset/save`
- `POST /api/overlay.skineditor/preset/delete`
- `POST /api/overlay.skineditor/export`
- `POST /api/overlay.skineditor/purchase`

El agente guarda datos en:

```txt
C:\Users\Administrator\Desktop\oraculo-admin-agent\data\skins-store.json
```

si `ORACULO_SKINS_STORE_PATH` queda vacio.

## Instalar en OVH

En el OVH:

```powershell
cd C:\Users\Administrator\Desktop
Expand-Archive .\oraculo-skins-live-agent.zip -DestinationPath .\oraculo-skins-live-agent -Force

Copy-Item -Force .\oraculo-skins-live-agent\oraculo-admin-agent\src\server.js .\oraculo-admin-agent\src\server.js
Copy-Item -Force .\oraculo-skins-live-agent\oraculo-admin-agent\src\skins.js .\oraculo-admin-agent\src\skins.js
Copy-Item -Force .\oraculo-skins-live-agent\oraculo-admin-agent\.env.example .\oraculo-admin-agent\.env.example

Stop-ScheduledTask -TaskName "OraculoAdminAgent"
Start-ScheduledTask -TaskName "OraculoAdminAgent"
```

## Variables en Vercel

Agrega:

```txt
ORACULO_COSMETICS_API_URL=https://admin-agent.oraculoprimitivo.xyz
ORACULO_COSMETICS_API_TOKEN=EL_MISMO_ADMIN_AGENT_TOKEN_DEL_OVH
```

Despues redeploy.

## Pruebas

En Codespace:

```bash
curl -s https://www.oraculoprimitivo.xyz/api/oraculo/cosmetics
curl -s "https://www.oraculoprimitivo.xyz/api/overlay.skineditor/current?steamId=76561198121262215&dino=Triceratops"
```

Guardar una skin:

```bash
curl -s -X POST "https://www.oraculoprimitivo.xyz/api/overlay.skineditor/save" \
  -H "content-type: application/json" \
  -d '{"steamId":"76561198121262215","dino":"Triceratops","pattern_index":2,"gender":1,"skin_variation":0.5,"colors":{"body":{"r":0.1,"g":0.4,"b":0.3,"a":1}}}'
```

## Aplicar dentro del juego

Para aplicar en vivo hace falta configurar el comando real que reconozca el server/mod:

```txt
ADMIN_AGENT_CMD_CHANGE_SKIN=
```

Variables disponibles para la plantilla:

```txt
{steamId} {playerId} {dino} {species} {skin} {skinCode} {pattern} {pattern_index} {gender} {skin_variation}
```

Si esa variable esta vacia, el sistema guarda skins y presets, pero responde `liveReady:false`.
