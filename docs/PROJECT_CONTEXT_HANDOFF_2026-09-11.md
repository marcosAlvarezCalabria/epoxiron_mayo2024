# Contexto de traspaso del proyecto Epoxiron

**Fecha:** 2026-09-11  
**Rama activa:** `codex/hermes-telegram-stt`  
**Último commit desplegado:** `b82ece6 feat: select special pieces from telegram buttons`

Este documento permite continuar el trabajo en otro chat sin depender del
historial de la conversación actual. La especificación funcional completa del
agente está en `docs/TELEGRAM_ALBARAN_AGENT_SPEC.md`.

## 1. Resultado actual

Se creó un agente de albaranes independiente de Hermes y conectado a Telegram.
Está desplegado y operativo tanto en staging como en producción.

- Producción: `@AgenteAlbaranesEpoxironBot`.
- Staging: `@epoxydev_bot`.
- Hermes continúa funcionando en paralelo y no fue sustituido ni detenido.
- Producción y staging usan el mismo código, pero tienen bots, secretos, puertos
  y bases de datos separados.
- Marcos y Rubén están autorizados en ambos bots.

## 2. Comportamiento del agente

El usuario puede dictar o escribir cliente y piezas en varios mensajes. El
agente conserva un borrador conversacional y permite corregir cantidad, color,
acabado y cliente, además de eliminar líneas.

Comandos principales:

- `/start` y `/help`: manual breve.
- `/new`: descarta el borrador o propuesta y comienza de nuevo.
- `/especiales Cliente`: muestra las piezas especiales del cliente con precio.
- `YA ESTÁ`: valida y prepara la propuesta.
- `SI`: confirma una propuesta vigente y crea el albarán en `DRAFT`.
- `NO`: cancela propuesta y borrador.

Nada se crea antes de una confirmación exacta `SI`. Las notas de voz solo
alimentan el borrador. Los precios dictados se ignoran y la API es la única
fuente de precios.

## 3. Piezas especiales

Las piezas especiales pertenecen a un cliente y se leen en tiempo real desde su
catálogo en Epoxiron. Telegram no crea ni modifica dicho catálogo.

Flujo disponible:

1. Se selecciona o dicta el cliente del albarán.
2. Se envía `/especiales` o `/especiales Nombre del cliente`.
3. Telegram muestra hasta 20 piezas por página, con nombre y precio, como
   botones pulsables.
4. Al pulsar una pieza se valida nuevamente que exista y pertenezca al cliente.
5. El bot pregunta la cantidad y solo después añade esa cantidad al borrador.
6. En `YA ESTÁ`, la propuesta utiliza el precio fijo vigente de esa pieza.

También se admite `/especiales Nombre pagina N`. Un botón antiguo no permite
usar una pieza eliminada ni una pieza de otro cliente. Si hay una propuesta
pendiente, primero debe cancelarse antes de añadir otra pieza.

## 4. Precios y medidas

- La API aplica, por orden, precio de pieza especial, precio dimensional y
  tarifa mínima.
- `pricingMode` se fuerza a `DIMENSIONS`.
- `customUnitPrice` y `saveAsSpecialPiece` se fuerzan a valores seguros.
- Milímetros, centímetros y metros se normalizan.
- Una pareja sin unidad como `500X500` se interpreta como milímetros.
- El área se deriva como ancho por alto dividido entre 1.000.000.
- Para DITRAMETAL, una pieza normal de 500 por 500 mm se comprobó con un precio
  de 2,38 euros, no con la tarifa mínima de 0,65 euros.

## 5. Seguridad y autorización

- El bot usa una lista de IDs de Telegram autorizados.
- Los IDs de Marcos y Rubén están cargados en los `.env` privados de staging y
  producción; sus valores no están versionados ni deben mostrarse.
- Rubén se identificó mediante su sesión privada ya registrada en Hermes. La
  configuración `telegram.allowed_chats` de Hermes estaba vacía; no se usaron
  teléfonos ni se expusieron datos personales.
- Los tokens de Telegram y las credenciales de Google no están en Git.
- Los archivos secretos se montan en modo de solo lectura y tienen permisos
  restrictivos.

## 6. Despliegues activos

### Producción

- Árbol: `/opt/epoxiron-albaranes/app`.
- Compose: `/opt/epoxiron-albaranes/app/deploy/telegram-production`.
- Proyecto Compose: `epoxiron-albaranes`.
- Servicio: `albaranes`.
- Contenedor: `epoxiron-albaranes-albaranes-1`.
- Puerto interno: `3102`.
- Configuración privada:
  `/opt/epoxiron-albaranes/app/deploy/telegram-production/.env`.
- Token: `/opt/epoxiron-albaranes/secrets/telegram-bot-token`.
- Google:
  `/opt/epoxiron-albaranes/secrets/google-cloud-credentials.json`.

