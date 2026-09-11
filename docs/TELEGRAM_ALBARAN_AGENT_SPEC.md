# Agente de albaranes por Telegram

**Estado:** implementado en staging y producción

**Última actualización:** 2026-09-11

**Referencia principal:** comportamiento vigente del agente de Telegram.

## 1. Objetivo

Permitir que un operario prepare albaranes mediante texto o notas de voz en
Telegram, revise una propuesta calculada por Epoxiron y confirme explícitamente
su creación.

El agente reduce la fricción de captura, pero no sustituye las reglas de negocio:

- la API identifica clientes y calcula precios;
- el agente no escribe directamente en PostgreSQL;
- una nota de voz nunca crea un albarán automáticamente;
- solo una confirmación exacta "SI" sobre una propuesta vigente crea el albarán;
- el resultado se crea siempre en estado "DRAFT".

## 2. Alcance

Incluye:

- recepción de texto y audio mediante Telegram;
- transcripción de notas de voz;
- extracción estructurada de cliente y piezas;
- conversación en varios mensajes y correcciones del borrador;
- validación de campos obligatorios;
- cálculo de precios mediante la API;
- propuesta previa, confirmación y cancelación;
- protección contra mensajes duplicados;
- despliegues separados para staging y producción.

No incluye:

- crear albaranes sin confirmación;
- aceptar precios dictados por el usuario;
- publicar albaranes directamente;
- modificar facturas;
- sustituir el formulario web;
- sustituir ni detener Hermes.

## 3. Canales

| Entorno | Bot | Propósito | Escrituras |
| --- | --- | --- | --- |
| Staging | @epoxydev_bot | Pruebas y validación | Configurables |
| Producción | @AgenteAlbaranesEpoxironBot | Uso real | Con confirmación |

Los bots usan tokens distintos y árboles de despliegue independientes.

## 4. Arquitectura

    Usuario de Telegram
            |
            v
    Telegram Bot API (long polling)
            |
            v
    TelegramDeliveryNoteBot
            |
            +--> Transcriptor de voz (Google Chirp 3)
            |
            v
    TelegramDeliveryNoteAssistant
            |
            +--> Parser estructurado (Ollama / gpt-oss:120b)
            +--> Repositorio de clientes
            +--> Caso de uso de cálculo de precios
            +--> Caso de uso de creación de albaranes
            |
            v
    API Epoxiron --> Prisma --> PostgreSQL

Responsabilidades:

- TelegramDeliveryNoteBot obtiene actualizaciones, autoriza usuarios, descarga
  audio y envía respuestas.
- TelegramDeliveryNoteAssistant mantiene el estado conversacional y aplica las
  reglas de confirmación.
- ParseVoiceAlbaranUseCase transforma el texto en cliente y líneas normalizadas.
- CalculatePriceUseCase es la única fuente del precio.
- CreateDeliveryNoteUseCase realiza la creación final.
- PrismaTelegramDeliveryNoteSessionRepository persiste la conversación y
  controla la idempotencia.

## 5. Comandos y manual

El bot muestra una guía breve con "/start" y "/help".

| Entrada | Resultado |
| --- | --- |
| /start | Muestra bienvenida y manual. No crea ni modifica un albarán. |
| /help | Vuelve a mostrar el manual. |
| /new | Descarta el borrador o propuesta actual y empieza una sesión nueva. |
| YA ESTÁ | Valida el borrador y genera una propuesta. |
| SI | Confirma una propuesta vigente y crea un albarán DRAFT. |
| NO | Cancela la propuesta y el borrador. |

También se reconocen expresiones naturales equivalentes a empezar, terminar o
cancelar. La creación exige que el mensaje normalizado sea exactamente "SI".

Ejemplo mínimo:

    /new
    cliente Ditrametal, dos chapas de 100 x 50 cm RAL 9005
    YA ESTÁ
    SI

## 6. Flujo conversacional

1. El usuario envía "/new".
2. Dicta o escribe cliente y piezas en uno o varios mensajes.
3. El agente acumula las líneas y permite correcciones.
4. El usuario envía "YA ESTÁ".
5. La API valida cliente, cantidades, colores y precios.
6. El agente devuelve una propuesta completa con total.
7. El usuario revisa la propuesta:
   - "SI": crea un albarán DRAFT;
   - "NO": cancela todo;
   - "/new": descarta y empieza de nuevo;
   - cualquier otro mensaje no crea nada.

Una propuesta caduca después del tiempo configurado. Una confirmación repetida
con el mismo update de Telegram no duplica el albarán.

## 7. Estados de sesión

| Estado | Significado | Transiciones principales |
| --- | --- | --- |
| COLLECTING | Se reúnen cliente y piezas. | YA ESTÁ → PROPOSAL_READY |
| PROPOSAL_READY | Existe una propuesta temporal. | SI → CREATING; NO o /new → COLLECTING |
| CREATING | La propuesta fue reclamada atómicamente. | éxito → CREATED; fallo seguro → BLOCKED |
| CREATED | El albarán ya fue creado. | /new → COLLECTING |
| BLOCKED | La sesión no puede continuar de forma segura. | /new → COLLECTING |

