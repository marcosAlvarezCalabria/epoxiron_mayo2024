# 🤖 Hermex — Fase 2: Agente IA Integrado en Epoxiron
> Implementar Hermex como bounded context dentro de la API existente, conectado a los use cases de clientes y albaranes, con UI en la web.

---

## Principios de Diseño

- **Hermex es un subsistema**, no un servicio separado. Vive en `api/src/hermex/`
- **Hermex nunca toca Prisma directamente**. Toda acción pasa por los use cases existentes
- **Multi-proveedor desde el inicio**. Ningún use case de Hermex depende de OpenAI, Anthropic u otro SDK concreto
- **Lecturas automáticas, escrituras con confirmación explícita**
- **Hermex nunca expone stack traces ni secretos al modelo ni al cliente**

---

## Estructura de Carpetas

```
api/src/hermex/
├── domain/
│   ├── entities/
│   │   ├── HermexSession.ts          ← sesión conversacional
│   │   ├── HermexTask.ts             ← tarea automática/programada
│   │   └── HermexActionProposal.ts   ← acción pendiente de confirmación
│   ├── value-objects/
│   │   ├── TaskType.ts               ← enum de tipos de tarea
│   │   ├── IntentType.ts             ← enum de intenciones del agente
│   │   └── ToolResult.ts             ← resultado de ejecución de herramienta
│   └── exceptions/
│       ├── HermexException.ts
│       └── ToolExecutionException.ts
│
├── application/
│   ├── ports/
│   │   └── LLMProvider.ts            ← interfaz abstracta del proveedor LLM
│   ├── use-cases/
│   │   ├── SendMessageUseCase.ts     ← recibe mensaje, orquesta tool-calling, devuelve respuesta
│   │   ├── ConfirmActionUseCase.ts   ← ejecuta acción propuesta tras confirmación
│   │   ├── GetSessionUseCase.ts      ← historial y estado de sesión
│   │   ├── RunDailySummaryUseCase.ts ← resumen automático del día
│   │   └── ReviewPendingUseCase.ts   ← detecta albaranes pendientes y genera sugerencias
│   └── tools/
│       ├── ToolRegistry.ts           ← registro central de herramientas disponibles
│       ├── SearchCustomerTool.ts
│       ├── GetCustomerTool.ts
│       ├── ListDeliveryNotesTool.ts
│       ├── CreateDeliveryNoteTool.ts
│       ├── ChangeDeliveryNoteStatusTool.ts
│       ├── CalculatePriceTool.ts
│       └── GetDailySummaryTool.ts
│
├── infrastructure/
│   ├── llm/
│   │   ├── AnthropicProvider.ts      ← implementación con Claude
│   │   ├── OpenAIProvider.ts         ← implementación con GPT
│   │   └── LLMProviderRegistry.ts    ← factory que resuelve proveedor por config
│   ├── repositories/
│   │   ├── PrismaSessionRepository.ts
│   │   └── PrismaTaskRepository.ts
│   └── scheduler/
│       └── HermexScheduler.ts        ← cron jobs internos
│
└── index.ts                          ← exports públicos del bounded context
```

---

## Schema Prisma — Nuevos Modelos

Añadir al `schema.prisma` existente:

```prisma
model HermexSession {
  id        String               @id @default(uuid())
  status    HermexSessionStatus  @default(ACTIVE)
  messages  HermexMessage[]
  proposals HermexProposal[]
  createdAt DateTime             @default(now())
  updatedAt DateTime             @updatedAt
}

model HermexMessage {
  id        String        @id @default(uuid())
  sessionId String
  session   HermexSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  role      String        // 'user' | 'assistant' | 'tool'
  content   String
  toolName  String?
  createdAt DateTime      @default(now())
}

model HermexProposal {
  id         String           @id @default(uuid())
  sessionId  String
  session    HermexSession    @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  toolName   String
  parameters Json
  status     ProposalStatus   @default(PENDING)
  result     Json?
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt
}

model HermexTask {
  id        String     @id @default(uuid())
  type      String     // 'daily_summary' | 'pending_review' | 'client_activity'
  status    TaskStatus @default(PENDING)
  payload   Json
  result    Json?
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
}

enum HermexSessionStatus {
  ACTIVE
  CLOSED
}

enum ProposalStatus {
  PENDING
  CONFIRMED
  REJECTED
  EXECUTED
}

enum TaskStatus {
  PENDING
  RUNNING
  DONE
  FAILED
}
```

