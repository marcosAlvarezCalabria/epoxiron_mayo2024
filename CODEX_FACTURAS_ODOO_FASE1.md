# CODEX — Facturación Odoo Fase 1

> Plan ejecutable de implementación para Epoxiron.
> **Fecha:** 2026-07-26
> **Estado:** Fases 1A–1E completadas y validadas en staging; pendiente de revisión humana.
> **Rama obligatoria:** `feature/facturacion-odoo`.
> **Fuentes de verdad:** `SPEC_FACTURACION_ODOO.md` v2.6 y
> `deploy/odoo-staging/FASE0B_CONTRATO_ODOO.md`.

---

## 0. Objetivo y límites

Implementar en Epoxiron el MVP de facturación de ventas con Odoo:

- completar y sincronizar los datos fiscales de clientes;
- crear una factura agrupada desde 1..N albaranes del mismo cliente;
- reservar los albaranes de forma transaccional e idempotente;
- crear, contabilizar y enviar la factura mediante Odoo JSON-2;
- reconciliar el estado VeriFactu hasta `accepted` o `rejected`;
- conservar una instantánea legal e histórica de cliente, líneas e importes;
- mostrar en la factura todas las líneas de producto de los albaranes para que el cliente no necesite
  recibir los albaranes;
- mostrar estados en la web y servir el PDF mediante la API autenticada.

Quedan fuera de esta fase:

- rectificativas, abonos y cancelación de facturas emitidas;
- gestión y conciliación de cobros;
- migración de proveedores, plan contable y saldos desde Sage 50;
- presentación de modelos fiscales y handoff definitivo a la gestoría;
- activación de VeriFactu en producción;
- elección de serie y último número reales.

No modificar `main`, producción, Cloudflare ni el VPS durante la implementación. No desactivar el
entorno de pruebas de VeriFactu.

---

## 1. Reglas no negociables

1. Arquitectura limpia: Domain → Application → Infrastructure → HTTP/UI.
2. El dominio no importa Prisma, Express, `fetch`, Odoo ni variables de entorno.
3. Todas las escrituras externas requieren confirmación explícita del usuario en la UI.
4. La confirmación debe describir que se crearán y enviarán facturas a Odoo de pruebas.
5. No almacenar ni registrar API keys, tokens, certificados, cookies ni cuerpos completos de error.
6. No usar `number`/`Float` para cálculos nuevos de factura. Usar `Prisma.Decimal` en persistencia y
   una librería decimal explícita en dominio/aplicación.
7. Los importes devueltos por Odoo son autoritativos después de crear la factura remota.
8. Una factura emitida no se borra ni se vuelve a borrador. Cualquier corrección futura requerirá
   rectificativa, fuera de este MVP.
9. Los albaranes facturados no pueden editarse, eliminarse ni volver a facturarse.
10. No enviar correo desde `account.move.send.wizard`; habilitar solo el procesamiento fiscal/PDF.
11. No exponer una URL o sesión de Odoo al navegador.
12. Todo endpoint nuevo bajo `/api/*` permanece detrás de `authMiddleware`.
13. Cada fase debe compilar y tener tests antes de continuar.
14. No dejar placeholders, `TODO`, código muerto ni rutas parcialmente conectadas.
15. Cada producto de cada albarán genera una línea visible, ordenada e inmutable en la factura; no se
    agregan líneas ni se exige adjuntar los albaranes al cliente.
16. Un rechazo fiscal definitivo anterior a la creación remota queda `FAILED`, conserva una causa
    accionable y no entra en reconciliación; timeouts y errores de red siguen siendo recuperables.
17. La numeración anual de albaranes se reserva atómicamente en PostgreSQL.

---

## 2. Decisiones confirmadas

| Tema | Contrato |
|---|---|
| Transporte | JSON-2: `POST /json/2/<model>/<method>` |
| Autenticación | Bearer API key + `X-Odoo-Database` |
| Agrupación | 1..N albaranes del mismo cliente → 1 factura |
| Detalle comercial | 1 `DeliveryNoteItem` → 1 línea visible de factura, con albarán de origen |
| Tarifas | Base imponible, sin IVA incluido |
| IVA MVP | Únicamente 21 % |
| Redondeo | Global por impuesto: `round_globally` |
| Precisión | Precio unitario 4 decimales; importes monetarios 2 |
| Completada | VeriFactu `accepted` |
| PDF | `invoice_pdf_report_file` Base64 después del envío |
| Idempotencia | Fuerte en PostgreSQL; `account.move.ref` para reconciliación |
| API externa elegida | JSON-2; no implementar XML-RPC en producción |