La sesión persiste chat, usuario, último update, estado, borrador, propuesta,
caducidad e identificador del albarán creado.

## 8. Reglas de interpretación

### 8.1 Clientes

- El cliente debe corresponder a un cliente existente.
- Se prioriza la coincidencia exacta normalizada.
- Una corrección de cliente conserva las piezas ya dictadas.
- Si el nombre no identifica un único cliente, se solicita de nuevo sin borrar
  las líneas.
- No se usa una coincidencia difusa arriesgada para crear.

### 8.2 Piezas y cantidades

- La cantidad debe ser un entero mayor que cero.
- Una cantidad negativa o cero se rechaza.
- Pueden añadirse varias piezas juntas o en mensajes sucesivos.
- Se puede corregir la cantidad de una línea existente.
- Se puede eliminar una línea, por ejemplo: "Quita los perfiles".

### 8.3 Medidas

- Se normalizan medidas en milímetros, centímetros y metros.
- Las descripciones dimensionales se expresan consistentemente en centímetros
  cuando procede.
- "1000 x 500 mm" se convierte en "100X50".
- "1 m x 40 cm" se convierte en "100X40".
- Las medidas de piezas distintas en un mismo mensaje se conservan por separado.

### 8.4 Colores y acabados

- Se aceptan códigos RAL explícitos.
- "negro" se normaliza a "RAL 9005".
- "blanco" se normaliza a "RAL 9010".
- Un color ambiguo como "rojo" no inventa un RAL: queda pendiente.
- Los acabados válidos son NORMAL, MATE, TEXTURADO y GOFRADO.
- Una frase corta como "9005 texturado" corrige la línea activa en vez de crear
  una pieza nueva.

### 8.5 Campos incompletos

Antes de preparar la propuesta, el agente informa de los datos ausentes. El
usuario puede completarlos con una frase como "El color es 9005". La corrección
se aplica a la línea incompleta correspondiente.

## 9. Precios

La lógica de precios vive exclusivamente en la API.

- Toda entrada del agente usa pricingMode "DIMENSIONS".
- customUnitPrice se fuerza a null.
- saveAsSpecialPiece se fuerza a false.
- Un precio dictado, por ejemplo "a 99 euros", se ignora.
- El precio se calcula para el cliente resuelto.
- Una propuesta antigua se sanea y recalcula antes de confirmar.
- Si una propuesta heredada contiene un precio manual distinto, se bloquea.

El agente solo muestra precios devueltos por la API.

## 10. Confirmación, cancelación e idempotencia

- "SI" solo funciona con una propuesta vigente y no caducada.
- Cualquier otro mensaje no crea el albarán.
- "NO", "cancela" y expresiones equivalentes cancelan propuesta y borrador.
- La propuesta se reclama atómicamente antes de crear.
- lastUpdateId evita procesar dos veces la misma actualización.
- El estado CREATING impide dos creaciones concurrentes.
- El cliente se comprueba otra vez inmediatamente antes de crear.
- El resultado se guarda como DRAFT.

## 11. Voz

Producción utiliza:

- Google Cloud Speech-to-Text;
- modelo Chirp 3;
- idioma es-ES;
- ubicación eu;
- límite de audio configurable;
- un reintento cuando la transcripción agota el tiempo.

El texto reconocido puede mostrarse antes de la respuesta. La transcripción solo
alimenta el borrador y nunca equivale a una confirmación automática.

El parser estructurado de producción usa Ollama con gpt-oss:120b.

## 12. Seguridad

- El bot está desactivado por defecto en la configuración general.
- Debe declararse explícitamente el entorno staging o production.
- Solo atiende los identificadores autorizados.
- El token se monta desde un archivo secreto y no se guarda en el repositorio.
- Las credenciales de Google se montan en modo de solo lectura.
- Los secretos del servidor deben tener permisos 600.
- Los logs no deben mostrar secretos ni payloads sensibles completos.
- Las escrituras se controlan con EPOXIRON_TELEGRAM_WRITES_ENABLED.
- El agente usa casos de uso de la API; no ejecuta SQL ni Prisma directamente.

## 13. Configuración

Variables principales:

    EPOXIRON_TELEGRAM_BOT_ENABLED=true
    EPOXIRON_TELEGRAM_WRITES_ENABLED=false
    EPOXIRON_TELEGRAM_BOT_ENVIRONMENT=staging
    EPOXIRON_TELEGRAM_ALLOWED_USER_IDS=<ids-autorizados>
    EPOXIRON_TELEGRAM_POLL_TIMEOUT_SECONDS=25
    EPOXIRON_TELEGRAM_PROPOSAL_TTL_MINUTES=30
    EPOXIRON_TELEGRAM_MAX_AUDIO_BYTES=20971520
    EPOXIRON_TELEGRAM_ECHO_TRANSCRIPTS=true

El token no debe incluirse en el archivo .env versionado; se carga desde el
archivo secreto del entorno.

