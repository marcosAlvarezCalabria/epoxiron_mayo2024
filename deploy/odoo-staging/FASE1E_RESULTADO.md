# Resultado Fase 1E — Factura autosuficiente

Fecha: 2026-07-26.

Entorno: Epoxiron staging en Hetzner + Odoo con VeriFactu en pruebas.

## Resultado

- Commit desplegado: `a1da711`.
- Factura local: `8a01e8c4-dbf1-4527-a2a9-59e08945ea96`.
- Factura Odoo: `INV/2026/00005` (`account.move` 5).
- Estado local: `LINKED`.
- Estado Odoo: `POSTED`.
- Estado VeriFactu: `ACCEPTED`.
- PDF: válido, 98 165 bytes, una página.
- Importes autoritativos Odoo: base 20,07 €, IVA 4,21 €, total 24,28 €.
- Idempotencia concurrente: una petición `201`, repetición concurrente `200` y una sola factura.
- Albaranes origen: bloqueados como `INVOICED`.

## Líneas comprobadas

Odoo y el PDF muestran una línea independiente por producto, con el albarán de origen y el detalle
comercial guardado:

```text
ALB-2026-0034 · FASE 1D 20260726111534 LÍNEA B · 9005
ALB-2026-0033 · FASE 1D 20260726111534 LÍNEA A · 9005
```

Cada línea conserva cantidad, precio unitario, IVA e importe. La inspección renderizada confirmó que
las dos líneas, los totales y el QR VeriFactu son legibles y no están recortados ni solapados.

## Validación automatizada

- Compilación TypeScript API: correcta.
- Pruebas específicas de saga y adaptador Odoo: 18/18 correctas.
- El test de saga cubre dos productos con el mismo nombre sin consolidación y verifica color, textura,
  metros, grosor e imprimación en la descripción inmutable.
- El test del adaptador verifica el `invoice_line_ids` completo enviado a Odoo.

El fallo de voz detectado durante esta validación quedó resuelto en el cierre de Fase 1: las
dimensiones habladas no inventan M² y la detección de RAL prioriza el color indicado explícitamente.
La batería final quedó en API `114/114` y web `21/21`.

Producción y `main` no se han modificado.
