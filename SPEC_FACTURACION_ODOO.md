# SPEC — Facturación con Odoo (sustitución de Sage 50)

> Especificación del módulo de facturación de Epoxiron.
> **Fecha:** 2026-07-25 · **Versión:** v2.1 (revisión técnica y alojamiento cloud incorporados)
> **Estado:** Fase 0 en curso: rama y spike preparados; pendiente crear y validar la base Odoo Cloud.
> **Fase 1 NO se implementa hasta cerrar los bloqueantes (§13)**.
> **Autor:** Marcos + Claude · Revisión técnica: Codex.

---

## 0. Resumen ejecutivo

El cliente (empresa, Impuesto de Sociedades) usa **Sage 50** y quiere sustituirlo por **Odoo**, con
Epoxiron como front operativo del taller. Decisión: **migrar a Odoo** (Sage 50 no tiene API cómoda),
**poco a poco y validando primero en una base de pruebas alojada por Odoo**.

**Sin urgencia legal:** VeriFactu obliga a tener el SIF adaptado el **1-ene-2027** (Sociedades),
1-jul-2027 el resto, con periodo de pruebas previo (nota AEAT, ampliación dic-2025). Sage 50 ya cumple.

**Principio:** Epoxiron NO es un SIF. **Odoo es el motor fiscal/contable externo** (emite factura legal
con VeriFactu y contabiliza); Epoxiron es dueño de clientes, tarifas y albaranes, y **empuja las
facturas a Odoo** por su API tras un puerto `InvoiceGateway`. Mismo patrón que Hermes: la lógica
especializada vive fuera.

> **Nota de la revisión técnica:** la arquitectura es adecuada, pero el flujo de VeriFactu, la
> idempotencia y la persistencia monetaria necesitan más rigor. Este documento recoge esas correcciones.
> **La Fase 0 sí puede abordarse ya; la Fase 1 no, hasta cerrar §13 y el spike de §11.**

---

## 1. Decisiones cerradas

| Tema | Valor |
|---|---|
| Edición Odoo | **Custom (Enterprise)** — VeriFactu **nativo y mantenido por Odoo** (si la AEAT cambia algo, lo actualiza Odoo) |
| Alojamiento | **Standard Cloud Hosting de Odoo con plan Custom** — sin VPS propio; validar API y VeriFactu en el spike |
| Usuarios | **1** (≈ 29,90 €/mes año 1 · 37,40 €/mes después; Sage era 68 €/mes) |
| Estrategia | **Poco a poco**, validando en una **base de pruebas de Odoo Cloud** antes de producción |
| Git | Rama **`feature/facturacion-odoo`** (aislada de `main`/producción) |
| Fuente de la verdad de clientes | **Epoxiron** (sincroniza `res.partner` hacia Odoo) |
| Módulo fiscal | `l10n_es_edi_verifactu` (nativo Enterprise) |

**Pendiente de cerrar antes de Fase 1:** ver §13 (decisiones bloqueantes) y §11 (spike técnico).

---

## 2. Arquitectura objetivo

```
┌────────────────────────────────────────────────────────────┐
│                        EPOXIRON                             │
│  Web (React)  ───►  API (Express + Prisma + PostgreSQL)     │
│                         │  clientes · tarifas · albaranes    │
│                         ▼                                    │
│              ┌───────────────────────┐                      │
│              │  InvoiceGateway (port)│                      │
│              └───────────┬───────────┘                      │
└──────────────────────────┼──────────────────────────────────┘
                           │  API externa Odoo (XML-RPC o JSON-2,
                           │  decidido en Fase 0B; aislada tras el puerto)
                           ▼
┌────────────────────────────────────────────────────────────┐
│          ODOO (Custom/Enterprise, cloud gestionada)          │
│   res.partner ◄─ sync clientes                              │
│   account.move (out_invoice) ◄─ facturas                    │
│   l10n_es_edi_verifactu ─► hash · firma · QR · AEAT         │
│   Contabilidad (PGC, IVA, diarios)                          │
│                         │  exportes / libros registro        │
│                         ▼                                    │
│                    GESTORÍA (su propio software)            │
└────────────────────────────────────────────────────────────┘
```