Flujo Odoo validado:

```text
res.partner ensure/sync
  → account.move.create(vals_list)
  → account.move.action_post
  → account.move.send.wizard.create(vals_list)
  → account.move.send.wizard.action_send_and_print
  → poll account.move
  → l10n_es_edi_verifactu_state = accepted | rejected
  → invoice_pdf_report_file
```

---

## 3. Entrega incremental obligatoria

Las cinco entregas están completadas y permanecen aisladas en `feature/facturacion-odoo`.

### Fase 1A — Datos fiscales y migración compatible

Objetivo: permitir completar la ficha fiscal sin romper clientes existentes.

### Fase 1B — Dominio, persistencia y adaptador Odoo

Objetivo: implementar la saga idempotente y la reconciliación con tests, todavía sin UI final.

### Fase 1C — API y experiencia web

Objetivo: selección, confirmación explícita, estados, errores y descarga del PDF.

### Fase 1D — Validación integral en staging

Objetivo: probar fallos, concurrencia, redondeo y VeriFactu antes de plantear producción.

### Fase 1E — Factura autosuficiente para el cliente

Objetivo: incluir en la factura y su PDF todas las líneas de producto de los albaranes, con información
comercial suficiente para que no sea necesario enviar los albaranes al cliente.

**Estado:** completada y validada con `INV/2026/00005`, VeriFactu `ACCEPTED` y PDF inspeccionado.

Commits semánticos recomendados:

```text
feat: añade datos fiscales de clientes
feat: implementa dominio y persistencia de facturas
feat: integra facturacion con Odoo JSON-2
feat: expone API y reconciliacion de facturas
feat: añade flujo web de facturacion
test: valida saga y facturacion Odoo en staging
feat: detalla productos de albaranes en facturas Odoo
```

---

## 4. Fase 1A — Datos fiscales

### 4.1 Prisma

Ampliar `Customer` con columnas opcionales:

```prisma
vat               String?
legalName         String?
fiscalStreet      String?
fiscalStreet2     String?
fiscalCity        String?
fiscalZip         String?
fiscalProvince    String?
fiscalCountryCode String?  @default("ES")
paymentTermCode   String?
externalPartnerId String?
```

Reglas:

- la migración no añade campos obligatorios;
- `vat` no es `@unique`;
- `externalPartnerId` sí puede tener índice único parcial lógico en aplicación, pero la migración
  inicial debe comprobar duplicados antes de imponer unicidad;
- no reutilizar `address` como domicilio fiscal;
- no persistir un booleano `fiscalDataComplete`; calcularlo en dominio.

Crear una migración Prisma con nombre semántico. Revisar manualmente el SQL antes de aplicarlo.

### 4.2 Dominio y aplicación

Actualizar:

- `api/src/domain/entities/Customer.ts`;
- `api/src/domain/repositories/CustomerRepository.ts`;
- `api/src/application/use-cases/customers.ts`;
- `api/src/infrastructure/repositories/PrismaCustomerRepository.ts`.

Crear una función pura:

```ts
type FiscalDataIssue =
  | "MISSING_LEGAL_NAME"
  | "MISSING_VAT"
  | "MISSING_STREET"
  | "MISSING_CITY"
  | "MISSING_ZIP"
  | "MISSING_COUNTRY";

validateFiscalCustomer(customer: Customer): FiscalDataIssue[];
```

No validar el formato del NIF con una expresión excesivamente restrictiva. Normalizar espacios y
mayúsculas; la aceptación fiscal definitiva también la valida Odoo.

### 4.3 API y web

Actualizar esquemas Zod, OpenAPI, tipos web y `CustomerFormStepper`.

La ficha mostrará:

- razón social;
- NIF/CIF;
- calle y segunda línea;
- código postal;
- ciudad;
- provincia;
- país, inicialmente `ES`;
- condición de pago;
- indicador calculado “Ficha fiscal completa/incompleta”.

Los campos siguen siendo opcionales al crear o editar un cliente. La obligatoriedad se aplica al
facturar, no durante la migración.

