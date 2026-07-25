# Contrato Odoo — Fase 0B

Estado: **lecturas completadas; pendiente factura de prueba, VeriFactu, PDF y redondeo**.

No se cerrará este documento con supuestos. Los resultados deben proceder de
los informes sanitizados del spike JSON-2 y XML-RPC.

## Instancia

| Dato | Evidencia observada |
|---|---|
| URL y versión exacta | `https://epoxiron.odoo.com` · `saas~19.4+e` |
| Localización española | IVA de ventas 21 % localizado (`account.tax` ID 5) |
| `l10n_es_edi_verifactu` | Instalado; 19 campos relacionados detectados en `account.move` |
| Certificado cargado | Pendiente |
| Entorno de pruebas activo | Pendiente |

## Comparación de transportes

| Comprobación | JSON-2 | XML-RPC |
|---|---|---|
| Autenticación | Correcta, usuario ID 2 | Correcta, usuario ID 2 |
| Lectura `res.partner` | Correcta, 189 campos | Correcta, 189 campos |
| Crear `account.move` | Pendiente | Pendiente |
| Ejecutar `action_post` | Pendiente | Pendiente |
| Consultar VeriFactu | Pendiente | Pendiente |
| Descargar PDF | Pendiente | Pendiente |

**Transporte elegido y motivo:** pendiente de completar las escrituras. Ambos transportes ofrecen las
mismas capacidades de lectura; JSON-2 sigue siendo el candidato preferido por ser la API vigente de
Odoo 19 y sustituir a XML-RPC.

## Campos y estados reales

- Campos fiscales de `res.partner`: disponibles; confirmar valores con un cliente de prueba.
- Campos relevantes de `account.move`: 253 campos legibles por ambos transportes.
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

- Existe `x_epoxiron_idempotency_key`: **no**.
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
| 2026-07-25 | JSON-2 lectura | `926D4521AA1EA7F055E3712F390FFE32C59E23AF754F02D7007DEBE7445BD798` | Correcto |
| 2026-07-25 | XML-RPC lectura | `05C7D5378B1DB467A9F0B04D83AEF4A74632F54ADC84C4451D05B13D6D130BC8` | Correcto |