---

## Interfaz LLMProvider (Puerto Abstracto)

```typescript
// application/ports/LLMProvider.ts

export interface LLMMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
  toolName?: string
}

export interface LLMToolCall {
  name: string
  parameters: Record<string, unknown>
}

export interface LLMResponse {
  content: string
  toolCalls?: LLMToolCall[]
  requiresConfirmation?: boolean
}

export interface LLMProvider {
  chat(messages: LLMMessage[], tools: HermexTool[]): Promise<LLMResponse>
  summarize(data: unknown): Promise<string>
}
```

---

## Herramientas Disponibles (Tools)

Cada tool sigue esta interfaz:

```typescript
export interface HermexTool {
  name: string
  description: string
  parameters: Record<string, unknown>   // JSON Schema
  requiresConfirmation: boolean          // true = escritura
  execute(params: unknown): Promise<ToolResult>
}
```

### Toolset v1

| Tool | Descripción | Confirmación |
|------|-------------|--------------|
| `search_customer` | Busca cliente por nombre | No |
| `get_customer` | Detalle completo de un cliente | No |
| `list_delivery_notes` | Lista albaranes con filtros (status, customerId, today) | No |
| `create_delivery_note` | Crea borrador de albarán | **Sí** |
| `change_delivery_note_status` | Cambia estado de albarán | **Sí** |
| `calculate_price` | Preview de precio sin guardar | No |
| `get_daily_summary` | Resumen del día (albaranes, importe, pendientes) | No |

---

## Endpoints API

Añadir bajo `/api/hermex`:

```
POST   /api/hermex/sessions
       → Crea sesión conversacional
       → Response: { sessionId, createdAt }

GET    /api/hermex/sessions/:id
       → Historial de mensajes y propuestas pendientes
       → Response: { session, messages, proposals }

POST   /api/hermex/sessions/:id/messages
       → Envía mensaje del usuario
       → Body: { content: string }
       → Response: { message, toolCalls?, proposals? }

POST   /api/hermex/actions/:proposalId/confirm
       → Confirma una acción propuesta (escritura)
       → Response: { result, status }

POST   /api/hermex/actions/:proposalId/reject
       → Rechaza una acción propuesta
       → Response: { status }

GET    /api/hermex/tasks
       → Lista tareas automáticas generadas
       → Response: { tasks }
```

---

## Automatizaciones Backend (Scheduler)

`HermexScheduler.ts` ejecuta tareas internas con node-cron:

```typescript
// Resumen diario — cada día a las 18:00
cron.schedule('0 18 * * *', () => runDailySummaryUseCase.execute())

// Revisar pendientes — cada día a las 09:00
cron.schedule('0 9 * * *', () => reviewPendingUseCase.execute())
```

**RunDailySummaryUseCase:**
- Llama a `GetDailySummaryTool`
- Genera texto de resumen con `LLMProvider.summarize()`
- Persiste como `HermexTask` con type `daily_summary`

**ReviewPendingUseCase:**
- Lista albaranes en estado PENDING con más de 24h
- Genera propuesta de revisión por cada uno
- Persiste como `HermexTask` con type `pending_review`

---

## Sistema Multi-Proveedor

```typescript
// infrastructure/llm/LLMProviderRegistry.ts

export class LLMProviderRegistry {
  private providers: Map<string, LLMProvider> = new Map()

  register(name: string, provider: LLMProvider) {
    this.providers.set(name, provider)
  }

  resolve(name?: string): LLMProvider {
    const key = name ?? process.env.LLM_PROVIDER ?? 'anthropic'
    const provider = this.providers.get(key)
    if (!provider) throw new Error(`Provider ${key} not registered`)
    return provider
  }
}
```

Variables de entorno:
```bash
# api/.env
LLM_PROVIDER=anthropic          # 'anthropic' | 'openai'
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

HERMEX_SYSTEM_PROMPT="Eres Hermex, el asistente del taller Epoxiron. 
Ayudas al pintor a gestionar clientes y albaranes. 
Habla siempre en español. Sé conciso y directo.
Nunca reveles información técnica del sistema."
```