| Responsabilidad | Dueño |
|---|---|
| Clientes, tarifas, albaranes, trabajo diario | **Epoxiron** (fuente de la verdad) |
| Emisión legal de factura (VeriFactu: hash, firma, QR, envío AEAT) | **Odoo** |
| Contabilidad, impuestos, libros registro | **Odoo** |
| Presentación de modelos AEAT | **Gestoría** (recibe exportes de Odoo) |
| Orquestación "albarán → factura" (saga) | **Epoxiron** (vía `InvoiceGateway`) |

---

## 3. Encaje en el código existente

El proyecto ya separa dominio, casos de uso, repositorios Prisma, controladores y rutas. La integración
encaja así (referencias verificadas en el repo):

| Pieza | Ubicación |
|---|---|
| Puerto `InvoiceGateway` | `api/src/domain/ports/` |
| Entidad `Invoice` + interfaz de repositorio | dominio |
| Casos de uso | `api/src/application/use-cases/invoices.ts` |
| Adaptador Odoo | `api/src/infrastructure/services/` |
| Repositorio Prisma (espejo local) | infraestructura |
| Controlador + esquemas + rutas de facturación | capa web |
| Inyección manual de dependencias | `api/src/app.ts` (~línea 60) |
| Nuevas variables de entorno validadas | `api/src/config/env.ts` (~línea 19) |
| Protección de rutas | automática: `authMiddleware` aplica a `/api` en `api/src/app.ts` (~línea 212) |

Carencias del modelo confirmadas en código:
- `Customer` sin NIF ni domicilio fiscal → `api/prisma/schema.prisma` (~línea 10).
- `DeliveryNote` sin relación con factura → `api/prisma/schema.prisma` (~línea 36).
- Estados actuales solo `DRAFT | PENDING | REVIEWED` → `api/src/domain/entities/DeliveryNote.ts` (~línea 1).
- Importes como `Float` → `api/prisma/schema.prisma` (~línea 44). **No reutilizar `Float` para factura.**
- La web reproduce esos estados (filtros, badges, transiciones) → `web/src/pages/DeliveryNotesPage.tsx`
  (~línea 71). Añadir `INVOICED` obliga a tocar ahí.

---

## 4. Modelo de estados (corrección clave)

**`action_post` NO equivale a "recibida/aceptada por la AEAT".** En Odoo hay que distinguir la
**confirmación contable** de la factura del **envío VeriFactu** posterior, que puede quedar diferido por
las ventanas de la AEAT. Por tanto no se debe exigir que el QR verificable esté disponible
inmediatamente tras `action_post`. Modelamos **tres estados independientes** + uno derivado para UI:

```ts
// 1) Estado del proceso local (saga)
type LocalState = 'CREATING' | 'CREATED_REMOTE' | 'LINKED' | 'RECONCILING' | 'FAILED';

// 2) Estado contable en Odoo (account.move.state)
type OdooMoveState = 'draft' | 'posted' | 'cancel';

// 3) Estado del documento VeriFactu (espejo del estado en Odoo)
type VerifactuState =
  | 'NOT_SENT' | 'PENDING' | 'ACCEPTED' | 'REJECTED';

// 4) Estado derivado para la UI (solo presentación)
type UiInvoiceStatus =
  | 'EN_PROCESO' | 'BORRADOR' | 'CONTABILIZADA'
  | 'AEAT_PENDIENTE' | 'AEAT_ACEPTADA' | 'AEAT_RECHAZADA' | 'ERROR';
```

- El estado local y el de Odoo **no se mezclan** en un único campo.
- El QR y la confirmación AEAT llegan cuando `VerifactuState = ACCEPTED`, posiblemente **después** de
  contabilizar → hace falta **reconciliación asíncrona** (§6).
