# SPEC — Mejoras de captura, calculadora y revisión previa de factura

> **Fecha:** 2026-07-27
> **Versión:** v1.0
> **Estado:** Implementada y validada en staging; pendiente de aprobación humana para `main`.
> **Ámbito:** Web y API de Epoxiron. No modifica facturas ya emitidas.

---

## 0. Objetivo

Mejorar la operación diaria en móvil y reducir errores antes de emitir una factura irreversible en
Odoo mediante cuatro cambios:

1. corregir la edición de unidades al cambiar entre líneas;
2. normalizar en mayúsculas los textos comerciales;
3. añadir una calculadora flotante y desplazable;
4. sustituir la confirmación simple de factura por una previsualización completa y obligatoria.

La lógica de precios continúa viviendo exclusivamente en la API. La previsualización no crea,
contabiliza ni envía nada a Odoo.

---

## 1. Edición segura de unidades entre líneas

### 1.1 Problema

Al introducir unidades en una línea y abrir o volver a otra, el valor editado puede no quedar
reflejado correctamente o puede mezclarse con el estado de la línea que se abre después.

### 1.2 Comportamiento obligatorio

- Cada línea del albarán mantiene un estado independiente identificado por su ID estable, nunca por
  la posición visual del array.
- Al cambiar las unidades y pulsar `Guardar`, cerrar el editor o abrir otra línea, el valor válido se
  guarda en la línea que se estaba editando.
- Abrir otra línea carga exclusivamente los datos de esa segunda línea.
- Volver a la primera línea muestra las unidades guardadas anteriormente.
- Cambiar las unidades recalcula el precio de esa línea y el total del albarán mediante la API.
- El valor provisional no puede aplicarse silenciosamente a otra línea por un cambio de foco,
  scroll, reordenación o cierre del panel.
- Si el valor está vacío, no es entero o es menor que 1, no se guarda ni se cambia de línea; se
  muestra el error junto al campo.
- Durante un cálculo pendiente se identifica la línea por ID. Una respuesta tardía no puede
  sobrescribir el cálculo de otra línea.

### 1.3 Rango

- Cantidad mínima: `1`.
- Cantidad máxima inicial: `200`, coincidiendo con el selector actual.
- Si en el futuro se amplía el rango, web, esquema API y dominio deben cambiar conjuntamente.

### 1.4 Criterios de aceptación

- Editar línea A a 25 unidades, abrir B y volver a A conserva 25.
- Editar A y después B conserva ambos valores independientemente.
- Una respuesta de precio de A que llega después de abrir B solo actualiza A.
- Un valor inválido impide cerrar o cambiar de línea hasta corregirlo o cancelar expresamente.
- Cancelar descarta únicamente los cambios provisionales de la línea abierta.

---

## 2. Normalización de textos comerciales a mayúsculas

### 2.1 Campos incluidos

Se guardan y muestran en mayúsculas:

- nombre comercial y razón social del cliente;
- dirección, población y provincia;
- descripción de productos y piezas especiales;
- color escrito manualmente, acabado y textos comerciales visibles en albaranes o facturas.

La normalización se realiza en la API antes de persistir. La web también puede transformar el texto
al salir del campo para que el usuario vea el resultado inmediatamente.

### 2.2 Campos excluidos

No se fuerzan a mayúsculas:

- correo electrónico;
- contraseñas, tokens y secretos;
- URLs;
- identificadores técnicos;
- notas internas de texto libre, salvo decisión funcional posterior.

NIF/CIF y códigos de país continúan normalizándose en mayúsculas como hasta ahora.

### 2.3 Reglas

- Se usa conversión Unicode compatible con español.
- Se eliminan espacios exteriores, pero no se destruyen acentos, `Ñ`, guiones ni separadores
  internos válidos.
- La normalización debe ser idéntica en altas, ediciones, voz e importaciones.
- No se modifica retroactivamente el contenido histórico de facturas ya emitidas.

### 2.4 Criterios de aceptación

- `barandilla exterior` se persiste como `BARANDILLA EXTERIOR`.
- `Peña y Muñoz, S.L.` conserva acentos y `Ñ`.
- `cliente@empresa.es` permanece sin alteración.
- El resultado es el mismo desde formulario manual, voz e importación.

---

## 3. Calculadora flotante y desplazable

### 3.1 Acceso

- La aplicación muestra un botón flotante de calculadora en las pantallas operativas autenticadas.
- El botón puede arrastrarse por la pantalla para que no tape formularios, botones ni información.
- Su posición queda limitada al área visible y respeta las zonas seguras del móvil.
- La última posición se conserva por dispositivo.
- Al rotar la pantalla o cambiar su tamaño, el botón vuelve automáticamente dentro de los límites.

