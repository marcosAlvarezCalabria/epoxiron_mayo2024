# Guía de merge y puesta en producción de Odoo

> **Fecha:** 2026-08-01  
> **Rama de origen:** `feature/facturacion-odoo`  
> **Rama de destino:** `main`  
> **Estrategia:** despliegue técnico con Odoo desactivado, semana paralela Sage/Odoo de pruebas y corte posterior a un Odoo definitivo nuevo.  
> **Regla principal:** durante la semana paralela, Sage es el único emisor de facturas reales.

## 1. Objetivo

Fusionar y desplegar las mejoras de facturación, clientes, captura y seguridad sin activar de inmediato
la emisión fiscal en producción. La activación de Odoo se hará después de una semana de validación en
paralelo con Sage y tras crear desde cero la base Odoo definitiva del cliente.

Esta guía separa tres acontecimientos distintos:

1. **Merge y despliegue técnico:** el código llega a producción con Odoo desactivado.
2. **Semana piloto:** Sage factura legalmente y el Odoo actual se usa solo para pruebas.
3. **Corte fiscal:** se crea el Odoo definitivo, se migran clientes, se continúa la numeración y Odoo
   pasa a ser el único emisor.

No se avanza al paso siguiente si falla una comprobación obligatoria.

## 2. Responsables y confirmaciones

Antes de empezar se deben asignar estos responsables:

| Responsabilidad | Responsable |
|---|---|
| Aprobación funcional y decisión de continuar/parar | Marcos |
| Ejecución técnica, logs y despliegue | Responsable técnico |
| Serie, último número de Sage y tratamiento contable | Cliente + gestoría |
| Datos fiscales, certificado y configuración Odoo | Cliente + responsable Odoo |
| Primera factura real | Marcos + cliente + gestoría disponible |

Toda escritura que afecte a producción requiere confirmación explícita de Marcos.

## 3. Estado y alcance del release

La rama incluye:

- núcleo de facturación Odoo e idempotencia;
- previsualización fiscal obligatoria;
- sincronización del ciclo de vida de clientes;
- datos fiscales de clientes;
- estados y trazabilidad de facturas y albaranes;
- reconciliación y descarga de PDF;
- mejoras de captura y uso móvil;
- calculadora flotante;
- endurecimiento de seguridad y actualización de dependencias.

Migraciones nuevas que llegarán a producción:

1. `20260725120000_add_customer_fiscal_data`;
2. `20260726100000_add_invoicing_core`;
3. `20260726123000_add_delivery_note_number_sequence`;
4. `20260727120000_add_customer_active`.

Las migraciones son aditivas. Aun así, no se debe intentar revertirlas manualmente después del
despliegue. Si la aplicación nueva falla, se desactivan funciones, se conserva el esquema y se vuelve
temporalmente a la imagen anterior. Una restauración completa de base de datos se reserva para un
fallo grave confirmado y exige detener las escrituras.

## 4. Reglas de seguridad del proceso

- No guardar secretos, backups ni `.env.production` en Git.
- No usar la base de datos productiva para pruebas de facturación.
- No emitir la misma venta en Sage y Odoo como dos facturas reales.
- No borrar facturas contabilizadas ni registros VeriFactu reales.
- No reutilizar IDs internos del Odoo piloto en el Odoo definitivo.
- No activar facturación antes de cerrar la serie y el último número de Sage.
- No desplegar si no existe un backup restaurable de PostgreSQL.
- No ejecutar una migración de vuelta escrita a mano durante una incidencia.
- Registrar hora, commit, operador y resultado de cada paso de producción.

## 5. Fase 0 — Preparación

### 5.1 Congelar el alcance

1. No añadir nuevas funcionalidades a `feature/facturacion-odoo`.
2. Confirmar que el árbol de trabajo está limpio.
3. Anotar el commit exacto candidato al release.

```powershell
git status --short --branch
git rev-parse HEAD
git log --oneline main..HEAD
git diff --stat main...HEAD
```

**Resultado esperado:** rama limpia, sincronizada y sin archivos sin revisar.

**Si falla:** no continuar. Clasificar cada cambio local y decidir si pertenece al release antes de
modificar, descartar o guardar nada.

### 5.2 Confirmar el mecanismo de despliegue

Antes del merge hay que documentar:

- si `main` despliega automáticamente la web en Cloudflare Pages;
- si la API se despliega manualmente en el VPS;
- qué commit está actualmente en producción;
- quién puede detener o revertir ambos despliegues;
- dónde se consultan logs de Cloudflare y del VPS.

**Resultado esperado:** se conoce el efecto exacto de fusionar `main`.

**Si no se conoce:** detener el merge. No se debe descubrir el mecanismo durante el despliegue.

### 5.3 Ventana de cambio

Elegir una ventana con baja actividad y reservar tiempo para:

- backup;
- migraciones;
- despliegue;
- smoke tests;
- observación mínima de 30 minutos.

Durante la migración y las pruebas iniciales no se crearán ni modificarán albaranes en producción.

## 6. Fase 1 — Validación automática previa al merge

Ejecutar desde la raíz del repositorio:

```powershell
pnpm --dir api lint
pnpm --dir api test
pnpm --dir api build
pnpm --dir web lint
pnpm --dir web test
pnpm --dir web build
npm --prefix api audit --omit=dev
pnpm audit --prod
git diff --check
git status --short
```

### Criterios de aceptación

- API: lint, tests y build correctos.
- Web: lint, tests y build correctos.
- API sin vulnerabilidades altas o moderadas.
- En web solo se admite la excepción RSC documentada en `docs/SECURITY_EXCEPTIONS.md` mientras la
  aplicación siga siendo una SPA sin RSC.
- `git diff --check` sin errores.
- árbol de trabajo limpio al terminar.

### Si falla

1. Guardar el comando y el error completo sin incluir secretos.
2. Corregir el problema en `feature/facturacion-odoo`.
3. Añadir o ajustar el test que demuestre la corrección.
4. Repetir **toda** la batería, no solo el test que falló.
5. No crear el merge hasta recuperar todos los resultados verdes.

## 7. Fase 2 — Revisión manual previa al merge

### 7.1 Flujos funcionales en staging

Probar con un usuario real permitido:

1. Login Google y cierre de sesión.
2. Listado, alta, edición, archivo y restauración de cliente.
3. Creación y edición de albarán con varias líneas.
4. Entrada por voz: solo debe pre-rellenar; nunca crear automáticamente.
5. Calculadora: operaciones, copia, arrastre y persistencia.
6. Selección móvil de varios albaranes.
7. Previsualización completa de factura.
8. Modificar un albarán después del preview: la emisión debe devolver `409`.
9. Doble pulsación de emisión: debe existir una sola factura.
10. Factura Odoo de prueba: `POSTED`, VeriFactu de pruebas `ACCEPTED` y PDF descargable.
11. Hermes: lectura correcta y escrituras únicamente con confirmación explícita.
12. Rate limit de login: respuesta neutra `429` al superar el límite.

### 7.2 Navegadores y tamaños

- Chrome/Edge de escritorio.
- Navegador móvil usado por el cliente.
- Ancho móvil estrecho.
- Conexión lenta o petición repetida durante la previsualización.

### Criterio de aceptación

Todos los flujos críticos funcionan y no se ha usado ninguna credencial o base de producción.

### Si falla

Detener el release, registrar reproducción, usuario, hora y petición afectada. Corregir en la rama y
volver a ejecutar las fases 1 y 2.

## 8. Fase 3 — Preparar producción con Odoo desactivado

En `/opt/epoxiron/api/.env.production` deben existir explícitamente:

```env
ODOO_INVOICING_ENABLED=false
ODOO_CUSTOMER_SYNC_ENABLED=false
ODOO_RECONCILIATION_ENABLED=false
```

Las credenciales Odoo pueden permanecer vacías mientras los tres flags estén desactivados. No copiar
credenciales del Odoo piloto al entorno productivo como solución definitiva.

Confirmar además:

- `JWT_EXPIRES_IN=1d`;
- CORS limitado al dominio productivo;
- secretos de JWT y Hermes presentes y distintos;
- variables de voz, correo y R2 conservadas sin cambios accidentales;
- `POSTGRES_PASSWORD` no usa el valor de ejemplo del repositorio.

### Test después del cambio de configuración

Reiniciar solo si es necesario y comprobar que la API arranca sin errores de validación. No mostrar el
contenido del archivo de entorno en terminales o registros compartidos.

### Si falla