- **A confirmar en el spike (Fase 0A):** nombres exactos de campos/estados de esta instancia Odoo 19 y
  si el envío es inmediato o diferido en modo VeriFactu.

---

## 5. Cambios en el modelo de datos de Epoxiron

### 5.1 `Customer` — datos fiscales **opcionales** al migrar
Los clientes existentes no tienen estos datos; una migración con columnas obligatorias fallaría. Estrategia:
**columnas opcionales ahora**, validación estricta **al facturar**, indicador de "ficha fiscal incompleta"
en la UI, backfill, y solo después valorar restricciones.

```ts
vat?: string;               // NIF/CIF — NO asumir UNIQUE (sucursales, duplicados históricos, contactos)
legalName?: string;         // razón social
fiscalAddress?: {
  street?: string; city?: string; zip?: string; province?: string; country?: string; // "ES"
};
externalPartnerId?: string;      // id de res.partner en Odoo (cache de sync)
```

> `vat` **no** se marca único sin confirmar antes sucursales, duplicados y contactos relacionados.
> La completitud fiscal **no se persiste**: se calcula en dominio a partir de NIF, razón social y
> domicilio para evitar que un indicador almacenado quede desactualizado.

### 5.2 Nueva entidad `Invoice` — importes en `Decimal`, no `Float`
```ts
{
  id: string;
  idempotencyKey: string;      // determinista y ÚNICO (§6). Constraint UNIQUE en BD.
  series: string;
  number?: string;             // nº legal devuelto por Odoo (tras posted)
  customerId: string;
  deliveryNoteIds: string[];   // proyección de lectura; la persistencia usa InvoiceDeliveryNote

  // Importes: Prisma Decimal, precisión definida (p. ej. @db.Decimal(12,2))
  subtotal: Decimal;           // base imponible
  taxRate: Decimal;            // p. ej. 21
  taxAmount: Decimal;          // cuota
  total: Decimal;              // subtotal + taxAmount

  localState: LocalState;
  odooMoveState?: OdooMoveState;
  verifactuState: VerifactuState;
  externalInvoiceId?: string;  // account.move de Odoo
  verifactuQrUrl?: string;     // disponibilidad independiente; determinar en el spike
  pdfKey?: string;             // ref interna al PDF servido por la API (§8), no URL de Odoo
  lastError?: string;
  createdAt: Date; updatedAt: Date;
}
```

**Reglas monetarias (a fijar en Fase 0B, alineadas con Odoo):**
- `Decimal` en Prisma para importes; precio unitario con la precisión acordada (p. ej. `Decimal(12,4)`),
  importes con `Decimal(12,2)`.
- **Redondeo:** decidir **por línea** vs **global** y configurarlo **igual en Odoo y en Epoxiron** para
  que cuadren al céntimo (Odoo tiene "Round per Line" / "Round Globally").
- Definir número de decimales de precio unitario, base imponible y cuota.
- Tratamiento de **precios con IVA incluido**: si aplica, `base = total / (1 + tipo)`.

### 5.3 `DeliveryNote` — trazabilidad
```ts
status: "DRAFT" | "PENDING" | "REVIEWED" | "INVOICED";  // + INVOICED
invoiceId?: string;
```
> Impacto UI: filtros, badges y transiciones en `web/src/pages/DeliveryNotesPage.tsx` (~línea 71).

### 5.4 Relación `InvoiceDeliveryNote` — reserva e idempotencia local

`deliveryNoteIds: string[]` es una proyección cómoda para dominio/API, pero no permite imponer en
PostgreSQL que un albarán pertenezca a una sola factura. La persistencia usa una tabla explícita:

```prisma
model InvoiceDeliveryNote {
  invoiceId      String
  deliveryNoteId String @unique

  invoice      Invoice      @relation(fields: [invoiceId], references: [id])
  deliveryNote DeliveryNote @relation(fields: [deliveryNoteId], references: [id])

  @@id([invoiceId, deliveryNoteId])
}
```

