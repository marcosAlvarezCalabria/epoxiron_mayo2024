# Contrato Odoo — Fase 0B

Estado: **spike completado en el entorno de pruebas de VeriFactu**.

## Instancia

| Dato | Evidencia observada |
|---|---|
| Instancia | `https://epoxiron.odoo.com` · `saas~19.4+e` |
| Usuario API | Autenticación correcta, usuario ID 2 |
| Localización española | IVA de ventas 21 % localizado (`account.tax` ID 5) |
| VeriFactu | Instalado y requerido en las facturas de prueba |
| Certificado | Cargado por el usuario con alcance exclusivo VeriFactu |
| Entorno | Opción **Entorno de prueba** comprobada por el usuario |

## Comparación de transportes

| Comprobación | JSON-2 | XML-RPC |
|---|---|---|
| Autenticación y lecturas | Correctas | Correctas |
| Crear `account.move` | Correcto, factura ID 1 | Correcto, factura ID 2 |
| Ejecutar `action_post` | `draft` → `posted` | `draft` → `posted` |
| Ejecutar `account.move.send.wizard` | Correcto | Correcto |
| Estado final VeriFactu | `accepted` | `accepted` |
| Documento VeriFactu | ID 1 | ID 2 |
| QR y PDF | Disponibles | Disponibles |

**Transporte elegido para Fase 1: JSON-2.** Es la API vigente de Odoo 19, cubrió todo el
flujo y evita construir una integración nueva sobre XML-RPC, que Odoo está sustituyendo.
XML-RPC queda validado únicamente como referencia de compatibilidad.

## Flujo remoto confirmado

1. Crear `account.move` con `move_type=out_invoice`, cliente, líneas e impuestos.
2. Ejecutar `account.move.action_post`.
3. Crear `account.move.send.wizard` para la factura.
4. Ejecutar `action_send_and_print`; esta acción genera PDF y procesa VeriFactu.
5. Consultar `l10n_es_edi_verifactu_state` hasta obtener un estado terminal.
6. Leer `invoice_pdf_report_file` y decodificar su contenido Base64.

`action_post` por sí sola no envía VeriFactu: durante el spike permanecieron vacíos el estado,
el documento y el QR hasta ejecutar el asistente de envío.

## Campos y estados observados

- `l10n_es_edi_verifactu_required=true`.
- Estado final: `l10n_es_edi_verifactu_state=accepted`.
- Documentos: `l10n_es_edi_verifactu_document_ids`.
- QR: `l10n_es_edi_verifactu_qr_code`.
- PDF: `invoice_pdf_report_file` después del envío.
- Los dos transportes expusieron 189 campos de cliente, 253 de factura y 19 relacionados
  con VeriFactu, QR o localización española.

## PDF

El endpoint web de informe no aceptó crear una sesión con la API key aunque respondió HTTP 200.
La estrategia confirmada es leer `invoice_pdf_report_file` mediante la API después de
`action_send_and_print`, validar la cabecera `%PDF` y guardar el binario decodificado.

## Idempotencia

- `x_epoxiron_idempotency_key` no existe.
- En Fase 1 se debe buscar primero una referencia técnica estable antes de crear.
- `ref` puede servir como clave provisional de reconciliación, pero no aporta una restricción
  única remota y no elimina por sí sola las condiciones de carrera.
- Odoo Online no admite un módulo personalizado para añadir la restricción; la idempotencia
  fuerte deberá residir en la API de Epoxiron y reconciliarse con Odoo.

## Seguridad operativa

- Las escrituras exigen simultáneamente `SPIKE_ALLOW_WRITES=true` y `--confirm-write`.
- La bandera local volvió a `false` al terminar.
- Credenciales, informes y PDF permanecen fuera de Git.
- Las facturas ID 1 y 2 pertenecen exclusivamente al entorno de pruebas.

## Pendiente para Fase 1

- Formalizar estados terminales, reintentos y reconciliación del documento VeriFactu.
- Definir la clave idempotente local y su índice único.
- Implementar con `Decimal` el redondeo global por impuesto observado en
  `res.company.tax_calculation_rounding_method=round_globally`.
- Añadir el adaptador JSON-2 dentro de la arquitectura de la API; no reutilizar el spike como
  código de producción.

## Evidencias

Los informes sanitizados y los PDF permanecen ignorados en `spike/output/`.

| Fecha | Evidencia | Resultado |
|---|---|---|
| 2026-07-25 | JSON-2 lectura | Correcto |
| 2026-07-25 | XML-RPC lectura | Correcto |
| 2026-07-25 | Factura JSON-2 ID 1 | `posted`, VeriFactu `accepted`, documento 1, QR y PDF |
| 2026-07-25 | Factura XML-RPC ID 2 | `posted`, VeriFactu `accepted`, documento 2, QR y PDF |