### 4.4 Tests y aceptación 1A

Tests mínimos:

- cliente histórico sin datos fiscales sigue siendo legible/editable;
- normalización de NIF y país;
- cálculo de todos los motivos de ficha incompleta;
- serialización Prisma ↔ dominio;
- validación Zod de datos fiscales;
- formulario web conserva y envía los campos.

Criterio de aceptación:

- migración reversible probada en base local/staging;
- clientes existentes no se pierden;
- API y web compilan;
- ficha fiscal puede completarse desde la web;
- no se ha realizado ninguna escritura en Odoo.

---

## 5. Fase 1B — Modelo de factura

### 5.1 Dependencia decimal

Elegir una única librería decimal compatible con Node/TypeScript y usarla solo detrás de utilidades
de dominio. No usar operaciones aritméticas JS sobre importes de factura.

Definir:

```ts
type Money = string; // representación decimal canónica en contratos HTTP/dominio

interface InvoiceAmounts {
  subtotal: Money;
  taxAmount: Money;
  total: Money;
}
```

La API serializa importes como strings (`"121.00"`), evitando pérdida de precisión en JSON.

### 5.2 Prisma

Añadir enums:

```prisma
enum InvoiceLocalState {
  CREATING
  CREATED_REMOTE
  LINKED
  RECONCILING
  FAILED
}

enum OdooMoveState {
  DRAFT
  POSTED
  CANCEL
}

enum VerifactuState {
  NOT_SENT
  PENDING
  ACCEPTED
  REJECTED
}
```

Añadir modelos equivalentes a:

```prisma
model Invoice {
  id                    String            @id @default(uuid())
  idempotencyKey        String            @unique
  remoteReference       String            @unique
  series                String?
  number                String?
  customerId            String
  customer              Customer          @relation(fields: [customerId], references: [id])

  customerLegalName     String
  customerVat           String
  customerFiscalStreet  String
  customerFiscalStreet2 String?
  customerFiscalCity    String
  customerFiscalZip     String
  customerProvince      String?
  customerCountryCode   String
  paymentTermCode       String?

  subtotal              Decimal           @db.Decimal(12, 2)
  taxRate               Decimal           @db.Decimal(5, 2)
  taxAmount             Decimal           @db.Decimal(12, 2)
  total                 Decimal           @db.Decimal(12, 2)

  localState            InvoiceLocalState @default(CREATING)
  odooMoveState         OdooMoveState?
  verifactuState        VerifactuState    @default(NOT_SENT)
  externalInvoiceId     String?
  verifactuDocumentId   String?
  verifactuQrValue      String?
  pdfAvailable          Boolean           @default(false)
  lastErrorCode         String?
  lastErrorMessage      String?
  reconciliationAttempts Int              @default(0)
  nextReconciliationAt  DateTime?

  lines                 InvoiceLine[]
  deliveryNotes         InvoiceDeliveryNote[]
  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt

  @@index([localState, nextReconciliationAt])
  @@index([verifactuState, nextReconciliationAt])
}

model InvoiceLine {
  id          String  @id @default(uuid())
  invoiceId   String
  invoice     Invoice @relation(fields: [invoiceId], references: [id], onDelete: Restrict)
  description String
  quantity    Decimal @db.Decimal(12, 4)
  unitPrice   Decimal @db.Decimal(12, 4)
  subtotal    Decimal @db.Decimal(12, 2)
  taxRate     Decimal @db.Decimal(5, 2)
  position    Int

  @@unique([invoiceId, position])
}

model InvoiceDeliveryNote {
  invoiceId      String
  deliveryNoteId String @unique
  invoice        Invoice      @relation(fields: [invoiceId], references: [id], onDelete: Restrict)
  deliveryNote   DeliveryNote @relation(fields: [deliveryNoteId], references: [id], onDelete: Restrict)

  @@id([invoiceId, deliveryNoteId])
}
```

Actualizar relaciones de `Customer` y `DeliveryNote`. Añadir `INVOICED` a `DeliveryNoteStatus`.

No migrar todavía los precios operativos existentes de `Float`; las líneas de factura son una
instantánea nueva en `Decimal`. La conversión desde albarán debe partir de los valores canónicos con
dos decimales ya persistidos y convertirlos mediante string, nunca mediante aritmética binaria nueva.