La `Invoice` en estado `CREATING` y sus asociaciones `InvoiceDeliveryNote` se crean en la **primera
transacción local**, antes de llamar a Odoo. Esto reserva los albaranes frente a doble clic y
peticiones concurrentes. La política para liberar o reutilizar la asociación tras una cancelación se
cerrará en Fase 0B/Fase 1 antes de implementar.

### 5.5 Endpoints nuevos (API Epoxiron)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/invoices` | Inicia la saga de facturación desde 1..N albaranes (idempotente) |
| GET | `/api/invoices` | Lista (filtros: `?customerId=`, `?state=`) |
| GET | `/api/invoices/:id` | Detalle + estados |
| GET | `/api/invoices/:id/pdf` | **Proxy autenticado** del PDF (§8) |
| POST | `/api/invoices/:id/reconcile` | Reintento/reconciliación manual (además del job) |

---

## 6. Flujo de facturación como **saga idempotente** (no transacción distribuida)

"Guardar la referencia externa antes de confirmar" **no** cubre todos los fallos (Odoo crea la factura y
la API cae; timeout de Odoo tras haber creado; dos peticiones concurrentes sobre el mismo albarán; Odoo
confirma pero falla la transacción local). Diseño:

```
1. Validar ficha fiscal del cliente (NIF + domicilio). Si incompleta → 422.
2. Calcular idempotencyKey determinista (p. ej. hash de deliveryNoteIds ordenados + serie).
3. INSERT Invoice local en estado CREATING con UNIQUE(idempotencyKey)
   → si hay concurrencia/doble clic, el segundo INSERT falla (lock lógico).
4. Constraint de BD: un albarán NO puede estar en más de una Invoice activa (no cancelada).
5. Antes de crear en Odoo: BUSCAR en Odoo por la referencia Epoxiron (idempotencyKey escrita en un
   campo de account.move, p. ej. `ref`/campo propio) → recuperación si ya se creó antes.
6. Si no existe: crear account.move (draft) escribiendo la referencia Epoxiron.
7. Confirmar (action_post) → pasa a posted; el envío VeriFactu puede ser inmediato o diferido.
8. Operación local FINAL en una ÚNICA transacción Prisma:
   set externalInvoiceId, number, odooMoveState, localState=LINKED, y marcar albaranes INVOICED.
9. Reconciliación asíncrona (job programado + endpoint manual):
   - Para Invoices en CREATING/RECONCILING: consultar Odoo por referencia y adoptar/limpiar.
   - Para VerifactuState PENDING: sondear hasta ACCEPTED/REJECTED, guardar QR cuando ACCEPTED.
```

Componentes de idempotencia/recuperación:
- `idempotencyKey` determinista y único (constraint).
- Constraint "un albarán → una factura activa".
- Referencia Epoxiron escrita en Odoo para poder **buscar antes de crear**.
- Máquina de estados explícita (§4).
- Cierre local en **una** transacción Prisma.
- Job/endpoint de **reconciliación** y reintento.
- Lock lógico contra dobles clics y peticiones concurrentes.

---

## 7. Contrato del puerto `InvoiceGateway`

```ts
interface InvoiceGateway {
  ensureCustomer(c: FiscalCustomer): Promise<ExternalPartnerId>;
  findInvoiceByRef(idempotencyKey: string): Promise<RemoteInvoiceRef | null>; // recuperación
  createDraftInvoice(input: CreateInvoiceInput): Promise<RemoteInvoiceRef>;
  postInvoice(externalInvoiceId: string): Promise<PostResult>;               // action_post
  getVerifactuState(externalInvoiceId: string): Promise<VerifactuResult>;
  fetchInvoicePdf(externalInvoiceId: string): Promise<Buffer>;               // servido por la API (§8)
}

type VerifactuResult = {
  state: VerifactuState;
  qrUrl?: string;
  rejectionReason?: string;
};
```
> El dominio no conoce Odoo; solo este puerto. Dos implementaciones posibles (XML-RPC / JSON-2), se elige
> en Fase 0B. Credenciales en variables de entorno validadas en `env.ts`, nunca en el repo.

