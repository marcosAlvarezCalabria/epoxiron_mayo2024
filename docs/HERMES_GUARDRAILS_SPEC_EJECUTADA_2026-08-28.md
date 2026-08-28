# Especificacion ejecutada: guardrails de Hermes para albaranes

Fecha de ejecucion: 2026-08-28

Estado: ejecutada en produccion y validada mediante pruebas controladas

## Objetivo

Garantizar que Hermes no pueda crear ni modificar albaranes sin completar este
flujo:

1. Consultar los datos mediante la API restringida.
2. Calcular cada linea en la API.
3. Mostrar una propuesta completa.
4. Esperar una confirmacion explicita en un mensaje posterior.
5. Solicitar una aprobacion independiente del sistema.
6. Ejecutar una unica escritura para el albaran completo.
7. Verificar el resultado mediante una lectura.

## Incidente que origino el trabajo

La version anterior de Hermes podia utilizar rutas generales de la API y crear un
albaran sin aplicar de forma estable los dos niveles de confirmacion. El caso usado
como evidencia fue `ALB-2026-0172`, creado para DITRAMETAL con una linea de
`SOPORTE ORO` por 0,65 EUR.

Tambien se observaron estos comportamientos:

- alternancia entre `/api/hermes-tools/*` y rutas generales `/api/*`;
- tanteo de endpoints y formatos de cuerpo;
- omision de campos obligatorios como `color`;
- propuesta innecesaria de registrar piezas especiales;
- dependencia excesiva de instrucciones consultivas de la skill.

## Cambios ejecutados

### Actualizacion de Hermes

- Version anterior: Hermes Agent v0.15.1.
- Version instalada: Hermes Agent v0.20.6.
- Imagen: `nousresearch/hermes-agent:v2026.8.27`.
- Comando: `gateway run`.
- Datos persistentes: `/root/.hermes:/opt/data`.
- Contenedor: `hermes-gateway`.

El modelo predeterminado se cambio a:

```yaml
model:
  default: kimi-k3
  provider: ollama-cloud
```

### Aprobacion obligatoria de escrituras

Se instalo y habilito el plugin `epoxiron-write-approval`. Su hook
`pre_tool_call` detecta llamadas de escritura sobre albaranes en la superficie
restringida y devuelve una accion `approve` antes de ejecutar la llamada.

La aprobacion corresponde a la escritura completa del albaran, no a cada linea.

### Bloqueo de rutas generales

La configuracion activa contiene:

```yaml
approvals:
  deny:
    - '*api/delivery-notes*'
```

Esta regla impide que Hermes use la ruta general de albaranes incluso cuando se
habilita `--yolo`, `/yolo` o se desactivan las aprobaciones normales.

Durante una prueba se intento ejecutar
`/api/delivery-notes/calculate-price`. Hermes devolvio `status: blocked` y no
envio la solicitud a la API.

### Skill Epoxiron v3

La fuente canonica vive en:

- `deploy/hermes/skills/epoxiron/SKILL.md`
- `deploy/hermes/skills/epoxiron/references/api.md`

La version desplegada esta en `/root/.hermes/skills/epoxiron`.

La skill v3 establece:

- uso exclusivo de `/api/hermes-tools/*`;
- endpoint de calculo exacto `/api/hermes-tools/calculate-price`;
- cuerpo superior formado por `customerId` y un unico objeto `item`;
- prohibicion de `clientId`, `lines` y arrays en `item`;
- obligatoriedad de `description`, `color`, `pricingMode` y `quantity`;
- tratamiento explicito de `precio minimo` desde `minimumRate` obtenido de la API;
- una sola llamada de calculo por linea;
- prohibicion de probar variantes, bucles o endpoints alternativos;
- una linea no necesita estar registrada como pieza especial;
- uso del fichero protegido `/opt/data/secrets/epoxiron.curl.conf`;
- propuesta, confirmacion posterior, aprobacion y verificacion obligatorias.

El paquete desplegado fue `epoxiron-skill-v3.tar.gz`, con SHA-256:

```text
df1d4d0d32bde74d77b2437b5abf527543d1abd8f0b8fc38797ecb006ede8200
```

## Evidencias de validacion

Se probaron tres creaciones consecutivas con `kimi-k3`:

| Albaran | Cantidad | Precio unitario | Total | Resultado |
| --- | ---: | ---: | ---: | --- |
| ALB-2026-0175 | 1 | 0,65 EUR | 0,65 EUR | Correcto |
| ALB-2026-0176 | 2 | 0,65 EUR | 1,30 EUR | Correcto |
| ALB-2026-0177 | 3 | 0,65 EUR | 1,95 EUR | Correcto |

En los tres casos se comprobo:

- propuesta anterior a la escritura;
- confirmacion explicita en un mensaje posterior;
- aprobacion independiente `Approved once`;
- una unica llamada de creacion para el albaran completo;
- escritura mediante `POST /api/hermes-tools/delivery-notes`;
- estado inicial `DRAFT`;
- verificacion posterior mediante lectura.

El calculo de tres unidades devolvio desde la API:

```json
{"pricing":{"unitPrice":0.65,"totalPrice":1.95}}
```

## Recuperacion disponible

- Compose anterior:
  `/opt/epoxiron/deploy/docker-compose.vps.yml.before-hermes-v0206-20260828`
- Datos anteriores:
  `/root/.hermes-before-v0206-20260828`
- Contenedor anterior:
  `hermes-gateway-rollback-20260828`
- Imagen anterior:
  `epoxiron-hermes:rollback-20260828`
- Skill anterior al intercambio v3:
  `/root/.hermes/backups/epoxiron-active-before-v3-swap-20260828`

## Trabajo pendiente

### Frontera de autenticacion en la API

La proteccion actual es efectiva dentro de Hermes, pero debe reforzarse tambien en
el servidor. `HERMES_SHARED_SECRET` debe ser valido exclusivamente en
`/api/hermes-tools/*` y rechazarse en rutas generales como:

- `/api/delivery-notes/*`;
- `/api/customers/*`;
- `/api/special-pieces/*`.

El acceso normal de la aplicacion mediante JWT debe continuar funcionando. El
cambio requiere tests positivos y negativos antes del despliegue.

### Rotacion del secreto

El secreto de Hermes aparecio anteriormente en archivos e historiales. Los archivos
activos `AGENTS.md` fueron saneados, pero quedan copias historicas. Se debe:

1. generar un secreto nuevo;
2. actualizar la API y `/opt/data/secrets/epoxiron.curl.conf`;
3. reiniciar de forma controlada;
4. comprobar lecturas y escrituras protegidas;
5. limpiar copias historicas sin eliminar datos necesarios para auditoria.

### Datos de prueba

Antes de borrar nada, identificar mediante API los albaranes de prueba relacionados
con esta intervencion. Los conocidos son `ALB-2026-0172`, `ALB-2026-0174` y
`ALB-2026-0175` a `ALB-2026-0177`. Puede existir tambien `ALB-2026-0173`; debe
verificarse su origen. Cualquier eliminacion requiere autorizacion explicita y un
mecanismo soportado por la aplicacion.

## Siguiente fase funcional

Tras cerrar el endurecimiento de autenticacion, revisar los tres audios del cliente,
extraer una lista numerada de requisitos y evaluar cada punto contra el estado actual
del repositorio antes de implementar cambios:

- `WhatsApp Ptt 2026-08-28 at 10.46.48.ogg`
- `WhatsApp Ptt 2026-08-28 at 10.48.25.ogg`
- `WhatsApp Ptt 2026-08-28 at 11.00.25.ogg`