### 5.3 Instantánea legal

La factura debe conservar:

- datos fiscales del cliente en el momento de emisión;
- descripción, cantidad, precio y total de cada línea;
- albaranes origen y su orden;
- base, IVA y total;
- referencia remota y estados.

Nunca reconstruir una factura histórica leyendo los valores actuales de `Customer`,
`DeliveryNote` o `DeliveryNoteItem`.

Cada `DeliveryNoteItem` genera exactamente una `InvoiceLine`, sin consolidar productos repetidos. La
posición se determina por el orden estable de los albaranes y el orden original de sus productos.
La descripción comercial guardada debe identificar el albarán de origen y contener, cuando existan,
producto, color/RAL, textura distinta de `NORMAL`, modalidad de precio, dimensiones o metros,
espesor e imprimación. No debe contener notas internas ni identificadores técnicos.

La misma descripción inmutable se usa para la API, el payload de Odoo y el PDF. Si no puede generarse
una descripción comercial completa, devolver `422` antes de cualquier escritura remota.

Con `round_globally` no persistir una cuota fiscal redondeada por línea: podría no sumar la cuota
global de la factura. La cuota y el total autoritativos se guardan en `Invoice`; cada `InvoiceLine`
conserva base y tipo de IVA.

### 5.4 Elegibilidad de albaranes

Para iniciar una factura:

- recibir entre 1 y un máximo documentado de 100 IDs;
- no aceptar IDs duplicados;
- todos existen;
- todos pertenecen al mismo cliente;
- todos están `REVIEWED`;
- ninguno está reservado o facturado;
- todos contienen al menos una línea y total no negativo;
- la ficha fiscal está completa;
- la selección se ordena de forma determinista.

Si falla una condición, no crear nada y devolver un error de dominio estable.

### 5.5 Idempotencia y reserva

Clave:

```text
idempotencyKey = SHA-256("invoice:v1:" + deliveryNoteIdsOrdenados.join(","))
remoteReference = "EPOX-" + primeros 32 caracteres hex de idempotencyKey
```

En una única transacción Prisma:

1. releer y bloquear lógicamente los albaranes;
2. comprobar elegibilidad;
3. insertar `Invoice(CREATING)`;
4. insertar `InvoiceDeliveryNote`;
5. guardar instantánea fiscal y líneas.

El `deliveryNoteId @unique` y `idempotencyKey @unique` resuelven doble clic y concurrencia. Ante
conflicto, devolver la factura existente si corresponde a la misma clave; no crear otra.

No mantener una transacción PostgreSQL abierta mientras se llama a Odoo.

---

## 6. Puerto de dominio y adaptador JSON-2

### 6.1 Puerto

Crear `api/src/domain/ports/InvoiceGateway.ts`:

```ts
interface InvoiceGateway {
  ensureCustomer(input: FiscalCustomerSnapshot): Promise<ExternalPartnerRef>;
  findInvoiceByReference(reference: string): Promise<RemoteInvoice | null>;
  createDraftInvoice(input: RemoteInvoiceDraft): Promise<RemoteInvoice>;
  postInvoice(externalInvoiceId: string): Promise<RemoteInvoice>;
  sendInvoice(externalInvoiceId: string): Promise<void>;
  getInvoice(externalInvoiceId: string): Promise<RemoteInvoiceStatus>;
  fetchInvoicePdf(externalInvoiceId: string): Promise<Buffer>;
}
```

Los tipos del puerto usan nombres neutrales y strings decimales. No exponer nombres
`l10n_es_*` fuera del adaptador.

### 6.2 Configuración

Añadir y validar en `api/src/config/env.ts`:

```text
ODOO_INVOICING_ENABLED=false
ODOO_URL=
ODOO_DB=
ODOO_USER=
ODOO_API_KEY=
ODOO_TIMEOUT_MS=15000
ODOO_TAX_RATE=21
ODOO_RECONCILIATION_ENABLED=false
ODOO_RECONCILIATION_INTERVAL_MS=30000
ODOO_RECONCILIATION_MAX_ATTEMPTS=20
```

Reglas:

- si `ODOO_INVOICING_ENABLED=true`, URL, DB, usuario y API key son obligatorios;
- si reconciliación está activa, facturación también debe estar activa;
- nunca exportar `ODOO_API_KEY` a la web;
- `.env.example` contiene nombres y valores no secretos;
- `.env` continúa ignorado.