Restaurar el archivo de entorno desde su copia segura, mantener los flags Odoo en `false` y no
continuar hasta que la API actual siga arrancando correctamente.

## 9. Fase 4 — Backup obligatorio del VPS y PostgreSQL

Antes del merge y de cualquier cambio en producción se necesitan **dos protecciones diferentes**:

1. una instantánea completa del VPS, para recuperar servidor, Docker, configuración y volúmenes;
2. un backup lógico de PostgreSQL, para poder inspeccionar o restaurar los datos de forma independiente.

Una protección no sustituye a la otra.

### 9.1 Instantánea completa del VPS

Desde el panel del proveedor del VPS:

1. comprobar que no hay despliegues, migraciones ni escrituras importantes en curso;
2. crear una instantánea manual completa antes del cambio;
3. nombrarla con fecha, hora y motivo, por ejemplo `pre-merge-odoo-20260801-HHMM`;
4. esperar hasta que el proveedor confirme que la instantánea está completada;
5. registrar su identificador y la hora exacta;
6. confirmar que se conoce el procedimiento para restaurarla y el tiempo estimado de recuperación;
7. comprobar la política de retención para que no se elimine durante la ventana de cambio.

La instantánea puede contener secretos y datos personales. Solo debe ser accesible para responsables
autorizados y no debe descargarse ni copiarse a ubicaciones no protegidas.

### Verificación de la instantánea

- aparece como completada, no pendiente ni fallida;
- corresponde al VPS productivo correcto;
- tiene fecha anterior al despliegue;
- incluye los discos y volúmenes necesarios;
- existe espacio o cuota para conservarla;
- el responsable sabe cómo iniciar una restauración.

### Si falla

No hacer merge, no reconstruir contenedores y no ejecutar migraciones. Resolver la creación o retención
de la instantánea con el proveedor antes de continuar.

### 9.2 Copia de configuración operativa

Guardar en una ubicación cifrada y con acceso restringido una copia de los archivos de configuración
necesarios para reconstruir el servicio, como mínimo:

- `/opt/epoxiron/api/.env.production`;
- `/opt/epoxiron/deploy/hermes/hermes.env`;
- configuración activa de proxy, dominios y certificados si vive fuera de `/opt/epoxiron`;
- commit o versión exacta desplegada antes del cambio;
- salida de `docker compose ... ps` sin mostrar secretos.

Estas copias nunca se guardan en Git ni se muestran en logs compartidos.

### 9.3 Backup lógico de PostgreSQL

Desde `/opt/epoxiron`, generar un `pg_dump` con fecha y hora en una ubicación protegida fuera del
repositorio. Ejemplo orientativo:

```bash
docker compose -f deploy/docker-compose.vps.yml -p epoxiron exec -T postgres \
  pg_dump -U epoxiron -d epoxiron -Fc > /ruta-segura/epoxiron_pre_odoo_YYYYMMDD_HHMM.dump
```

### 9.4 Verificación del backup de PostgreSQL

- el archivo existe y no está vacío;
- `pg_restore --list` puede leerlo;
- se registra su checksum;
- existe espacio suficiente;
- se conoce el procedimiento y destino de restauración;
- se guarda una segunda copia fuera del VPS si es posible.

Ejemplo:

```bash
pg_restore --list /ruta-segura/epoxiron_pre_odoo_YYYYMMDD_HHMM.dump
sha256sum /ruta-segura/epoxiron_pre_odoo_YYYYMMDD_HHMM.dump
```

### Si falla

No ejecutar migraciones. Resolver permisos, espacio o integridad y repetir el backup.

## 10. Fase 5 — Merge a `main`

Se recomienda hacerlo mediante PR para conservar revisión, CI y aprobación.

### Comprobaciones inmediatamente anteriores

```powershell
git fetch origin
git rev-list --left-right --count origin/main...origin/feature/facturacion-odoo
git log --oneline origin/main..origin/feature/facturacion-odoo
```

Si `main` ha avanzado, integrar primero sus cambios en la rama, resolver conflictos y repetir las
fases 1 y 2.

### Condiciones del PR

- destino `main` y origen `feature/facturacion-odoo`;
- CI completamente verde;
- lista de migraciones incluida en la descripción;
- constancia de que Odoo se desplegará desactivado;
- aprobación explícita de Marcos;
- commit de merge identificable.

Después del merge:

```powershell
git fetch origin
git rev-parse origin/main
git merge-base --is-ancestor origin/feature/facturacion-odoo origin/main
```

### Test después del merge

La segunda orden debe finalizar con código `0`. Confirmar que el commit desplegable de `main` coincide
con el aprobado.

### Si falla

No desplegar. No forzar `main`. Investigar si faltan commits, hubo un merge distinto o apareció una
actualización concurrente.

## 11. Fase 6 — Despliegue de API y migraciones

### Orden obligatorio

1. Confirmar pausa de escrituras.
2. Registrar el commit anterior y el nuevo.
3. Construir la nueva imagen de API.
4. Verificar que el contenedor puede arrancar con flags Odoo en `false`.
5. Ejecutar `prisma migrate deploy` una sola vez.
6. Reiniciar/recrear la API con la nueva imagen.
7. Consultar estado y logs.

Comandos definidos por el proyecto:

```bash
docker compose -f deploy/docker-compose.vps.yml -p epoxiron up -d --build api
docker compose -f deploy/docker-compose.vps.yml -p epoxiron exec api sh -lc \
  'cd /app/api && ./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma'
docker compose -f deploy/docker-compose.vps.yml -p epoxiron ps
docker compose -f deploy/docker-compose.vps.yml -p epoxiron logs --tail=200 api
```

### Tests después de la migración

- API en estado activo y sin reinicios continuos.
- No aparecen errores Prisma ni errores de validación de entorno.
- Las cuatro migraciones constan como aplicadas.
- Existen clientes y albaranes previos con los mismos conteos básicos.
- Los clientes existentes siguen activos por defecto.
- La secuencia anual de albaranes se inicializó desde el máximo existente.
- No existen facturas nuevas ni albaranes convertidos en `INVOICED` por el despliegue.

### Si falla la construcción antes de migrar

Mantener la imagen anterior y no ejecutar migraciones.

### Si falla la migración

- detener el despliegue;
- conservar logs y estado de `_prisma_migrations`;
- no editar tablas ni marcar migraciones manualmente;
- mantener la aplicación anterior sin nuevas escrituras si el esquema quedó parcialmente cambiado;
- decidir la recuperación con una revisión técnica específica.

### Si falla la aplicación después de migrar

Mantener los flags Odoo en `false` y volver temporalmente a la imagen anterior si es compatible con el
esquema aditivo. No restaurar la base salvo corrupción o incompatibilidad confirmada.

## 12. Fase 7 — Despliegue web

Desplegar exactamente el commit de `main` aprobado. Si Cloudflare Pages despliega automáticamente,
vigilar el job iniciado por el merge.

### Tests después del despliegue web

1. La página principal responde `200`.
2. Login y rutas protegidas funcionan.
3. No hay errores JavaScript en consola.
4. Clientes, albaranes y dashboard cargan.
5. La pantalla de facturas abre sin emitir nada.
6. La calculadora funciona.
7. Vista móvil sin desbordamientos ni acciones inaccesibles.
8. El frontend llama únicamente a la API productiva esperada.

### Si falla

Revertir el despliegue web al artefacto anterior desde Cloudflare. La API puede permanecer actualizada
con Odoo desactivado mientras se diagnostica, siempre que los flujos anteriores sigan funcionando.

## 13. Fase 8 — Smoke tests de producción con Odoo desactivado

Ejecutar únicamente operaciones reversibles y controladas:

1. Login de un usuario autorizado.
2. Consultar clientes y albaranes existentes.
3. Crear un cliente temporal claramente identificable, editarlo, archivarlo y restaurarlo.
4. Confirmar que **no** aparece en ningún Odoo.
5. Crear y editar un albarán controlado.
6. Verificar normalización, precios y múltiples líneas.
7. Probar voz: debe pre-rellenar sin guardar automáticamente.
8. Probar Hermes en lectura y una escritura solo con confirmación explícita.
9. Verificar respuesta `429` del login sin bloquear el acceso normal posterior.
10. Revisar logs de API durante todas las operaciones.

No pulsar `Emitir factura en Odoo` en producción. Con los flags desactivados, cualquier intento debe
fallar de forma segura y sin escribir remotamente.

### Criterio de aceptación

Los flujos existentes funcionan, no hay escrituras Odoo y no aparecen errores internos o secretos en
las respuestas.

### Observación

