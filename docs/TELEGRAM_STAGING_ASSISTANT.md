# Asistente de albaranes por Telegram — staging

> Documento histórico del entorno de pruebas. La especificación funcional y
> operativa vigente está en docs/TELEGRAM_ALBARAN_AGENT_SPEC.md.

Este bot sustituye a Hermes únicamente para una prueba controlada. No modifica ni detiene el contenedor de Hermes de producción.

## Barreras de seguridad

- Está desactivado por defecto.
- Solo arranca si `EPOXIRON_TELEGRAM_BOT_ENVIRONMENT=staging`.
- Requiere un token de bot distinto del usado en producción.
- Solo atiende los identificadores incluidos en `EPOXIRON_TELEGRAM_ALLOWED_USER_IDS`.
- `EPOXIRON_TELEGRAM_WRITES_ENABLED=false` valida toda la conversación y la confirmación, pero no crea albaranes.
- Cuando las escrituras se habilitan, solo la confirmación exacta `SI` sobre una propuesta vigente crea un albarán en estado `DRAFT`.
- El precio se calcula siempre en la API y la sesión se reclama de forma atómica antes de crear, evitando reintentos duplicados.

## Configuración inicial segura

Aplicar la migración únicamente en la base de datos de staging y configurar:

```env
EPOXIRON_TELEGRAM_BOT_ENABLED=true
EPOXIRON_TELEGRAM_WRITES_ENABLED=false
EPOXIRON_TELEGRAM_BOT_ENVIRONMENT=staging
EPOXIRON_TELEGRAM_BOT_TOKEN=<token-del-segundo-bot>
EPOXIRON_TELEGRAM_ALLOWED_USER_IDS=<id-numerico-autorizado>
```

El resto de variables de voz reutiliza la configuración existente de la API de staging.

## Prueba

1. Enviar `/new`.
2. Dictar cliente y piezas en uno o varios mensajes.
3. Enviar `YA ESTÁ`.
4. Revisar cliente, líneas, medidas y precios devueltos por la API.
5. Enviar `SI`. Con escrituras desactivadas debe responder que es una simulación y no debe aparecer ningún albarán.
6. Tras validar varios casos, cambiar solo en staging `EPOXIRON_TELEGRAM_WRITES_ENABLED=true`, reiniciar la API y repetir. El resultado debe ser un único albarán `DRAFT`.

Para volver atrás basta con poner `EPOXIRON_TELEGRAM_BOT_ENABLED=false` y reiniciar la API de staging.

## Arranque del stack aislado

El compose de `deploy/telegram-staging` usa su propio volumen PostgreSQL, su propia red y el puerto local `3101`. No incluye Hermes.

```bash
cd deploy/telegram-staging
cp .env.example .env
# completar el token, el usuario permitido y las claves de voz
docker compose up -d --build
docker compose logs -f api
```

La base empieza vacía. Antes de probar clientes reales hay que cargar en esta base de staging una copia controlada o datos de prueba; no se conecta a la base de producción.