Variables de voz:

    VOICE_PARSER_PROVIDER=ollama
    VOICE_PARSER_BASE_URL=https://ollama.com
    VOICE_PARSER_MODEL=gpt-oss:120b
    VOICE_TRANSCRIBER_PROVIDER=google-chirp
    VOICE_TRANSCRIBER_MODEL=chirp_3
    VOICE_TRANSCRIBER_LANGUAGE=es-ES
    GOOGLE_CLOUD_PROJECT=<proyecto>
    GOOGLE_CLOUD_LOCATION=eu
    GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/google-cloud-credentials.json

## 14. Despliegue

### 14.1 Staging

- árbol, base de datos y red aislados;
- no incluye Hermes;
- permite desactivar escrituras para pruebas;
- configuración en deploy/telegram-staging.

### 14.2 Producción

- servicio Docker independiente "epoxiron-albaranes";
- código operativo bajo /opt/epoxiron-albaranes/app;
- secretos bajo /opt/epoxiron-albaranes/secrets;
- puerto interno 3102;
- comparte la red Docker de Epoxiron;
- usa la base de producción mediante la configuración de la API;
- no publica un puerto adicional al exterior;
- no modifica ni reinicia Hermes;
- configuración en deploy/telegram-production.

El arranque ejecuta "prisma migrate deploy" y después inicia la API interna.

## 15. Operación

Estado y registros:

    cd /opt/epoxiron-albaranes/app/deploy/telegram-production
    docker compose -p epoxiron-albaranes ps
    docker compose -p epoxiron-albaranes logs --tail 100 albaranes

Reconstrucción del agente:

    docker compose -p epoxiron-albaranes up -d --build albaranes

Comprobación de salud:

    docker exec epoxiron-albaranes-albaranes-1 \
      wget -qO- http://127.0.0.1:3102/health

Resultado esperado: {"status":"ok"}.

### Desactivación y rollback

Para detener únicamente el agente:

    cd /opt/epoxiron-albaranes/app/deploy/telegram-production
    docker compose -p epoxiron-albaranes stop albaranes

Para mantener el bot sin escrituras se configura:

    EPOXIRON_TELEGRAM_WRITES_ENABLED=false

Después se recrea únicamente "albaranes". Hermes y la API web no se reinician.

## 16. Pruebas críticas

La cobertura debe verificar:

- "/start" y "/help" muestran el manual sin crear ni modificar albaranes;
- una propuesta no escribe antes de "SI";
- confirmación exacta y creación única en DRAFT;
- un segundo "SI" no duplica;
- precio dictado ignorado;
- cantidades negativas rechazadas;
- correcciones de cantidad, color, acabado y cliente;
- cliente desconocido conservando líneas;
- eliminación de líneas y cancelación con "NO";
- completar colores ausentes;
- normalización de negro, blanco, RAL y medidas;
- rechazo de propuestas caducadas;
- bloqueo de precios manuales heredados.

Antes de desplegar:

1. ejecutar las pruebas del asistente;
2. ejecutar la comprobación TypeScript;
3. construir la imagen Docker;
4. comprobar /health y que no hay reinicios;
5. verificar que Telegram no acumula mensajes pendientes;
6. comprobar que Hermes sigue activo.

## 17. Criterios de aceptación

- El usuario autorizado puede iniciar el flujo desde Telegram.
- El bot responde a texto y notas de voz.
- El borrador admite varios mensajes y correcciones.
- No se inventan clientes, colores, cantidades ni precios.
- La propuesta muestra cliente, fecha, líneas, precios y total.
- Nada se crea sin "SI".
- La confirmación crea exactamente un albarán DRAFT.
- Una cancelación no deja una propuesta confirmable.
- Staging y producción usan bots y despliegues separados.
- Hermes continúa funcionando en paralelo.

## 18. Relación con otras funcionalidades

- docs/VOICE_ALBARAN_SPEC.md sigue siendo la referencia de voz en la web.
- docs/TELEGRAM_STAGING_ASSISTANT.md conserva el contexto histórico de staging.
- Este documento es la referencia vigente del agente conversacional de Telegram.
- Hermes mantiene su superficie propia y no participa en el flujo interno.

## 19. Archivos principales

- api/src/application/use-cases/telegramDeliveryNoteAssistant.ts
- api/src/infrastructure/services/TelegramDeliveryNoteBot.ts
- api/src/infrastructure/services/TelegramBotClient.ts
- api/src/infrastructure/services/GoogleChirpVoiceTranscriber.ts
- api/src/infrastructure/repositories/PrismaTelegramDeliveryNoteSessionRepository.ts
- api/src/domain/repositories/TelegramDeliveryNoteSessionRepository.ts
- api/src/application/use-cases/parseVoiceAlbaran.ts
- api/src/schemas/voiceSchemas.ts
- api/src/config/env.ts
- api/prisma/migrations/20260909120000_add_telegram_delivery_note_sessions
- deploy/telegram-staging
- deploy/telegram-production