Mantener vigilancia durante al menos 30 minutos y revisar nuevamente los logs. Si aparece degradación,
aplicar el procedimiento de incidencia de la sección 18.

## 14. Fase 9 — Semana paralela Sage/Odoo piloto

### Reglas operativas

- Sage es el único emisor legal.
- El Odoo piloto permanece en VeriFactu de pruebas.
- La integración piloto usa staging de Epoxiron, nunca la base productiva.
- No se envían PDFs Odoo de prueba a clientes.
- Cada caso de prueba referencia la factura real de Sage solo para comparación interna.

### Muestra diaria mínima

- una factura con un albarán;
- una factura con varios albaranes;
- cliente con datos fiscales completos;
- descripción con dimensiones, color, textura e imprimación;
- comparación de base, IVA y total;
- PDF y QR de pruebas;
- doble pulsación o reintento;
- reconciliación si la aceptación no es inmediata.

### Registro diario

| Fecha | Caso | Sage | Odoo piloto | Importes iguales | PDF correcto | Incidencia | Resultado |
|---|---|---|---|---|---|---|---|

### Criterio para terminar la semana

- no quedan incidencias críticas o altas;
- todos los importes cuadran al céntimo;
- no existen duplicados;
- el flujo móvil está aprobado por el usuario;
- la gestoría confirma el plan de numeración y corte;
- Marcos autoriza crear el Odoo definitivo.

## 15. Fase 10 — Retirada del Odoo piloto

No borrarlo hasta guardar:

- exportación de configuración relevante;
- listado de pruebas y resultados;
- PDFs de muestra;
- impuestos, diario, redondeo y condiciones de pago usados;
- evidencia de que VeriFactu estaba en pruebas;
- fecha y responsable de la eliminación.

Confirmar que el Odoo piloto no contiene ninguna factura oficial. Si existe alguna factura enviada al
entorno real, detener el borrado y consultar con la gestoría: no se puede tratar como dato descartable.

Es preferible conservar la base piloto hasta que la primera factura real del Odoo definitivo haya sido
aceptada. Después, eliminarla desde la administración de Odoo con confirmación explícita del titular.

## 16. Fase 11 — Creación del Odoo definitivo

### Configuración obligatoria

1. Base nueva con nombre del cliente.
2. Titular, correo y usuario definitivo del cliente.
3. Razón social, NIF y domicilio fiscal correctos.
4. Localización contable española y plan contable acordado.
5. Módulo `l10n_es_edi_verifactu`.
6. Certificado digital del cliente.
7. Diario de ventas.
8. Impuesto del 21 % correcto y su nuevo ID interno.
9. Redondeo global por impuesto.
10. Condiciones de pago necesarias.
11. VeriFactu inicialmente en entorno de pruebas.
12. Usuario API y permisos mínimos necesarios.

### Tests después de configurar

- acceso del usuario propietario;
- conexión JSON-2 con el usuario API;
- lectura de empresa, diario e impuesto;
- factura manual de prueba con importes conocidos;
- contabilización, envío a VeriFactu de pruebas y PDF;
- base, IVA y total iguales a los valores esperados.

### Si falla

No conectar Epoxiron productivo ni importar clientes. Corregir la configuración en Odoo y repetir la
prueba completa.

## 17. Fase 12 — Migración de clientes al Odoo definitivo

### Preparación crítica de referencias

Los valores `externalPartnerId` del Odoo piloto no son válidos en la base nueva. La producción debe
partir sin esos IDs o con una estrategia explícita de reasignación. Nunca copiar IDs internos del
piloto.

Antes de activar sincronización:

- completar NIF, razón social y domicilio fiscal;
- normalizar NIF y revisar duplicados;
- separar clientes activos de históricos;
- generar un informe de clientes incompletos;
- conservar un export de origen.

### Activación controlada

Configurar las credenciales de la base definitiva y mantener:

```env
ODOO_INVOICING_ENABLED=false
ODOO_CUSTOMER_SYNC_ENABLED=true
ODOO_RECONCILIATION_ENABLED=false
```

Reiniciar la API y comprobar que arranca.

### Orden de importación

1. Un cliente controlado.
2. Verificar todos sus campos en Odoo.
3. Editarlo desde Epoxiron y comprobar actualización.
4. Archivarlo y restaurarlo.
5. Importar un lote pequeño.
6. Revisar duplicados, ambigüedades y errores.
7. Continuar por lotes hasta completar.

