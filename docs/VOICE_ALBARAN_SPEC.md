# Entrada por voz para crear albaranes

## Objetivo

Reducir la friccion al crear albaranes desde la web permitiendo que el operario dicte las piezas en voz alta y que la aplicacion pre-rellene el formulario actual de albaranes con datos estructurados.

La feature **no sustituye** el flujo actual de creacion. Solo acelera la captura inicial. La confirmacion final, el calculo de precios y la escritura en base de datos siguen pasando por la API existente y por las reglas de negocio actuales.

## Decision de arquitectura

Se descarta usar Hermes como via principal para este flujo.

Motivos:

- Crear un albaran desde voz es un flujo cerrado y repetitivo.
- Un agente externo con tool loop, memoria y despliegue separado introduce complejidad que no aporta valor proporcional aqui.
- La web ya dispone del formulario final y de la logica de confirmacion; lo razonable es pre-rellenarlo, no reemplazarlo.

Se adopta este enfoque:

1. El frontend captura voz con Web Speech API cuando el navegador lo soporte.
2. El frontend envia la transcripcion a un endpoint nuevo del backend.
3. El backend llama a Ollama para extraer un JSON estructurado.
4. El frontend adapta ese JSON al estado actual del formulario de albaranes.
5. El usuario revisa y confirma manualmente antes de crear el albaran.

## Alcance

Incluye:

- Captura de voz desde la pagina de albaranes en `web/src/pages/DeliveryNotesPage.tsx`
- Endpoint de parseo en `api/src/`
- Prompt cerrado para extraer datos de piezas
- Pre-relleno de cliente, fecha, notas e items en el formulario actual
- Manejo de errores y fallback cuando no haya soporte de voz o la extraccion falle

No incluye:

- Creacion automatica del albaran sin revision humana
- Escritura directa desde Hermes
- Cambios en la logica de precios
- Cambios en Prisma o en el esquema de base de datos
- Sustituir el flujo actual de creacion o edicion de albaranes

## Restricciones del sistema actual

Estas reglas ya existen y la feature debe respetarlas:

- La logica de precios vive solo en la API.
- El frontend no calcula el precio final de negocio; solo muestra previews como hasta ahora.
- La creacion real del albaran sigue pasando por `POST /api/delivery-notes`.
- El preview de precio sigue pasando por `POST /api/delivery-notes/calculate-price`.
- El backend actual protege `/api/*` con `authMiddleware`, salvo rutas montadas fuera de ese alcance.

## Ajustes respecto a la propuesta original

La idea original es valida, pero estos puntos se corrigen para que la spec encaje con el repo real:

- El monorepo usa `api/` y `web/`, no `packages/api/` ni `packages/web/`.
- El nuevo endpoint de voz **debe requerir autenticacion**, igual que el resto de la app interna.
- La configuracion de Ollama debe validarse en `api/src/config/env.ts`.
- El dominio actual usa estas texturas: `NORMAL | MATE | TEXTURADO | GOFRADO`.
- La salida del parser debe mapearse al contrato real de `DeliveryNoteItemDraft`.
- Web Speech API debe tratarse como mejora progresiva, no como dependencia universal.

## UX esperada

### Flujo principal

1. El usuario abre el composer de "Nuevo albaran".
2. Pulsa un boton de microfono.
3. La aplicacion escucha una unica intervencion corta.
4. Al terminar, muestra estado de "Procesando".
5. Si la extraccion sale bien:
   - intenta resolver el cliente por nombre contra la lista ya cargada
   - rellena fecha, notas y piezas
   - deja todo editable antes de guardar
6. Si la extraccion falla:
   - muestra error no bloqueante
   - no altera el flujo manual actual

### Criterios UX

- El boton de voz solo aparece habilitado cuando el navegador soporta Speech Recognition.
- Si no hay soporte, el usuario sigue pudiendo trabajar exactamente igual que hoy.
- No se crea ningun albaran automaticamente.
- El usuario siempre ve y controla lo que se va a guardar.

## Contrato backend

### Ruta

`POST /api/voice/parse-albaran`

### Autenticacion

Requiere la misma autenticacion de cookie/JWT que el resto de endpoints bajo `/api`.

### Request body

```json
{
  "transcript": "string"
}
```

### Response body

```json
{
  "customerName": "Cliente Ejemplo",
  "date": "2026-06-11",
  "notes": "repasar canton vivo",
  "items": [
    {
      "description": "barandilla",
      "color": "RAL 7016",
      "texture": "GOFRADO",
      "linearMeters": 12,
      "squareMeters": null,
      "thickness": null,
      "primer": false,
      "quantity": 1
    }
  ]
}
```