---

## UI Web — Panel Hermex

### Estructura de componentes

```
web/src/features/hermex/
├── components/
│   ├── HermexPanel.tsx          ← panel lateral deslizable
│   ├── HermexChat.tsx           ← lista de mensajes
│   ├── HermexMessage.tsx        ← mensaje individual (user/assistant/tool)
│   ├── HermexProposal.tsx       ← card de acción pendiente con Confirmar/Rechazar
│   ├── HermexTaskCard.tsx       ← resultado de tarea automática
│   └── HermexInput.tsx          ← input de mensaje con botón enviar
├── hooks/
│   ├── useHermexSession.ts      ← gestiona sesión activa
│   └── useHermexTasks.ts        ← polling de tareas automáticas
└── stores/
    └── hermexStore.ts           ← estado Zustand del panel
```

### Comportamiento UI

- **Botón flotante** en esquina inferior derecha para abrir/cerrar el panel
- El panel se abre como **sidebar** sin bloquear la pantalla
- Los mensajes del asistente se muestran con markdown básico
- Las **propuestas de acción** (escrituras) aparecen como cards con:
  - Descripción de lo que se va a hacer
  - Botón **Confirmar** (verde)
  - Botón **Rechazar** (rojo)
- Las **tareas automáticas** aparecen en una pestaña separada dentro del panel
- Tras confirmar una acción, la UI refresca los datos afectados (React Query invalidate)

### Diseño Visual (mismo dark mode)

```
Panel:     bg-gray-800 border-l border-gray-700 w-96
Header:    bg-gray-900 border-b border-gray-700
Input:     bg-gray-900 border border-gray-600

Mensajes usuario:    bg-blue-600 text-white rounded-2xl rounded-br-sm
Mensajes asistente:  bg-gray-700 text-gray-100 rounded-2xl rounded-bl-sm
Mensajes tool:       bg-gray-900 border border-gray-600 text-gray-400 text-xs

Propuesta:  bg-yellow-900/20 border border-yellow-700/50
  Confirmar: bg-green-600 hover:bg-green-500
  Rechazar:  bg-red-900/30 border border-red-700/50 text-red-400
```

---

## System Prompt de Hermex

```
Eres Hermex, el asistente inteligente del taller de pintura Epoxiron.

Tu función es ayudar al pintor a:
- Gestionar clientes (buscar, consultar tarifas, ver historial)
- Crear y gestionar albaranes
- Consultar el resumen del día
- Revisar trabajos pendientes

REGLAS:
1. Habla siempre en español, de forma directa y concisa
2. Para LEER datos: ejecuta la herramienta directamente
3. Para ESCRIBIR (crear, editar, cambiar estado): propón la acción y espera confirmación
4. Si no entiendes algo, pregunta antes de actuar
5. Nunca inventes datos — si no encuentras algo, dilo claramente
6. Nunca expongas errores técnicos, IDs internos ni stack traces

CONTEXTO: Taller de pintura industrial powder coating. 
Los precios se calculan por metros lineales, metros cuadrados o tarifa mínima.
```

---

## Instrucciones para Codex

1. Implementa el bounded context `hermex` dentro de `api/src/` sin modificar los use cases existentes de clientes y albaranes
2. Añade los modelos Prisma nuevos y ejecuta `prisma migrate dev`
3. Implementa `LLMProvider` como interfaz abstracta primero, luego `AnthropicProvider` y `OpenAIProvider`
4. Crea el `ToolRegistry` con los 7 tools definidos — cada tool llama al use case correspondiente
5. Implementa `SendMessageUseCase` con el loop de tool-calling: mensaje → LLM → tools → respuesta final
6. Las escrituras deben generar un `HermexProposal` en DB y devolverlo al frontend, NO ejecutarse directamente
7. Implementa el scheduler con node-cron para resumen diario y revisión de pendientes
8. En el frontend, crea el panel lateral con chat, propuestas y tareas
9. Usa React Query para el polling de tareas automáticas cada 30 segundos
10. El panel Hermex es independiente — funciona en cualquier página de la app