### Tests después de cada lote

- número de éxitos, errores y omitidos;
- ningún NIF duplicado inesperado;
- `externalPartnerId` guardado solo tras éxito remoto;
- razón social y dirección correctas;
- cliente activo/archivado correcto;
- un reintento no crea otro contacto;
- los errores no exponen credenciales o payloads sensibles.

### Si falla

Detener el lote. No corregir escribiendo directamente en PostgreSQL. Resolver el dato o la ambigüedad
mediante el flujo de aplicación y reintentar únicamente los casos fallidos.

## 18. Fase 13 — Corte de Sage y activación fiscal

Esta fase requiere la aprobación conjunta de Marcos, cliente y gestoría.

### 18.1 Cierre de Sage

1. Elegir fecha y hora exactas de corte.
2. Emitir en Sage todas las facturas anteriores al corte.
3. Registrar última serie, último número y fecha.
4. Identificar albaranes todavía no facturados.
5. Generar backup y exportes legales/contables de Sage.
6. Impedir nuevas emisiones en Sage.

No se reinicia la numeración por comodidad. La primera factura Odoo debe usar la continuación
acordada con la gestoría.

### 18.2 Configurar la secuencia Odoo

- configurar serie y siguiente número;
- comprobar que fecha y periodo coinciden;
- verificar que no genera duplicados;
- registrar captura o evidencia de la configuración;
- no emitir aún a producción hasta completar la comprobación cruzada.

### 18.3 Prueba final no oficial

Con VeriFactu todavía en pruebas:

- cliente fiscalmente completo;
- líneas e importes conocidos;
- número/serie previstos;
- PDF correcto;
- estado de prueba aceptado.

### 18.4 Activación

1. Desactivar el entorno de pruebas VeriFactu en Odoo.
2. Confirmar certificado y empresa activa.
3. Configurar en Epoxiron la serie, impuesto y credenciales definitivas.
4. Activar:

```env
ODOO_INVOICING_ENABLED=true
ODOO_CUSTOMER_SYNC_ENABLED=true
ODOO_RECONCILIATION_ENABLED=true
```

5. Reiniciar la API y revisar logs.

### Tests inmediatos, antes de emitir

- API estable;
- conexión Odoo correcta;
- cliente de la primera factura correctamente vinculado;
- preview muestra serie, líneas, base, IVA y total esperados;
- token de preview válido;
- Sage permanece cerrado para nuevas facturas.

Si falla cualquier punto, volver a desactivar facturación y reconciliación antes de continuar.

## 19. Fase 14 — Primera factura real supervisada

Seleccionar un caso sencillo y real, con cliente presente y datos fiscales verificados.

### Comprobación previa

- cliente, NIF y domicilio;
- albaranes correctos y revisados;
- descripciones y cantidades;
- base imponible;
- IVA del 21 %;
- total;
- serie y siguiente número;
- confirmación explícita del usuario.

### Comprobación posterior

1. Existe una sola factura en Epoxiron.
2. Existe una sola `account.move` en Odoo.
3. Número y serie son los esperados.
4. Estado Odoo `POSTED`.
5. Estado VeriFactu `ACCEPTED`, o `PENDING` con reconciliación funcionando.
6. Todas las líneas de los albaranes aparecen en el PDF.
7. Base, IVA y total cuadran al céntimo.
8. PDF descargable y QR válido.
9. Albaranes marcados como `INVOICED` una sola vez.
10. Repetir la petición no crea otra factura.
11. No hay errores sensibles en logs o respuesta.

No emitir una segunda factura hasta cerrar esta revisión.

### Si VeriFactu queda pendiente

No repetir la emisión. Revisar la reconciliación y esperar el resultado remoto.

### Si existe rechazo

No borrar ni recrear a ciegas. Conservar código y mensaje seguro, revisar el estado en Odoo y decidir
con la gestoría si corresponde corregir, anular o rectificar.

### Si se creó una factura oficial incorrecta

No resetear la base ni reutilizar el número. Seguir el procedimiento fiscal de anulación o factura
rectificativa acordado con la gestoría.

## 20. Fase 15 — Seguimiento posterior

### Primer día