### Errores

- `400` si falta `transcript` o es vacio
- `422` si Ollama no devuelve un JSON interpretable o no se puede normalizar al contrato esperado
- `500` si hay error interno no controlado

Respuesta recomendada para `422`:

```json
{
  "error": "No se pudo interpretar el texto"
}
```

## Contrato interno de extraccion

El LLM no debe devolver el contrato final del dominio sin filtro. Debe devolver una estructura intermedia simple que luego el backend normaliza.

### Salida esperada del LLM

```json
{
  "customerName": "string o null",
  "date": "YYYY-MM-DD",
  "notes": "string o null",
  "items": [
    {
      "description": "string",
      "color": "string o null",
      "texture": "mate | texturado | gofrado | normal | null",
      "linearMeters": "number o null",
      "squareMeters": "number o null",
      "thickness": "number o null",
      "primer": "boolean",
      "quantity": "number"
    }
  ]
}
```

### Normalizacion backend obligatoria

El backend debe transformar esa salida a un shape compatible con el frontend y el dominio:

- `texture: "mate"` -> `MATE`
- `texture: "texturado"` -> `TEXTURADO`
- `texture: "gofrado"` -> `GOFRADO`
- `texture: "normal"` o `null` -> `NORMAL`
- `color: null` -> usar cadena vacia solo si el formulario lo exige; si no, mantener `null` hasta la adaptacion UI
- `quantity` por defecto `1`
- `primer` por defecto `false`
- items sin `description` valida deben descartarse
- si despues de normalizar no queda ningun item valido, responder `422`

## Prompt de sistema para Ollama

El prompt debe ser estricto y orientado a extraccion, no a conversacion.

```text
Eres un extractor de datos para un taller de pintura en polvo.
El usuario dicta en espanol el contenido de un albaran.
Devuelve UNICAMENTE un JSON valido, sin markdown ni explicaciones.

Estructura obligatoria:
{
  "customerName": "string o null",
  "date": "YYYY-MM-DD",
  "notes": "string o null",
  "items": [
    {
      "description": "string",
      "color": "string o null",
      "texture": "mate | texturado | gofrado | normal | null",
      "linearMeters": number o null,
      "squareMeters": number o null,
      "thickness": number o null,
      "primer": boolean,
      "quantity": number
    }
  ]
}

Reglas:
- Si el cliente no se menciona claramente, usa null.
- Si la fecha no se menciona, usa la fecha de hoy.
- Si un campo no se entiende, usa null.
- No inventes medidas ni colores.
- quantity es 1 si no se menciona.
- primer es false si no se menciona.
- No devuelvas texto adicional fuera del JSON.
```

## Diseno backend

### Ubicacion

Se implementara dentro de `api/src/` siguiendo el estilo actual:

- schema Zod para request y response
- controller dedicado
- servicio de infraestructura para Ollama
- router dedicado
- alta en `api/src/server.ts`

### Propuesta de archivos

- `api/src/schemas/voiceSchemas.ts`
- `api/src/controllers/VoiceController.ts`
- `api/src/infrastructure/services/OllamaVoiceAlbaranParser.ts`
- `api/src/routes/voice.routes.ts`

Si durante la implementacion compensa introducir un use case de aplicacion para mantener el patron actual, se acepta:

- `api/src/application/use-cases/parseVoiceAlbaran.ts`

### Dependencias

Se debe reutilizar `fetch` nativo de Node si el runtime actual lo soporta. No hace falta meter SDK pesado si una llamada HTTP simple cubre el caso.

### Variables de entorno

Variables nuevas:

- `VOICE_PARSER_PROVIDER`
- `VOICE_PARSER_BASE_URL`
- `VOICE_PARSER_MODEL`
- `VOICE_PARSER_API_KEY`
- `VOICE_PARSER_TIMEOUT_MS`

Requisitos:

- Deben declararse en `api/.env.example`
- Deben validarse en `api/src/config/env.ts`
- No deben loggearse nunca

## Diseno frontend

### Ubicacion

- Componente nuevo en `web/src/components/VoiceAlbaranButton.tsx`
- Integracion en `web/src/pages/DeliveryNotesPage.tsx`

### Props propuestas

```ts
interface ParsedVoiceAlbaranItem {
  description: string;
  color: string | null;
  texture: "NORMAL" | "MATE" | "TEXTURADO" | "GOFRADO";
  linearMeters: number | null;
  squareMeters: number | null;
  thickness: number | null;
  primer: boolean;
  quantity: number;
}

interface ParsedVoiceAlbaranData {
  customerName: string | null;
  date: string;
  notes: string | null;
  items: ParsedVoiceAlbaranItem[];
}

interface VoiceAlbaranButtonProps {
  onDataExtracted: (data: ParsedVoiceAlbaranData) => void;
  onError?: (message: string) => void;
}
```

