# Acabado duplicado dentro del color del albarán

Fecha: 2026-11-11.

## Síntoma y causa

El albarán `ALB-2026-0451` mostraba líneas como:

`PIEZA ESCALERA · 7016 MATE · MATE · 36,96MLIN`

El dato persistido contenía el acabado en dos campos: `color = RAL 7016 MATE`
y `texture = MATE`. Los formateadores eliminaban acabados repetidos de la
descripción, pero no del color renderizado.

## Corrección

Los formateadores de web y API eliminan del color el acabado que ya está
representado por `texture`. La defensa cubre `MATE`, `TEXTURADO` y
`GOF`/`GOFRADO`, sin modificar precios ni datos persistidos.

Se añadieron regresiones con el caso real. El resultado de la API activa es:

`PIEZA ESCALERA · 7016 · MATE · 36,96MLIN`

## Verificación

- Web: 56/56 pruebas y TypeScript correctos.
- API: 147/147 pruebas y TypeScript correctos.
- Builds de web y API correctos.
- `https://wwwmarcos-alvarez.com` responde HTTP 200.
- El bundle público `index-C5Vd9gPo.js` coincide byte a byte con el build
  validado; SHA-256
  `76A6192AC65E3CA6EC86A3B0B96A07B9C99A3D8D550055C1BD85BD6B1AA6F6B3`.
- `https://api.wwwmarcos-alvarez.com/health` responde `{"status":"ok"}`.
- La comprobación dentro del contenedor activo devuelve el texto corregido.

## Producción y recuperación

- Commit de código: `02d4695`.
- Cloudflare Pages: `c25bda01-d434-49d7-a83e-ab510a9ef775`.
- Despliegue web anterior: `26f09de4-02df-45e0-b378-4a70b51c908f`.
- Imagen API activa:
  `sha256:553ea3b35d68c4c8fa7ed0a969b77dbbecca3d67770d7a637f6e67989c7dee66`.
- Imagen API anterior conservada como
  `epoxiron-api:rollback-20261111-before-color-texture-dedup`.

