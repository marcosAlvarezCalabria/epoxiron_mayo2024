# Incidente: albarán creado con una fecha incorrecta

Fecha del incidente: 2026-11-10

## Síntoma

El bot de Telegram confirmó la creación de un albarán de prueba para DITRAMETAL, pero el albarán no aparecía en la vista del día actual de la aplicación.

## Diagnóstico

El albarán sí se creó en la base de datos:

- Número: `ALB-2023-0001`
- ID: `2a41b822-6018-43ec-ab4b-41ad827e092f`
- Fecha guardada: `2023-10-25`
- Fecha real de creación: `2026-11-10`
- Estado: `DRAFT`

La propuesta de Telegram conservó el ID del albarán creado. La aplicación filtraba por las fechas de 2026-11-09 a 2026-11-10, por lo que el registro de 2023 quedaba fuera de la vista.

## Causa raíz

El prompt indicaba que debía usarse la fecha de hoy cuando el usuario no mencionara una fecha, pero no proporcionaba al modelo la fecha real. El modelo generó una fecha antigua. El caso de uso aceptó esa fecha sin aplicar una regla determinista.

Además, el analizador de texto todavía estaba configurado para Ollama. Ese proveedor devolvía HTTP 402 porque la cuenta ya no tenía créditos. Se migró el analizador y el lector de imágenes a Gemini para mantener ambos flujos bajo la cuenta de la empresa.

## Corrección

- Se proporciona al analizador la fecha actual del taller en la zona horaria `Europe/Madrid`.
- Si el mensaje no contiene una referencia de fecha, o dice `hoy`, el caso de uso asigna de forma determinista la fecha actual.
- Una fecha explícita del usuario se conserva.
- El analizador de texto usa el endpoint compatible con OpenAI de Gemini.
- El analizador de texto y el lector de imágenes usan `gemini-3.5-flash-lite`.
- Las claves se mantienen únicamente en el `.env` de producción y no se versionan.

## Verificación

- Pruebas del caso de uso: 10 de 10 correctas.
- `pnpm lint`: correcto.
- `pnpm build`: correcto.
- Prueba del contenedor nuevo, sin escritura en base de datos: el mensaje de DITRAMETAL produjo la fecha `2026-11-10`, dos piezas de 1000 x 500 mm y RAL 9005.
- Migraciones Prisma: 12 aplicadas, ninguna pendiente.
- Lectura de base de datos desde el contenedor: correcta.
- Contenedor tras el despliegue: en ejecución y sin reinicios.

La suite completa conserva fallos previos de la rama recuperada, relacionados con expectativas antiguas de medidas, variables de entorno y pruebas de red. No afectan a las pruebas específicas de esta corrección, pero deben resolverse por separado.

## Despliegue y recuperación

- Imagen desplegada: `sha256:9d1c7248e10b22f20c44218117faadd6595a62620443783bb68bb8ec05e2d27a`
- Imagen anterior etiquetada para recuperación: `epoxiron-albaranes-albaranes:rollback-date-20261110T201721Z`
- Copia del código anterior: `/opt/epoxiron-albaranes/backups/date-fix-20261110T201721Z`
- Copia del `.env` anterior: `/opt/epoxiron-albaranes/app/deploy/telegram-production/.env.before-gemini-20261110T200312Z`
- Copia del Compose anterior: `/opt/epoxiron-albaranes/app/deploy/telegram-production/docker-compose.yml.before-gemini-model-20261110T200424Z`

Para recuperar la versión anterior, restaurar el código/configuración desde esas copias, volver a etiquetar la imagen de recuperación como imagen activa y recrear únicamente el servicio `albaranes`.

## Estado del dato de prueba

El registro `ALB-2023-0001` no se eliminó como parte del despliegue. Tras la confirmación explícita del usuario, se guardó una copia privada en el VPS y se ejecutó una transacción limitada al ID `2a41b822-6018-43ec-ab4b-41ad827e092f`:

- El albarán y su única línea se eliminaron.
- Se verificó que no existía ningún vínculo con facturas.
- La sesión de Telegram `29d5d4e9-4e46-407f-a948-4d15a14ea1fb` se reinició a `COLLECTING` con el borrador vacío.
- El servicio permaneció en ejecución y sin reinicios.
- Copia recuperable: `/opt/epoxiron-albaranes/backups/deleted-ALB-2023-0001-20261110T202716Z.json`.