### Comportamiento del componente

- Detecta `window.SpeechRecognition || window.webkitSpeechRecognition`
- Configura:
  - `lang = "es-ES"`
  - `continuous = false`
  - `interimResults = false`
- Muestra tres estados:
  - reposo
  - escuchando
  - procesando
- Envia el transcript a `POST /api/voice/parse-albaran`
- Si el backend responde bien, invoca `onDataExtracted`
- Si falla, invoca `onError` o muestra un mensaje controlado

### Integracion con el formulario actual

La pagina actual ya carga clientes y mantiene el estado del formulario. La integracion debe:

- usar la lista ya disponible en `customersQuery`
- intentar match exacto case-insensitive por nombre de cliente
- como fallback, intentar match por prefijo de palabra, igual que hace el buscador actual
- si no encuentra cliente:
  - no rellenar `customerId`
  - mantener `customerSearch` con el nombre extraido si aporta valor UX
  - mostrar aviso de que el cliente debe seleccionarse manualmente
- mapear items extraidos a `DeliveryNoteItemFormState`

### Reglas de mapeo UI

- `description` -> `description`
- `color` -> si falta, usar `RAL 7016` solo si se decide mantener el default actual del formulario; si no, dejarlo vacio y forzar revision
- `texture` -> `texture`
- `linearMeters` -> string formateada para el formulario
- `squareMeters` -> string formateada para el formulario
- `quantity` -> string
- `primer` -> `hasPrimer`
- `thickness != null` -> `hasThickness = true`
- `thickness == null` -> `hasThickness = false`
- `pricingMode` por defecto -> `DIMENSIONS`
- `saveAsSpecialPiece` -> `false`
- `customUnitPrice` -> `""`

## Decision importante sobre color por defecto

El formulario actual inicializa color en `RAL 7016`. Eso sirve para alta manual, pero en voz puede ocultar errores de extraccion.

Decision recomendada:

- Si el parser no detecta color, dejar aviso visible para que el usuario revise esa pieza.
- Solo usar el default visual del formulario si no rompe la claridad del dato faltante.

En otras palabras: no conviene que la voz "invente" un `RAL 7016` silenciosamente.

## Seguridad

- El endpoint de voz requiere auth normal.
- No se exponen stack traces al cliente.
- El transcript no debe loggearse completo en produccion si contiene informacion sensible del cliente.
- La configuracion de Ollama solo se lee desde `env.ts`.
- El backend debe limitar el prompt a extraccion estructurada; nada de ejecutar instrucciones del usuario.

## Observabilidad

Registrar de forma minima:

- inicio y fin de la peticion
- exito o fallo de parseo
- motivo resumido del fallo

No registrar:

- `VOICE_PARSER_PROVIDER`
- `VOICE_PARSER_BASE_URL`
- `VOICE_PARSER_MODEL`
- cookies
- respuesta cruda completa del proveedor si incluye payload sensible

## Testing minimo requerido

### API

- valida request vacia -> `400`
- respuesta correcta de Ollama -> `200`
- respuesta con JSON invalido -> `422`
- normalizacion de texturas y defaults
- descarte de items invalidos

### Web

- boton deshabilitado sin soporte Speech Recognition
- `onDataExtracted` se dispara con respuesta valida
- error de backend muestra feedback y no rompe el composer
- match de cliente exacto y fallback por prefijo
- pre-relleno correcto de items

## Criterios de aceptacion

- Desde la pantalla de albaranes se puede dictar un albaran corto en espanol.
- El sistema pre-rellena cliente, fecha, notas e items sin crear nada automaticamente.
- Si la extraccion falla, el usuario puede seguir con el flujo manual actual sin bloqueo.
- El precio sigue calculandose por la API actual.
- No se rompe el flujo existente de crear, editar, listar y revisar albaranes.

## Fuera de alcance por ahora

- dictado continuo largo
- correccion por voz dentro del mismo flujo
- multidioma
- adjuntar fotos o audio al albaran
- aprendizaje por cliente o memoria historica
- modo offline

## Resumen ejecutivo

La feature tiene sentido si se implementa como **asistente de captura**, no como automatismo completo ni como agente. La via correcta en este repo es:

- voz en frontend como mejora progresiva
- parseo estructurado en backend autenticado
- adaptacion al formulario actual
- confirmacion humana antes de cualquier escritura

Ese enfoque reduce friccion sin romper las reglas de negocio ni meter complejidad innecesaria.