---

## 8. Contrato del PDF

No exponer al navegador URLs internas de Odoo ni credenciales/sesiones. Preferencia:
- `GET /api/invoices/:id/pdf` → la **API recupera el PDF de Odoo (server-side, autenticado)** y lo
  **sirve autenticada** (detrás de `authMiddleware`).
- **R2 como optimización posterior**: cachear una copia estable y servir desde ahí (ya existe pipeline
  R2 en el proyecto). No es requisito de Fase 1.
- Nunca redirección directa con credenciales de Odoo al cliente.

---

## 9. Transporte: XML-RPC vs JSON-2 (decisión explícita en Fase 0B)

- Odoo 19 ofrece la **API JSON-2** (`/json/2/<model>/<method>`, autenticación Bearer, **a confirmar el
  formato exacto contra la instancia** en el spike). Odoo documenta la **retirada de XML-RPC/JSON-RPC en
  Odoo 22**. **Ambas** APIs externas requieren el **plan Custom**, que debe contratarse o activarse
  antes del spike.
- Recomendación: como staging será Odoo 19 y XML-RPC está en retirada, **evaluar empezar directamente con
  JSON-2**. El aislamiento por el puerto `InvoiceGateway` permite cambiar sin tocar el dominio.
- Se decide en **Fase 0B** tras el spike, documentando campos y métodos reales de la instancia.

---

## 10. VeriFactu y continuidad

- **Serie:** se mantiene la actual del cliente (VeriFactu no obliga a reiniciarla).
- **Encadenamiento:** la cadena de hash **arranca de cero en Odoo** (nuevo SIF), por SIF + NIF. Cortar
  con Sage y empezar en Odoo es correcto y legal.
- **Corte limpio:** fecha fija (fin de mes); no emitir desde Sage y Odoo a la vez para el mismo NIF.
- **Envío AEAT:** separado y potencialmente diferido respecto a `action_post` (§4) → reconciliación (§6).
- **Edición:** Custom/Enterprise → `l10n_es_edi_verifactu` nativo, mantenido por Odoo ante cambios AEAT.

---

## 11. Plan de implementación recomendado

**Fase 0A — Decisiones y spike técnico**
- Cerrar preguntas bloqueantes (§13).
- Crear una base de pruebas en el **Standard Cloud Hosting de Odoo** con plan Custom, localización ES,
  módulo VeriFactu, certificado y entorno de pruebas.
- Probar autenticación, lectura de modelos y **campos reales disponibles**.
- Crear **manualmente** una factura y observar el **flujo real** de VeriFactu, PDF, QR y **tiempos de
  envío** a la AEAT.

**Fase 0B — Contrato definitivo**
- Documentar campos y métodos reales de esa instancia.
- Elegir **XML-RPC o JSON-2**.
- Definir estados, idempotencia, **redondeos** y recuperación ante fallos.

**Fase 1A — Datos fiscales**
- Migración **compatible** con clientes existentes (columnas opcionales).
- Validación NIF/domicilio; formulario fiscal; indicador de ficha incompleta; cobertura de tests.

**Fase 1B — Núcleo de facturación**
- Entidad, repositorios, gateway y casos de uso.
- **Saga idempotente** y reconciliación.
- Tests unitarios con `InMemoryRepository` y gateway falso; tests de integración Prisma.

**Fase 1C — UI**
- Selección de albaranes elegibles.
- **Confirmación explícita antes de escribir** (regla del proyecto).
- Estados de procesamiento y errores recuperables; consulta y descarga de factura.

**Fase 1D — Validación en staging**
- Doble clic, timeout, caída entre Odoo y PostgreSQL, reintento.
- **Cuadre exacto** de base, IVA y total.
- Factura, envío VeriFactu y QR comprobados.

---

## 12. Fase 0 — Preparación (git + Odoo staging)

