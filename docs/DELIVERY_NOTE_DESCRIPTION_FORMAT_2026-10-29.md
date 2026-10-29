# Formato uniforme de descripciones de albarán

Fecha: 2026-10-29.

## Cambio

Las descripciones de líneas usan el separador `·` entre pieza, color, acabado y
medidas. Por ejemplo:

`PERFIL · 1023 · MATE · 1460X200`

El cambio se aplica al formateador web y al formateador de documentos de la API.
No modifica cantidades, precios ni los datos persistidos del albarán.

## Verificación

- Suite web: 53/53 pruebas.
- Pruebas específicas de documentos/API: 7/7.
- TypeScript y builds de web y API correctos.
- El preview de Cloudflare coincidió byte a byte con el build local.
- El dominio público sirve `index-CnHY4pHk.js`, SHA-256
  `67930B4F7CBFF43D682C5F9FC2ACAB6B58762378D8A158B1FA756385F9FD1C14`.
- `https://api.wwwmarcos-alvarez.com/health` respondió correctamente.

## Producción y recuperación

- Commit de código: `54f79e0`.
- Cloudflare Pages: `26b7cdbe-70e7-4462-9241-c3991db63ccb`.
- Despliegue web anterior: `ede00ba6-8dc3-4ec5-99dc-76d774d5cc86`.
- Imagen API activa:
  `sha256:ab3f6835d72dd570c768520290a7866cdb25a2034ac7ecb3a3d0e022b8fc6cda`.
- Imagen API anterior conservada como
  `epoxiron-api:rollback-20261029-before-description-format`.
