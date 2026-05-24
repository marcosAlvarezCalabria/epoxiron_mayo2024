# 🏗️ Epoxiron — Prompt para Codex
> Crea la estructura completa del proyecto siguiendo esta especificación exacta.

---

## Visión General

**Epoxiron** es una aplicación web para gestión de un taller de pintura industrial (powder coating). Permite administrar clientes con sus tarifas personalizadas y generar albaranes con cálculo automático de precios.

**Sin autenticación.** La app es privada y de uso personal — acceso directo sin login.

---

## Stack Tecnológico

### Frontend (`/web`)
- React 19 + TypeScript
- Vite
- Tailwind CSS v3 (dark mode industrial)
- TanStack Query (React Query) — estado servidor
- Zustand — estado global UI
- React Router DOM v6
- Zod + React Hook Form — validación
- Heroicons — iconografía
- Fetch API wrapper personalizado (`apiClient.ts`)

### Backend (`/api`)
- Node.js + TypeScript
- Express.js
- Prisma ORM
- PostgreSQL (Docker)
- Zod — validación de entrada

---

## Arquitectura

### Estructura de Carpetas

```
epoxiron/
├── api/
│   ├── src/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── Customer.ts
│   │   │   │   └── DeliveryNote.ts
│   │   │   ├── value-objects/
│   │   │   │   └── Price.ts
│   │   │   └── exceptions/
│   │   │       ├── CustomerException.ts
│   │   │       └── DeliveryNoteException.ts
│   │   ├── application/
│   │   │   └── use-cases/
│   │   │       ├── customers/
│   │   │       │   ├── CreateCustomerUseCase.ts
│   │   │       │   ├── UpdateCustomerUseCase.ts
│   │   │       │   ├── DeleteCustomerUseCase.ts
│   │   │       │   └── GetCustomersUseCase.ts
│   │   │       └── delivery-notes/
│   │   │           ├── CreateDeliveryNoteUseCase.ts
│   │   │           ├── UpdateDeliveryNoteUseCase.ts
│   │   │           ├── DeleteDeliveryNoteUseCase.ts
│   │   │           ├── GetDeliveryNotesUseCase.ts
│   │   │           └── CalculatePriceUseCase.ts
│   │   ├── infrastructure/
│   │   │   ├── repositories/
│   │   │   │   ├── PrismaCustomerRepository.ts
│   │   │   │   └── PrismaDeliveryNoteRepository.ts
│   │   │   └── prisma/
│   │   │       └── client.ts
│   │   ├── routes/
│   │   │   ├── customers.routes.ts
│   │   │   └── deliveryNotes.routes.ts
│   │   ├── controllers/
│   │   │   ├── CustomersController.ts
│   │   │   └── DeliveryNotesController.ts
│   │   ├── middleware/
│   │   │   ├── errorHandler.ts
│   │   │   └── validateRequest.ts
│   │   └── server.ts
│   ├── prisma/
│   │   └── schema.prisma
│   ├── package.json
│   └── tsconfig.json
│
├── web/
│   ├── src/
│   │   ├── domain/
│   │   │   └── entities/
│   │   │       ├── Customer.ts
│   │   │       └── DeliveryNote.ts
│   │   ├── infrastructure/
│   │   │   ├── api/
│   │   │   │   └── apiClient.ts
│   │   │   └── repositories/
│   │   │       ├── CustomersApiRepository.ts
│   │   │       └── DeliveryNotesApiRepository.ts
│   │   ├── application/
│   │   │   └── use-cases/
│   │   │       ├── useGetCustomers.ts
│   │   │       ├── useCreateCustomer.ts
│   │   │       ├── useGetDeliveryNotes.ts
│   │   │       └── useCreateDeliveryNote.ts
│   │   ├── features/
│   │   │   ├── customers/
│   │   │   │   ├── components/
│   │   │   │   │   ├── CustomerList.tsx
│   │   │   │   │   ├── CustomerForm.tsx
│   │   │   │   │   └── SpecialPiecesInput.tsx
│   │   │   │   └── hooks/
│   │   │   │       └── useCustomers.ts
│   │   │   └── delivery-notes/
│   │   │       ├── components/
│   │   │       │   ├── DeliveryNoteList.tsx
│   │   │       │   ├── DeliveryNoteForm.tsx
│   │   │       │   ├── DeliveryNoteItem.tsx
│   │   │       │   └── StatusBadge.tsx
│   │   │       └── hooks/
│   │   │           └── useDeliveryNotes.ts
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   └── Badge.tsx
│   │   │   └── layout/
│   │   │       ├── Navbar.tsx
│   │   │       └── Layout.tsx
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── CustomersPage.tsx
│   │   │   └── DeliveryNotesPage.tsx
│   │   ├── lib/
│   │   │   └── queryClient.ts
│   │   └── App.tsx
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
└── docker-compose.yml
```

