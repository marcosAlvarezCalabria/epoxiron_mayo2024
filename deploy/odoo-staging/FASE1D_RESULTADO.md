# Resultado Fase 1D — Facturación Odoo staging

Fecha: 2026-07-26  
Rama: `feature/facturacion-odoo`  
Entorno: Epoxiron staging en Hetzner + Odoo con VeriFactu en pruebas.

## Resultado integral

El ensayo agrupó dos albaranes revisados del mismo cliente ficticio y ejecutó dos peticiones
concurrentes con la misma selección.

| Comprobación | Resultado |
|---|---|
| Reserva local concurrente | Una sola `Invoice` |
| Respuestas concurrentes | `201` y `200` sobre la misma factura |
| Repetición posterior | `200`, devuelve la factura existente |
| Factura Odoo | `INV/2026/00004` |
| Estado contable | `POSTED` |
| VeriFactu | `ACCEPTED` en entorno de pruebas |
| Base imponible | `20.07` |
| IVA 21 % global | `4.21` |
| Total | `24.28` |
| QR | Presente |
| PDF autenticado | Válido, cabecera `%PDF` |
| Albaranes | Bloqueados como `INVOICED` |
| Duplicados locales | Ninguno |
| Duplicados remotos por referencia | Ninguno |

El caso monetario usa dos bases (`10.03` y `10.04`) cuya suma demuestra el redondeo global:
`round(20.07 × 0.21) = 4.21`.

## Contratos reales corregidos durante staging

- El contexto JSON-2 devuelve `uid`, pero no siempre `allowed_company_ids`; la empresa activa se
  obtiene leyendo `res.users.company_id`.
- La compañía tiene dos impuestos de venta al 21 %: bienes y servicios. Epoxiron usa el impuesto
  de bienes ID 5 mediante `ODOO_TAX_ID`, validado antes de emitir.
- El partner ficticio necesitó un CIF de prueba con dígito de control válido para alcanzar
  `VeriFactu=ACCEPTED`.

## Recuperación observada

- Una reserva fallida permaneció local y no generó factura remota.
- Los reintentos conservaron la misma clave idempotente.
- Una factura con fixture fiscal inválido llegó a `REJECTED` y no se modificó ni reutilizó.
- El caso corregido generó una factura nueva y aceptada sin duplicados.

## Hallazgo fuera del núcleo de facturación — RESUELTO

La creación simultánea de dos albaranes podía calcular el mismo número y provocar que una petición
fallase por la restricción única. El hallazgo quedó resuelto al cerrar la Fase 1 mediante
`DeliveryNoteNumberSequence`: PostgreSQL reserva e incrementa el contador anual dentro de la misma
transacción que crea el albarán. La migración inicializa cada contador desde la numeración existente.

## Seguridad

- No se desplegó ni modificó producción.
- `main` no se modificó.
- No se versionaron credenciales, PDFs ni respuestas fiscales completas.
- El PDF se verificó a través del proxy autenticado de Epoxiron.