### 3.2 Panel de cálculo

Al pulsar el botón se abre una calculadora con:

- dígitos `0–9`;
- suma, resta, multiplicación y división;
- separador decimal;
- cambio de signo;
- porcentaje;
- borrar último carácter;
- limpiar;
- resultado.

Reglas:

- admite coma y punto como entrada decimal, pero representa el resultado con formato español;
- evita división entre cero y muestra un error comprensible;
- no utiliza `eval` ni ejecuta texto como código;
- permite copiar el resultado;
- no escribe automáticamente en ningún campo del albarán para evitar cambios accidentales;
- cerrar y volver a abrir conserva el cálculo durante la sesión;
- incluye botón explícito para limpiar.

### 3.3 Usabilidad y accesibilidad

- Funciona con toque, ratón y teclado.
- El arrastre no se confunde con un toque de apertura.
- Tiene nombre accesible, foco visible y botones con área táctil mínima de 44 × 44 px.
- El panel puede cerrarse con botón, tecla Escape o toque fuera.
- No bloquea el scroll de la pantalla cuando está cerrado.

### 3.4 Criterios de aceptación

- Puede moverse a las cuatro esquinas sin salir de pantalla.
- Mantiene la posición después de recargar.
- Sigue visible al cambiar orientación o tamaño.
- Calcula correctamente operaciones encadenadas y decimales.
- Nunca modifica precios, medidas o unidades sin una acción posterior explícita del usuario.

---

## 4. Previsualización obligatoria antes de emitir una factura

### 4.1 Principio

La creación de una factura en Odoo es una acción fiscal irreversible dentro del flujo actual. El
usuario debe ver exactamente qué se enviará y confirmarlo antes de cualquier escritura remota.

Se elimina `window.confirm` del flujo de facturación y se sustituye por una pantalla o diálogo propio
de previsualización.

### 4.2 Contenido de la previsualización

Para 1..N albaranes seleccionados del mismo cliente se muestra una representación con formato de
factura:

#### Cabecera

- indicador visible `BORRADOR DE REVISIÓN — TODAVÍA NO EMITIDA`;
- razón social y NIF del emisor;
- razón social, NIF y domicilio fiscal del cliente;
- fecha prevista;
- serie prevista, si está configurada;
- condición de pago;
- números de todos los albaranes incluidos.

#### Líneas

Se muestran todas las líneas de todos los albaranes:

- número del albarán de origen;
- descripción comercial completa;
- cantidad;
- precio unitario;
- base de la línea;
- IVA aplicable;
- total.

No se agrupan líneas coincidentes. Se conserva el orden determinista definido en
`SPEC_FACTURACION_ODOO.md`.

#### Totales

- base imponible;
- cuota de IVA;
- total de factura.

También se muestra:

- cantidad de albaranes;
- cantidad total de líneas;
- avisos por datos fiscales incompletos;
- advertencia de que, al emitir, los albaranes quedarán facturados y bloqueados.

### 4.3 Fuente autoritativa

La previsualización se construye en la API utilizando exactamente:

- el mismo generador de descripciones comerciales;
- las mismas reglas de orden;
- los mismos snapshots;
- los mismos cálculos `Decimal`;
- el mismo redondeo global;
- el mismo impuesto que utilizará la creación definitiva.

La web no reconstruye importes ni líneas por su cuenta.

### 4.4 Contrato API propuesto

```http
POST /api/invoices/preview
Content-Type: application/json

{
  "deliveryNoteIds": ["id-1", "id-2", "id-3"]
}
```

Respuesta:

```json
{
  "preview": {
    "previewToken": "token-firmado-de-un-solo-uso",
    "expiresAt": "2026-07-27T21:30:00.000Z",
    "customer": {},
    "deliveryNotes": [],
    "lines": [],
    "subtotal": "100.00",
    "taxAmount": "21.00",
    "total": "121.00",
    "taxRate": "21.00"
  }
}
```

La emisión utiliza:

```http
POST /api/invoices
Content-Type: application/json

{
  "deliveryNoteIds": ["id-1", "id-2", "id-3"],
  "previewToken": "token-firmado-de-un-solo-uso",
  "confirmed": true
}
```

### 4.5 Protección contra cambios posteriores

El `previewToken` representa mediante firma o hash:

- IDs y versiones de los albaranes;
- cliente y snapshot fiscal;
- líneas y orden;
- cantidades y precios;
- impuesto y totales;
- usuario solicitante;
- fecha de caducidad.

