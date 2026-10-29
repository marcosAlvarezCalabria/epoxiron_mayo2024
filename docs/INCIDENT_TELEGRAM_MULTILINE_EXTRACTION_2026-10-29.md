# Incidente Telegram: pérdida de datos en audios multilínea

Fecha de diagnóstico: 2026-10-29.

## Síntoma

Una transcripción con cuatro piezas, todas con color `7016` y acabado `MATE`,
terminó mostrando una línea parecida del catálogo (`PERFIL 1023 460X200`) sin
color.

## Causa comprobada

El contenedor de producción había sido creado el 2026-10-07 y todavía:

- enviaba hasta 200 nombres de piezas especiales al modelo aunque el usuario no
  pidiera una pieza especial;
- instruía al modelo para sustituir una descripción hablada por una pieza
  especial parecida;
- no comparaba el número de líneas, colores, acabados y cantidades explícitos de
  un audio multilínea con el resultado estructurado.

La transcripción de voz sí contenía las cuatro piezas y sus datos. El fallo se
produjo durante la extracción estructurada posterior.

## Corrección

- El catálogo especial solo se envía cuando existe intención explícita o se
  pronuncia el nombre exacto de una pieza del catálogo.
- Una coincidencia aproximada solo puede resolverse como especial cuando
  `specialPieceIntent` es verdadero.
- Los audios con varias cantidades explícitas se validan antes de modificar el
  borrador. Se comprueban número de líneas, cantidades, colores RAL y acabados.
- Si la extracción pierde o cambia datos explícitos, no se añade ninguna línea y
  se pide dividir el audio en mensajes más cortos.

## Verificación previa al despliegue

- Caso exacto del cliente: 4 líneas, `RAL 7016`, `MATE`, medidas y cantidades.
- Rechazo de una salida que cambia `7016` por `PERFIL 1023` sin color.
- Rechazo de una salida que elimina una de las cuatro líneas.
- Pieza normal parecida a una especial permanece normal.
- TypeScript `strict` y build de API correctos.
- Suite API: 204/205 en ejecución conjunta; el único timeout de OpenAPI pasó
  después aisladamente (3/3). Los tests específicos pasaron 40/40.

## Recuperación

Antes del cambio, la imagen activa era
`sha256:ff7969a9435ef5f71c3021219b1367dd745730fb56941f0567b6b74d2d74d925`.
Se conservará como referencia de rollback hasta verificar el flujo corregido en
producción.

## Despliegue de producción

- Rama remota: `codex/fix-telegram-multiline-validation`.
- Commit del hotfix: `6b8cd65`.
- Imagen activada: `sha256:ea6841c5963081dc62b425c5e5309fcf5d10c7c748a146294f9496df60719e07`.
- Inicio del contenedor: `2026-10-29T14:23:57Z`.
- Imagen anterior etiquetada como `epoxiron-albaranes:rollback-20261029`.
- El cambio se realizó tras comprobar que la última actualización de una sesión
  había ocurrido aproximadamente 48 minutos antes.
- Verificación posterior: contenedor `running`, cero reinicios, migraciones sin
  cambios pendientes y `GET /health` con `200 {"status":"ok"}`.
- El JavaScript compilado activo contiene la barrera `specialPieceIntent` y la
  nueva instrucción que prohíbe sustituir por semejanza.

No se envió un audio sintético al chat real porque habría modificado el borrador
del usuario. El texto exacto de la incidencia se cubrió con pruebas aisladas.

## Seguimiento: referencias de pieza confundidas con colores

Al reenviar otro audio real, la transcripción conservó cuatro líneas con
`ÁNGULO 7035`, `ÁNGULO 1021` y dos `PERFIL 1023`, todas con acabado `MATE`,
pero la nueva barrera rechazó el resultado. La causa fue que consideraba
cualquier código RAL conocido seguido de un acabado como color, aunque en este
caso los números eran referencias de pieza.

La validación ahora distingue los dos casos:

- `RAL 7035` debe conservarse específicamente como color;
- `7035 mate` debe conservar el código en la descripción o en el color, sin
  decidir de antemano cuál de los dos significa.

El caso exacto quedó cubierto por una prueba de cuatro líneas. La rama pasó
41/41 pruebas del flujo, y la copia exacta de producción pasó TypeScript,
compilación y 12/12 pruebas del caso de uso. Se activó la imagen
`sha256:3471f8eddd9321c905fd5059b4e7d572329cd920de6cc8489a6e1e179c6ef6c0`
con cero reinicios y `GET /health` correcto. La imagen anterior quedó como
`epoxiron-albaranes:rollback-20261029-before-reference-fix`.
