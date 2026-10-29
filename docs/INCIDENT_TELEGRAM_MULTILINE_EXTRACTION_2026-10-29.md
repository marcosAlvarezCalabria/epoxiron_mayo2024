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

## Seguimiento: acabado separado del color RAL

Al reenviar otro audio real, la transcripción conservó cuatro líneas con
`ÁNGULO 7035`, `ÁNGULO 1021` y dos `PERFIL 1023`, todas con acabado `MATE`.
Los códigos eran colores RAL, no referencias de pieza. La primera interpretación
del seguimiento fue incorrecta y permitió que esos códigos permanecieran en la
descripción, por lo que el bot volvió a pedir el color.

La causa concreta estaba en la normalización: recuperaba un RAL dejado dentro de
la descripción solo cuando la palabra del acabado también seguía allí. El modelo
ya había separado `MATE` en el campo `texture`, así que no se recuperaban los
colores.

La normalización ahora acepta el acabado estructurado como evidencia y produce:

- `ÁNGULO`, `RAL 7035`, `MATE`, 3 unidades;
- `ÁNGULO`, `RAL 1021`, `MATE`, 8 unidades;
- `PERFIL 1460X200`, `RAL 1023`, `MATE`, 32 unidades;
- `PERFIL 460X200`, `RAL 1023`, `MATE`, 12 unidades.

Pasaron 58/58 pruebas relacionadas y 29/29 sobre la copia exacta de producción,
además de TypeScript y compilación. La propia imagen candidata devolvió esas
cuatro líneas exactas antes de activarse. Producción usa la imagen
`sha256:5de1413548b8e36866d92f8171629816ec0825ec8e5d986d938158f09419fe74`,
con cero reinicios y `GET /health` correcto. La imagen previa quedó como
`epoxiron-albaranes:rollback-20261029-before-ral-recovery`.
