# Contrato Odoo — Fase 0B

Estado: **pendiente de completar con evidencia de staging**.

No se cerrará este documento con supuestos. Los resultados deben proceder de
los informes sanitizados del spike JSON-2 y XML-RPC.

## Instancia

| Dato | Evidencia observada |
|---|---|
| URL y versión exacta | Pendiente |
| Localización española | Pendiente |
| `l10n_es_edi_verifactu` | Pendiente |
| Certificado cargado | Pendiente |
| Entorno de pruebas activo | Pendiente |

## Comparación de transportes

| Comprobación | JSON-2 | XML-RPC |
|---|---|---|
| Autenticación | Pendiente | Pendiente |
| Lectura `res.partner` | Pendiente | Pendiente |
| Crear `account.move` | Pendiente | Pendiente |
| Ejecutar `action_post` | Pendiente | Pendiente |
| Consultar VeriFactu | Pendiente | Pendiente |
| Descargar PDF | Pendiente | Pendiente |

**Transporte elegido y motivo:** pendiente.

## Campos y estados reales

- Campos fiscales de `res.partner`: pendiente.
- Campos relevantes de `account.move`: pendiente.
- Estado contable antes/después de `action_post`: pendiente.
- Campos, valores y transiciones VeriFactu: pendiente.
- Momento de disponibilidad del QR y significado: pendiente.

## PDF

- Ruta o método server-side: pendiente.
- Autenticación necesaria: pendiente.
- Momento en que incorpora QR: pendiente.

## Redondeo

| Ajuste | Valor observado |
|---|---|
| Por línea o global | Pendiente |
| Decimales de moneda | Pendiente |
| Decimales de precio unitario | Pendiente |
| Base, cuota y total de prueba | Pendiente |

## Idempotencia

- Existe `x_epoxiron_idempotency_key`: pendiente.
- Tipo, índice y unicidad: pendiente.
- Búsqueda fiable por API: pendiente.
- Viabilidad de módulo mínimo si no existe: pendiente.
- Limitaciones de usar `ref` provisionalmente: pendiente.

## Decisión final para Fase 1

- Transporte: pendiente.
- Campos del adaptador: pendiente.
- Estrategia de PDF: pendiente.
- Reconciliación VeriFactu: pendiente.
- Idempotencia remota: pendiente.
- Configuración monetaria: pendiente.

## Evidencias

Los informes y PDF permanecen fuera de Git en `spike/output/`.

| Fecha | Transporte | SHA-256 del informe | Resultado |
|---|---|---|---|
| Pendiente | Pendiente | Pendiente | Pendiente |