### 6.3 Cliente HTTP

Crear `api/src/infrastructure/services/OdooJson2InvoiceGateway.ts`.

Responsabilidades:

- `fetch` con `AbortController` y timeout;
- cabeceras Bearer, JSON y base de datos;
- parseo estricto de respuestas;
- errores tipados y sanitizados;
- nunca reintentar automáticamente una creación sin reconciliar primero;
- no registrar cuerpos que puedan contener datos fiscales completos;
- validar que los IDs remotos y campos esperados tienen el tipo correcto.

Contrato de creación JSON-2:

```json
{
  "vals_list": [
    {
      "move_type": "out_invoice",
      "partner_id": 123,
      "ref": "EPOX-...",
      "invoice_line_ids": []
    }
  ]
}
```

### 6.4 Sincronización del cliente

Algoritmo:

1. Si `externalPartnerId` existe, leer ese `res.partner`.
2. Si no existe o ya no es válido, buscar candidatos por NIF normalizado.
3. No adoptar automáticamente si hay más de un candidato.
4. Crear un partner si no existe.
5. Actualizar solo campos fiscales gestionados por Epoxiron.
6. Persistir el ID externo en el cliente local.

Mapeo mínimo:

```text
name, vat, street, street2, city, zip, state_id, country_id,
is_company=true, customer_rank=1, property_payment_term_id
```

Resolver país, provincia, condición de pago e IVA por búsqueda API, no mediante IDs hardcodeados.
Cachear catálogos estables en memoria con invalidación acotada.

### 6.5 Factura y VeriFactu

- mapear cada `InvoiceLine` a un comando independiente de `invoice_line_ids`, en el mismo orden;
- usar en `account.move.line.name` la descripción comercial guardada, sin reagrupar ni resumir;
- crear líneas con base imponible e impuesto de ventas 21 %;
- resolver el impuesto por empresa, uso `sale`, porcentaje 21 y activo;
- después de `action_post`, ejecutar el asistente de envío con correo desactivado;
- mapear el estado remoto:

```text
false/sin documento → NOT_SENT o PENDING según el paso local
pending/processing  → PENDING
accepted            → ACCEPTED
rejected/error      → REJECTED
desconocido         → PENDING + error de observabilidad; nunca asumir ACCEPTED
```

- guardar motivo de rechazo sanitizado;
- obtener QR y documento cuando aparezcan;
- descargar `invoice_pdf_report_file`, decodificar Base64, limitar tamaño y validar `%PDF`.

---

## 7. Casos de uso y saga

Crear:

```text
api/src/application/use-cases/invoices/
  createInvoiceFromDeliveryNotes.ts
  getInvoice.ts
  listInvoices.ts
  reconcileInvoice.ts
  getInvoicePdf.ts
```

Crear repositorio de dominio y dos implementaciones:

```text
api/src/domain/repositories/InvoiceRepository.ts
api/src/infrastructure/repositories/PrismaInvoiceRepository.ts
api/src/infrastructure/repositories/InMemoryInvoiceRepository.ts
```

### 7.1 Creación

`CreateInvoiceFromDeliveryNotesUseCase`:

1. validar la petición;
2. reservar y crear snapshot local;
3. asegurar/sincronizar cliente;
4. buscar por `remoteReference`;
5. adoptar la factura si ya existe;
6. si no existe, crear borrador;
7. guardar inmediatamente `externalInvoiceId` y `CREATED_REMOTE`;
8. contabilizar;
9. ejecutar envío;
10. consultar estado;
11. cerrar transacción local: enlazar, marcar albaranes `INVOICED`, guardar importes Odoo;
12. si no está aceptada, programar reconciliación.

Una caída después de cada paso debe ser recuperable. Registrar solamente:

- invoice local ID;
- referencia técnica;
- paso;
- código de error;
- duración.

### 7.2 Reconciliación

`ReconcileInvoiceUseCase`:

- adquirir un lease/lock lógico por factura para impedir dos reconciliadores;
- devolver sin cambios un `FAILED` fiscal definitivo que no tenga factura remota;
- si falta `externalInvoiceId`, buscar por referencia;
- adoptar el remoto encontrado;
- nunca crear otra factura desde el reconciliador;
- no sobrescribir el código ni mensaje original mientras la búsqueda remota no encuentre factura;
- consultar move, documento, estado, QR e importes;
- descargar/comprobar PDF solo cuando esté disponible;
- actualizar `nextReconciliationAt` con backoff acotado;
- terminar en `ACCEPTED`, `REJECTED` o `FAILED` recuperable;
- no ocultar rechazos ni agotar reintentos silenciosamente.

Crear `InvoiceReconciliationScheduler` siguiendo el patrón de
`DailyDeliveryNotesReportScheduler`, con cierre limpio desde `server.ts`.

### 7.3 Fallos después de emisión

Si Odoo ya creó o contabilizó una factura pero falla la persistencia local:

- no devolver un mensaje que invite a repetir sin control;
- mantener o recuperar la Invoice local por su clave;
- buscar por referencia antes de cualquier nueva creación;
- mostrar estado `RECONCILING`;
- permitir reconciliación manual.

---

## 8. API HTTP

Crear esquemas, controlador y router:

```text
api/src/schemas/invoiceSchemas.ts
api/src/controllers/InvoicesController.ts
api/src/routes/invoices.routes.ts
```

Rutas:

| Método | Ruta | Comportamiento |
|---|---|---|
| POST | `/api/invoices` | Crea desde `deliveryNoteIds`; exige `confirmed=true` |
| GET | `/api/invoices` | Lista paginada y filtrable |
| GET | `/api/invoices/:id` | Detalle con snapshot y estados |
| POST | `/api/invoices/:id/reconcile` | Reconciliación manual explícita |
| GET | `/api/invoices/:id/pdf` | PDF autenticado, inline o attachment |

Petición de creación:

```json
{
  "deliveryNoteIds": ["uuid-1", "uuid-2"],
  "confirmed": true
}
```

No aceptar importes, IVA, cliente ni líneas enviados por la web. La API los obtiene de los
albaranes reservados y aplica las reglas de dominio.

Respuestas:

- `201` si se inicia una factura nueva;
- `200` si una repetición idempotente devuelve la existente;
- `409` si un albarán está reservado/facturado por otra factura;
- `422` para ficha fiscal o albaranes no elegibles;
- `503` si facturación Odoo está desactivada;
- errores externos sanitizados, sin stack ni cuerpo Odoo.

El PDF:

- requiere factura propia existente y `pdfAvailable=true`;
- contiene todas las líneas visibles con albarán de origen, descripción, cantidad, precio unitario,
  IVA y subtotal, de modo que sustituya el envío de los albaranes al cliente;
- conserva todas las líneas y encabezados comprensibles cuando la tabla ocupa varias páginas;
- cabeceras `Content-Type: application/pdf`, `Content-Disposition` seguro y `Cache-Control: private`;
- tamaño máximo configurable;
- no persiste el PDF en PostgreSQL;
- puede recuperarlo de Odoo bajo demanda; cache R2 queda fuera del MVP.

Actualizar OpenAPI y registrar el router después de `authMiddleware`.

---

## 9. Web

Crear:

```text
web/src/features/invoices/
  invoiceApi.ts
  invoiceTypes.ts
  invoiceStatus.ts
web/src/pages/InvoicesPage.tsx
```

Actualizar:

- navegación y rutas de `App.tsx`;
- `DeliveryNotesPage.tsx`;
- tipos de dominio;
- formulario de clientes;
- estilos reutilizando el sistema visual existente.

### 9.1 Selección

- solo permitir seleccionar albaranes `REVIEWED`;
- impedir mezclar clientes;
- mostrar base total, IVA 21 % estimado y total;
- mostrar los albaranes incluidos;
- si falta información fiscal, enlazar a editar el cliente;
- desactivar la acción durante el envío.

### 9.2 Confirmación explícita

Antes del POST mostrar un diálogo:

```text
Se creará y contabilizará una factura en Odoo y se enviará a VeriFactu.
Incluye N albaranes del cliente X.
Base: … · IVA 21 %: … · Total: …
Esta operación no puede deshacerse desde Epoxiron.
```

Botones inequívocos:

- `Cancelar`;
- `Crear y enviar factura`.

No crear por voz, al cambiar estado ni al cerrar un albarán.

### 9.3 Estados

Mostrar por separado:

- proceso local;
- estado contable Odoo;
- estado VeriFactu;
- número legal;
- PDF disponible;
- error recuperable.

`Factura completada` solo cuando `verifactuState=ACCEPTED`.

Actualizar albaranes `INVOICED`:

- badge específico;
- sin edición ni eliminación;
- enlace a la factura;
- excluidos de nuevas selecciones.

### 9.4 React Query

- mutaciones invalidan facturas, albaranes y dashboard;
- sondeo solo para facturas no terminales;
- detener sondeo en `ACCEPTED`, `REJECTED` o fallo final;
- no reintentar automáticamente el POST de creación desde el cliente;
- descarga de PDF mediante petición autenticada y `Blob`.

---

## 10. Estrategia de pruebas

Cobertura mínima del código nuevo: 80 %. Priorizar ramas críticas, no solo líneas.

### 10.1 Dominio

- validación fiscal;
- agrupación del mismo cliente;
- elegibilidad por estado;
- clave idempotente determinista;
- snapshot inmutable;
- una línea de factura por cada producto de cada albarán, sin consolidación y en orden estable;
- descripción comercial completa y ausencia de notas internas;
- redondeo global 21 % con casos que difieren del redondeo por línea;
- serialización decimal;
- mapeo de estados.

Casos monetarios obligatorios:

```text
líneas con 3 y 4 decimales;
cantidades mayores que 1;
varias líneas cuya cuota individual tiene medio céntimo;
base 0;
importe mínimo;
total grande dentro de Decimal(12,2).
```

Comparar los resultados esperados con Odoo `round_globally`.

### 10.2 Aplicación

Con `InMemoryInvoiceRepository` y gateway falso:

- camino feliz inmediato;
- aceptación diferida;
- rechazo VeriFactu;
- doble clic;
- dos peticiones concurrentes;
- timeout antes y después de crear remoto;
- caída después de `action_post`;
- adopción por referencia;
- no duplicación;
- reconciliación manual y automática;
- máximo de intentos;
- cliente fiscal incompleto;
- albaranes de distintos clientes;
- albarán ya facturado.

### 10.3 Infraestructura

- requests JSON-2 exactas mediante `fetch` simulado;
- un comando `invoice_line_ids` por producto, con orden y `name` exactos;
- `vals_list` obligatorio;
- cabeceras y timeout;
- sanitización de errores;
- catálogo país/provincia/impuesto/condición de pago;
- asistente de envío sin email;
- Base64 y validación PDF;
- mapeo Prisma completo;
- constraints reales en PostgreSQL de test.

### 10.4 HTTP y web

- auth obligatoria;
- Zod y códigos HTTP;
- `confirmed=true`;
- nunca aceptar importes desde cliente;
- diálogo de confirmación;
- bloqueo de selección incompatible;
- estados y errores;
- albarán `INVOICED` no editable;
- descarga autenticada.

### 10.5 E2E staging

Usar únicamente VeriFactu en pruebas:

1. completar un cliente ficticio;
2. crear dos albaranes revisados;
3. agruparlos;
4. confirmar una vez;
5. verificar una sola Invoice local y un solo `account.move`;
6. observar `posted`;
7. observar VeriFactu `accepted`;
8. comprobar QR y PDF;
9. comprobar visualmente que el PDF contiene todas las líneas de ambos albaranes y permite
   interpretarlo sin adjuntar los albaranes;
10. probar una factura multipágina y verificar que no pierde líneas, encabezados ni totales;
11. comprobar que no aparecen notas internas;
12. comprobar importes al céntimo;
13. repetir la petición y comprobar idempotencia;
14. simular timeout/reconciliación sin duplicar.

No reutilizar las facturas ID 1 y 2 del spike como fixtures modificables.

---

## 11. Observabilidad y operación

Logs estructurados con:

```text
invoiceId, remoteReference, externalInvoiceId, operation,
localState, odooMoveState, verifactuState, attempt, durationMs, errorCode
```

No incluir:

```text
ODOO_API_KEY, Authorization, certificado, NIF completo, domicilio completo,
PDF Base64, respuestas XML/JSON fiscales completas
```

Añadir métricas o contadores accesibles en logs:

- facturas creadas;
- reconciliaciones;
- aceptadas/rechazadas;
- errores por operación;
- latencia Odoo;
- facturas atascadas.