### 12.1 Rama de trabajo
```bash
cd "C:\Users\Marcos\Documents\Codex\epoxiron mayo_2026"
git checkout main && git pull origin main   # base limpia y actualizada
git checkout -b feature/facturacion-odoo     # crea y cambia a la rama (aísla de producción)
git push -u origin feature/facturacion-odoo  # publica la rama y enlaza upstream
```

### 12.2 Base de pruebas en Odoo Cloud
- Contratar/activar el plan **Custom** con **Standard Cloud Hosting** gestionado por Odoo.
- Crear una base exclusiva de pruebas; no usar todavía la futura base de producción.
- Activar **Localización España** + **`l10n_es_edi_verifactu`** y cargar el **certificado digital**.
- Mantener VeriFactu en modo **pruebas** mientras se valida.
- Para el spike, generar una **API key dedicada** en el único usuario administrador contratado y usar
  su login en `ODOO_USER`; no crear todavía un segundo usuario interno, porque puede incrementar la
  suscripción. Antes de producción se decidirá si se contrata un usuario técnico separado con permisos
  mínimos o se mantiene una key exclusiva y revocable del administrador.
- Confirmar en el spike que Odoo Cloud permite el campo de idempotencia necesario mediante Studio;
  si exigiera un módulo propio, reevaluar Odoo.sh o self-hosting antes de Fase 1.

**Criterio de aceptación Fase 0:** Odoo accesible, localización ES + VeriFactu activos, y una llamada de
prueba a la API externa (auth + leer `res.partner`) responde OK.

---

## 13. Decisiones que BLOQUEAN la Fase 1 (cerrar con cliente/gestoría)

- [ ] Facturación **por albarán** o **agrupada**.
- [ ] ¿Los precios actuales son **base imponible** o **incluyen IVA**?
- [ ] **Serie(s)** y **último número** de Sage.
- [ ] **Tipos de IVA** y excepciones reales (exentos, intracomunitarios, recargo de equivalencia).
- [ ] **Rectificativas y abonos**: cómo se gestionan.
- [ ] **Forma y condiciones de pago**.
- [ ] Qué significa funcionalmente **"factura completada"**: contabilizada, enviada o **aceptada por AEAT**.
- [ ] Datos fiscales del **emisor** (razón social, NIF, domicilio, pie, IBAN).
- [ ] **NIF/CIF + domicilio** de cada cliente (backfill).
- [ ] Handoff a la **gestoría**: software, formato y periodicidad de los datos.

---

## 14. Criterios de aceptación por fase

- **Fase 0:** Odoo staging con localización ES + VeriFactu + API respondiendo.
- **Fase 1:** emitir factura real desde albarán, con serie continuada, IVA correcto, cuadre al céntimo,
  y **QR VeriFactu cuando AEAT la acepte** (posiblemente diferido), con la Invoice espejo y el albarán
  INVOICED; resistente a doble clic/timeout/caída (saga + reconciliación).

---

## 15. Referencias oficiales

- Odoo — External JSON-2 API (19.0): https://www.odoo.com/documentation/19.0/developer/reference/external_api.html
- Odoo — External RPC API / retirada XML-RPC (19.0): https://www.odoo.com/documentation/19.0/developer/reference/external_rpc_api.html
- Odoo — Localización fiscal España (19.0): https://www.odoo.com/documentation/19.0/applications/finance/fiscal_localizations/spain.html
- AEAT — Ampliación de plazos VeriFactu (dic-2025): https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/nota-informativa-ampliacion-plazo-adaptacion-facturacion.html

---

## 16. Estado y siguiente paso

**No generar aún el prompt de Codex de Fase 1.** Orden:
1. Cerrar §13 (bloqueantes) con cliente/gestoría.
2. Ejecutar **Fase 0A/0B** (spike en staging) y fijar contrato real (API, estados, redondeos, PDF, envío).
3. Solo entonces generar `CODEX_FACTURAS_ODOO_FASE1.md` (1A→1D) sobre `feature/facturacion-odoo`.

El árbol de trabajo del repo permanece intacto; el único archivo nuevo es esta spec.