Reglas:

- el token tiene caducidad corta, inicialmente 15 minutos;
- es de un solo uso;
- si cambia cualquier albarán, cliente, línea, precio o dato fiscal, la API responde `409`;
- ante `409`, la web obliga a generar y revisar una nueva previsualización;
- refrescar la página no puede emitir una factura;
- doble toque o reintento conserva la idempotencia existente y nunca crea dos facturas.

### 4.6 Confirmación humana

El botón final se llama:

`Emitir factura en Odoo`

Antes de habilitarlo, el usuario debe:

1. recorrer la previsualización completa;
2. marcar `He revisado el cliente, los albaranes, las líneas y los importes`;
3. pulsar el botón final.

Mientras se procesa:

- el botón queda deshabilitado;
- se muestra `Emitiendo factura…`;
- no se permite cerrar accidentalmente el diálogo;
- el resultado conduce al detalle de la factura y sus estados Odoo/VeriFactu.

Un botón separado `Volver a los albaranes` permite corregir datos sin emitir nada.

### 4.7 Errores

- `400`: selección o confirmación inválida.
- `404`: cliente o albarán inexistente.
- `409`: previsualización caducada, utilizada o distinta del estado actual.
- `422`: ficha fiscal o línea comercial incompleta.
- `502/503`: Odoo no disponible; mensaje seguro y accionable.

Ningún error de previsualización realiza escrituras en Odoo.

### 4.8 Criterios de aceptación

- Tres albaranes muestran todas sus líneas antes de emitir.
- Líneas y totales coinciden exactamente con el payload y la factura final de Odoo.
- No existe ninguna llamada de escritura a Odoo al abrir o regenerar la previsualización.
- El botón de emisión permanece deshabilitado hasta marcar la revisión.
- Modificar una unidad después de previsualizar provoca `409` al intentar emitir.
- Doble toque no crea dos facturas.
- En móvil, la tabla sigue siendo legible mediante diseño adaptado, sin ocultar cantidad, precio o
  total.
- El PDF final coincide visual y monetariamente con la previsualización aceptada.

---

## 5. Orden de implementación

### Fase A — Corrección de captura

1. Estado de edición aislado por ID de línea.
2. Persistencia y recálculo seguro de unidades.
3. Normalización de textos comerciales.
4. Tests unitarios y de interacción.

### Fase B — Calculadora

1. Motor de cálculo puro y testeado.
2. Panel accesible.
3. Botón flotante, arrastre, límites y persistencia.
4. Pruebas móvil y escritorio.

### Fase C — Previsualización fiscal

1. Caso de uso autoritativo de preview en API.
2. Token firmado, caducidad y detección de cambios.
3. Diálogo/pantalla de factura previa.
4. Sustitución de `window.confirm`.
5. E2E contra Odoo staging con 1 y 3 albaranes.

No se despliega una fase si fallan lint, tests o build de API o web.

---

## 6. Fuera de alcance

- Editar manualmente importes dentro de la previsualización.
- Crear facturas sin albaranes.
- Rectificativas y abonos.
- Usar la calculadora para cambiar campos automáticamente.
- Alterar facturas históricas.
- Fusionar automáticamente la rama a `main`.

---

## 7. Definition of Done

- Requisitos y criterios anteriores cubiertos con tests.
- Tests unitarios del aislamiento por línea y normalización.
- Tests del motor de calculadora sin `eval`.
- Tests de integración del preview y del token obsoleto.
- E2E móvil: editar A, editar B y volver a A.
- E2E fiscal: seleccionar tres albaranes, revisar todas las líneas y emitir una única factura.
- Inspección visual de la previsualización y del PDF final en staging.
- Lint, tests y build completos de API y web.
- Despliegue inicial únicamente en staging.
- Aprobación humana antes de merge a `main` o activación en producción.

---

## 8. Resultado de validación en staging

Validación realizada el 2026-07-28 sobre `feature/facturacion-odoo`:

- tres albaranes y cinco líneas mostrados por la previsualización autoritativa;
- modificación posterior de unidades rechazada con `409`;
- doble emisión concurrente resuelta con respuestas `201` y `200` sobre una única factura;
- factura de prueba `INV/2026/00011`;
- Odoo `POSTED` y VeriFactu `ACCEPTED`;
- base `84,08 €`, IVA `17,66 €` y total `101,74 €`;
- PDF disponible, descargado con HTTP `200` y cabecera `%PDF` válida.

No se ha modificado ni fusionado `main`, ni se ha activado esta funcionalidad en producción.