---

## Modelo de Datos

### Schema Prisma (`api/prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Customer {
  id            String   @id @default(uuid())
  name          String
  email         String?
  phone         String?
  address       String?
  notes         String?

  // Tarifas embebidas
  pricePerLinearMeter Float @default(0)
  pricePerSquareMeter Float @default(0)
  minimumRate         Float @default(0)
  grosorMm            Float?
  grosorPrecio        Float?

  specialPieces SpecialPiece[]
  deliveryNotes DeliveryNote[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model SpecialPiece {
  id         String   @id @default(uuid())
  name       String
  price      Float
  customerId String
  customer   Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
}

model DeliveryNote {
  id           String             @id @default(uuid())
  number       String             @unique
  customerId   String
  customer     Customer           @relation(fields: [customerId], references: [id])
  customerName String
  status       DeliveryNoteStatus @default(DRAFT)
  notes        String?
  totalAmount  Float              @default(0)
  date         DateTime           @default(now())
  items        DeliveryNoteItem[]
  createdAt    DateTime           @default(now())
  updatedAt    DateTime           @updatedAt
}

model DeliveryNoteItem {
  id             String       @id @default(uuid())
  deliveryNoteId String
  deliveryNote   DeliveryNote @relation(fields: [deliveryNoteId], references: [id], onDelete: Cascade)
  description    String
  color          String
  linearMeters   Float?
  squareMeters   Float?
  thickness      Float?
  quantity       Int
  unitPrice      Float
  totalPrice     Float
}

enum DeliveryNoteStatus {
  DRAFT
  PENDING
  REVIEWED
}
```

---

## Lógica de Precios (en la API — `CalculatePriceUseCase.ts`)

La API es responsable de calcular todos los precios. El frontend nunca calcula, solo muestra.

```typescript
// Orden de prioridad:
// 1. Si el nombre de la pieza coincide con una specialPiece del cliente → precio fijo
// 2. Si tiene linearMeters → linearMeters × pricePerLinearMeter × quantity
// 3. Si tiene squareMeters → squareMeters × pricePerSquareMeter × quantity
// 4. Si el resultado < minimumRate → aplicar minimumRate × quantity
// 5. Si thickness >= grosorMm → sumar grosorPrecio × quantity

function calculateItemPrice(item, customer): number {
  const specialPiece = customer.specialPieces.find(
    sp => sp.name.toLowerCase() === item.description.toLowerCase()
  )
  if (specialPiece) return specialPiece.price * item.quantity

  let price = 0
  if (item.linearMeters) {
    price = item.linearMeters * customer.pricePerLinearMeter * item.quantity
  } else if (item.squareMeters) {
    price = item.squareMeters * customer.pricePerSquareMeter * item.quantity
  }

  const minimum = customer.minimumRate * item.quantity
  if (price < minimum) price = minimum

  if (item.thickness && customer.grosorMm && item.thickness >= customer.grosorMm) {
    price += customer.grosorPrecio * item.quantity
  }

  return Math.round(price * 100) / 100
}
```

---

## Endpoints API

```
GET    /api/customers              → lista todos los clientes
GET    /api/customers/:id          → detalle de un cliente
POST   /api/customers              → crear cliente
PUT    /api/customers/:id          → actualizar cliente
DELETE /api/customers/:id          → eliminar cliente (error si tiene albaranes)

GET    /api/delivery-notes                    → lista albaranes (filtros: ?status=&customerId=&today=true)
GET    /api/delivery-notes/:id                → detalle albarán
POST   /api/delivery-notes                    → crear albarán (API calcula precios)
PUT    /api/delivery-notes/:id                → actualizar albarán
DELETE /api/delivery-notes/:id               → eliminar (solo si DRAFT)
PATCH  /api/delivery-notes/:id/status        → cambiar estado

POST   /api/delivery-notes/calculate-price   → preview de precio sin guardar
```

---

## Diseño Visual

**Dark mode industrial.** Todos los colores en modo oscuro por defecto.

### Colores
```
Fondo principal:  bg-gray-900  (#111827)
Fondo cards:      bg-gray-800  (#1F2937)
Fondo inputs:     bg-gray-900/50
Borde cards:      border-gray-700
Borde inputs:     border-gray-600

Azul (primario):  text-blue-400 / bg-blue-600
Verde (revisado): text-green-400 / border-green-500
Amarillo (pend.): text-yellow-400
Rojo (error):     text-red-400 / border-red-600
Morado (m²):      text-purple-400
```

### Componentes
```
Cards:   rounded-xl border border-gray-700
         hover:border-blue-500/50 hover:bg-gray-700/50 transition-all

Inputs:  bg-gray-900 border border-gray-600 rounded-lg
         focus:ring-2 focus:ring-blue-500 focus:border-blue-500
         error: border-red-500

Chips:   bg-blue-900/30 border border-blue-700/50 text-blue-200
         con botón × para eliminar

Badges:
  DRAFT    → bg-gray-700 text-gray-300
  PENDING  → bg-yellow-900/30 text-yellow-400 border-yellow-700/50
  REVIEWED → bg-green-900/30 text-green-400 border-green-700/50
```

### Tipografía
```
Headings:  font-bold text-gray-100
Labels:    text-xs font-bold text-gray-400 uppercase tracking-wider
Precios:   font-mono
Fuente:    Inter (system default sans-serif)
Iconos:    Heroicons 20px-24px (w-5 h-5 / w-6 h-6)
```

### Páginas

**Dashboard** — resumen del día:
- Stats: albaranes hoy, piezas totales, importe total, revisados/total
- Tabla de albaranes del día con acceso rápido

**Clientes** — CRUD completo:
- Listado con búsqueda por nombre
- Formulario con:
  - Datos personales (nombre, email, teléfono, dirección, notas)
  - 3 tarjetas visuales grandes para precioMl / precioM2 / tarifaMínima con input central grande
  - Piezas especiales: input "nombre + precio + Enter" que genera chips eliminables

**Albaranes** — CRUD completo:
- Listado con filtros por estado, cliente, fecha
- Formulario de creación:
  - Autocomplete de cliente
  - Tabla de items con columnas: descripción, color RAL, cantidad, ml, m²
  - El precio unitario se muestra en tiempo real (llamada a `/calculate-price`)
  - Botones: Guardar borrador / Marcar pendiente
- Detalle con botón "Marcar revisado"

---

## Docker

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: epoxiron
      POSTGRES_USER: epoxiron
      POSTGRES_PASSWORD: epoxiron123
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

---

## Variables de Entorno

```bash
# api/.env
DATABASE_URL="postgresql://epoxiron:epoxiron123@localhost:5432/epoxiron"
PORT=3001

# web/.env
VITE_API_URL=http://localhost:3001
```

---

## Instrucciones para Codex

1. Crea la estructura de carpetas completa tal como se define arriba
2. Instala todas las dependencias en cada proyecto
3. Configura `tsconfig.json` con paths aliases (`@/domain/*`, `@/application/*`, etc.)
4. Crea el `schema.prisma` exactamente como se define
5. Crea el `docker-compose.yml`
6. Crea los archivos `.env.example` para api y web
7. Implementa primero la API completa con todos los endpoints
8. Implementa después el frontend conectado a la API
9. La lógica de precios vive SOLO en la API (`CalculatePriceUseCase.ts`)
10. El frontend llama a `/calculate-price` para mostrar preview en tiempo real