- revisar cada factura emitida;
- comparar importes y PDF;
- revisar reconciliación y logs después de cada emisión;
- mantener disponible el backup previo y la evidencia de Sage.

### Primera semana

- revisión diaria de facturas aceptadas, pendientes y rechazadas;
- revisión de duplicados y reintentos;
- revisión de clientes no sincronizados;
- confirmación del cliente sobre experiencia móvil;
- informe final de incidencias.

### Cierre del cambio

El cambio se considera completado cuando:

- Odoo es el único emisor;
- la secuencia continúa correctamente desde Sage;
- no hay facturas duplicadas;
- todos los documentos emitidos están aceptados o explicados;
- la migración de clientes está conciliada;
- el cliente y la gestoría aprueban el resultado;
- se documenta el commit de producción y la fecha de corte.

## 21. Procedimiento general ante incidencias

### Nivel 1 — Problema de interfaz sin escritura fiscal

- detener la operación afectada;
- conservar logs y captura;
- mantener Odoo activo solo si el resto es seguro;
- revertir la web al artefacto anterior si procede.

### Nivel 2 — API inestable antes de emitir facturas

- poner los tres flags Odoo en `false`;
- reiniciar la API;
- volver a la imagen anterior si es compatible con el esquema;
- mantener Sage como emisor si el corte todavía no ocurrió.

### Nivel 3 — Duda sobre una emisión remota

- no volver a pulsar emitir;
- buscar por `remoteReference` e idempotency key;
- consultar factura y documento VeriFactu en Odoo;
- ejecutar/revisar reconciliación;
- no modificar directamente la base de datos.

### Nivel 4 — Factura oficial incorrecta

- bloquear nuevas emisiones temporalmente;
- conservar número, PDF, respuesta y registro VeriFactu;
- avisar a cliente y gestoría;
- corregir mediante anulación o rectificativa, nunca mediante borrado o reset.

### Restauración completa de PostgreSQL

Solo se contempla si existe corrupción o daño general confirmado. Requiere:

- detener API y Hermes para impedir escrituras;
- conservar copia de la base dañada;
- aprobación explícita;
- restaurar primero en un entorno aislado y verificarla;
- documentar qué datos posteriores al backup se perderían.

## 22. Lista de control ejecutiva

### Merge y despliegue

- [ ] Alcance congelado y árbol limpio.
- [ ] CI, lint, tests, builds y auditorías correctos.
- [ ] Staging validado manualmente.
- [ ] Mecanismo de despliegue confirmado.
- [ ] Flags Odoo productivos en `false`.
- [ ] Instantánea completa del VPS creada y verificada.
- [ ] Configuración operativa guardada de forma segura.
- [ ] Backup PostgreSQL creado y verificado.
- [ ] PR aprobado y fusionado.
- [ ] Migraciones aplicadas correctamente.
- [ ] API y web desplegadas.
- [ ] Smoke tests productivos correctos.
- [ ] Observación mínima completada.

### Semana paralela

- [ ] Sage es el único emisor real.
- [ ] Odoo piloto usa VeriFactu de pruebas.
- [ ] Comparaciones diarias registradas.
- [ ] Sin diferencias monetarias ni duplicados.
- [ ] Usuario aprueba el flujo.

### Odoo definitivo y corte

- [ ] Evidencias del piloto conservadas.
- [ ] Odoo definitivo creado a nombre del cliente.
- [ ] Configuración fiscal verificada.
- [ ] IDs del Odoo piloto no reutilizados.
- [ ] Clientes migrados y conciliados.
- [ ] Última serie y número Sage registrados.
- [ ] Sage cerrado para nuevas emisiones.
- [ ] Secuencia Odoo configurada y aprobada.
- [ ] VeriFactu productivo activado.
- [ ] Primera factura real verificada completamente.
- [ ] Seguimiento de la primera semana completado.

## 23. Registro de ejecución

| Paso | Fecha/hora | Responsable | Commit/entorno | Resultado | Evidencia | Decisión |
|---|---|---|---|---|---|---|
| Preflight | | | | | | |
| Backup | | | | | | |
| Merge | | | | | | |
| Migraciones | | | | | | |
| API | | | | | | |
| Web | | | | | | |
| Smoke tests | | | | | | |
| Semana piloto | | | | | | |
| Migración clientes | | | | | | |
| Corte Sage | | | | | | |
| Primera factura | | | | | | |