El health check general no debe fallar porque Odoo esté temporalmente caído. Añadir una comprobación
diagnóstica separada y protegida si resulta necesaria.

---

## 12. Seguridad de despliegue

1. Mantener `ODOO_INVOICING_ENABLED=false` por defecto.
2. Desplegar migración y código con la funcionalidad desactivada.
3. Verificar API/web y migración.
4. Configurar secretos directamente en el entorno, nunca en Git.
5. Activar únicamente en staging.
6. Ejecutar Fase 1D.
7. No activar en producción hasta cerrar:
   - serie y último número;
   - datos fiscales del emisor;
   - backfill de clientes;
   - fecha de corte de Sage;
   - plan de migración contable con gestoría;
   - revisión y aprobación humana final.

No fusionar automáticamente la rama ni desplegar producción como parte de esta fase.

---

## 13. Archivos previstos

### API

```text
api/prisma/schema.prisma
api/prisma/migrations/<timestamp>_add_customer_fiscal_data_and_invoices/migration.sql
api/src/config/env.ts
api/src/domain/entities/Customer.ts
api/src/domain/entities/DeliveryNote.ts
api/src/domain/entities/Invoice.ts
api/src/domain/ports/InvoiceGateway.ts
api/src/domain/repositories/InvoiceRepository.ts
api/src/domain/services/invoiceMoney.ts
api/src/application/use-cases/invoices/*
api/src/infrastructure/repositories/PrismaCustomerRepository.ts
api/src/infrastructure/repositories/PrismaDeliveryNoteRepository.ts
api/src/infrastructure/repositories/PrismaInvoiceRepository.ts
api/src/infrastructure/repositories/InMemoryInvoiceRepository.ts
api/src/infrastructure/services/OdooJson2InvoiceGateway.ts
api/src/infrastructure/services/InvoiceReconciliationScheduler.ts
api/src/schemas/customerSchemas.ts
api/src/schemas/invoiceSchemas.ts
api/src/controllers/InvoicesController.ts
api/src/routes/invoices.routes.ts
api/src/docs/openapi.ts
api/src/app.ts
api/src/server.ts
```

### Web

```text
web/src/domain/entities.ts
web/src/components/customers/CustomerFormStepper.tsx
web/src/features/invoices/*
web/src/pages/InvoicesPage.tsx
web/src/pages/DeliveryNotesPage.tsx
web/src/App.tsx
```

Añadir tests junto a cada unidad siguiendo las convenciones actuales.

---

## 14. Comandos de verificación

Adaptar al gestor raíz del monorepo, pero como mínimo ejecutar:

```powershell
pnpm --dir api prisma:generate
pnpm --dir api lint
pnpm --dir api test
pnpm --dir api build
pnpm --dir web lint
pnpm --dir web test
pnpm --dir web build
git diff --check
git status --short
```

La migración debe probarse contra una base PostgreSQL no productiva. No usar `prisma db push` como
sustituto de una migración versionada.

---

## 15. Definition of Done

La Fase 1 está terminada cuando:

- los clientes pueden almacenar y editar datos fiscales;
- 1..N albaranes revisados del mismo cliente generan como máximo una factura;
- la factura conserva snapshots fiscales y monetarios en Decimal;
- cada producto de los albaranes aparece como una línea visible e inmutable de la factura;
- el PDF es autosuficiente, soporta varias páginas y no expone notas internas;
- doble clic, concurrencia y timeout no crean duplicados;
- Odoo recibe, contabiliza y procesa VeriFactu mediante JSON-2;
- `accepted` es el único estado mostrado como completado;
- QR y PDF están disponibles sin exponer credenciales;
- los albaranes facturados quedan bloqueados y enlazados;
- existe reconciliación automática y manual;
- tests, compilación y migración pasan;
- OpenAPI y documentación operativa están actualizados;
- ningún secreto ni evidencia fiscal sensible está versionado;
- staging está validado con VeriFactu en pruebas;
- no se ha desplegado ni activado nada en producción.

**Resultado al 2026-07-26:** Definition of Done técnico cumplido. API `114/114` tests y web `21/21`;
lint, builds, migración y concurrencia real en PostgreSQL de staging correctos. La rama queda lista
para revisión humana y no se debe fusionar automáticamente en `main`.