### Staging

- Árbol: `/opt/epoxiron-telegram-staging`.
- Compose: `/opt/epoxiron-telegram-staging/deploy/telegram-staging`.
- Proyecto Compose: `epoxiron-telegram-staging`.
- Servicio: `api`.
- Contenedor: `epoxiron-telegram-staging-api-1`.
- Puerto local del servidor: `3101`.
- Base aislada: `epoxiron_telegram_staging` en el servicio `db`.
- Configuración privada:
  `/opt/epoxiron-telegram-staging/deploy/telegram-staging/.env`.
- Token: `/opt/epoxiron-telegram-staging/secrets/telegram-bot-token`.
- Google:
  `/opt/epoxiron-telegram-staging/secrets/google-cloud-credentials.json`.

Ambos servicios estaban `running`, con cero reinicios y `/health` correcto tras
el último cambio operativo.

## 7. Voz y modelos

- Transcripción: Google Cloud Speech-to-Text, Chirp 3, `es-ES`, ubicación `eu`.
- Parser estructurado de producción: Ollama con `gpt-oss:120b`.
- Existe un reintento controlado cuando la transcripción agota el tiempo.

## 8. Git y validaciones

Commits recientes del agente:

- `cae25f2 feat: add telegram delivery note agent`.
- `4443014 fix: price dimensions and resolve special pieces`.
- `4972e65 feat: list customer special pieces in telegram`.
- `b82ece6 feat: select special pieces from telegram buttons`.

Todos están subidos a `origin/codex/hermes-telegram-stt`; la rama todavía no se
ha fusionado con `main`.

Últimas validaciones del flujo:

- 19 pruebas enfocadas del asistente superadas.
- TypeScript `strict` y compilación del API correctos.
- Imágenes Docker construidas correctamente en ambos entornos.
- Salud comprobada después del despliegue.

## 9. Estado del árbol local

Hay cambios y archivos no rastreados de trabajo paralelo de Hermes. No forman
parte de los commits del agente de albaranes y deben conservarse. Antes de un
nuevo commit hay que añadir archivos explícitos y evitar `git add .`.

Las rutas afectadas incluyen principalmente `deploy/hermes/`, documentación de
Hermes y `outputs/`.

## 10. Prueba recomendada al continuar

En producción, con una sesión limpia:

1. Enviar `/new`.
2. Dictar `cliente Ditrametal` junto con una pieza normal, o comenzar indicando
   directamente el cliente.
3. Enviar `/especiales`.
4. Comprobar que aparecen botones únicamente de DITRAMETAL.
5. Pulsar una pieza, responder la cantidad solicitada y comprobar que se añade
   esa cantidad.
6. Corregir su cantidad posteriormente si procede.
7. Enviar `YA ESTÁ` y revisar precio, cliente y total.
8. Usar `NO` si la prueba no debe crear nada. Usar `SI` solo cuando se quiera
   crear realmente un albarán `DRAFT`.

Rubén debe poder iniciar el bot de producción enviando `/start` sin recibir el
mensaje de usuario no autorizado.

### Incidencia posterior: persistencia de metros cuadrados

Se detectó que medidas como `2040 x 950`, `1900 x 950` y `2100 x 1000` se
normalizaban correctamente, pero `widthMm` y `heightMm` se perdían al recuperar
el borrador desde PostgreSQL. El esquema de sesión se corrigió para conservar
ambos campos tanto en borradores como en propuestas. Sin ellos, la API aplicaba
erróneamente la tarifa mínima en lugar del precio por superficie.

Después se cubrió un segundo caso: el parser podía devolver `VALLA` con los m²
ya calculados, sin repetir `2040X950` en la descripción. Las dimensiones del
texto se asocian ahora a la línea cuyo área coincide, se conservan para el
cálculo y el albarán muestra `2040X950MM` en vez de `1,94M2`.

## 11. Archivos clave

- `docs/TELEGRAM_ALBARAN_AGENT_SPEC.md`.
- `api/src/application/use-cases/telegramDeliveryNoteAssistant.ts`.
- `api/src/infrastructure/services/TelegramDeliveryNoteBot.ts`.
- `api/src/infrastructure/services/TelegramBotClient.ts`.
- `api/src/application/use-cases/deliveryNotes.ts`.
- `api/src/application/use-cases/parseVoiceAlbaran.ts`.
- `api/src/infrastructure/repositories/PrismaTelegramDeliveryNoteSessionRepository.ts`.
- `deploy/telegram-production/`.
- `deploy/telegram-staging/`.

## 12. Regla para el siguiente chat

Empezar leyendo este documento y
`docs/TELEGRAM_ALBARAN_AGENT_SPEC.md`. Preservar los cambios paralelos de Hermes,
no revelar secretos y mantener la creación de albaranes condicionada a una
confirmación explícita.
