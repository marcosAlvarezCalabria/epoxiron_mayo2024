# API restringida de Hermes para Epoxiron

## Conexion

- Base de produccion: `http://epoxiron-api-1:3001/api/hermes-tools`
- Configuracion protegida de `curl`:
  `/opt/data/secrets/epoxiron.curl.conf`
- Contenido JSON: `Content-Type: application/json`

En cada llamada usa `curl --config /opt/data/secrets/epoxiron.curl.conf`.
Nunca leas, imprimas, copies, modifiques ni calcules el hash del fichero protegido.
No construyas manualmente la cabecera `X-Hermes-Secret`.

## Operaciones permitidas

### Lectura

- `GET /customers`
- `GET /customers/:id`
- `GET /delivery-notes`
- `GET /delivery-notes/:id`
- `GET /dashboard-summary`

Filtros de albaranes: `date`, `dateFrom`, `dateTo`, `status`, `customerId`,
`today`, `limit` y `offset`.

### Previsualizar un precio

`POST /calculate-price`

Esta es la unica ruta de calculo permitida. La URL completa es
`http://epoxiron-api-1:3001/api/hermes-tools/calculate-price`. Nunca uses
`/api/delivery-notes/calculate-price` ni
`/api/hermes-tools/delivery-notes/calculate-price`.

El cuerpo tiene exactamente dos campos superiores:

- `customerId`: UUID del cliente; nunca `clientId`.
- `item`: un unico objeto; nunca un array ni `lines`.

Cada `item` exige `description`, `color`, `pricingMode` y `quantity`. El campo
`color` tambien es obligatorio para `UNIT`. Para `UNIT`, envia ademas
`customUnitPrice`. No envies `unitPrice` ni `totalPrice`.

```json
{
  "customerId": "uuid",
  "item": {
    "description": "TUBO 9005 2ML",
    "color": "9005",
    "texture": "MATE",
    "pricingMode": "DIMENSIONS",
    "linearMeters": 2,
    "quantity": 3
  }
}
```

La respuesta `pricing` es la unica fuente valida para precios e importes.

Para un precio unitario exacto proporcionado por el usuario:

```json
{
  "customerId": "uuid",
  "item": {
    "description": "SOPORTE ORO",
    "color": "ORO",
    "pricingMode": "UNIT",
    "customUnitPrice": 0.65,
    "quantity": 10
  }
}
```

La API puede aplicar un minimo. Presenta siempre el resultado devuelto.
Realiza una sola peticion con este contrato canonico. Si devuelve error, no pruebes
variantes de campos, bucles, otros endpoints ni la API general; informa y detente.

### Crear un borrador

`POST /delivery-notes`, solo tras confirmacion. El estado debe ser `DRAFT`.

```json
{
  "customerId": "uuid",
  "status": "DRAFT",
  "items": [{
    "description": "TUBO 9005 2ML",
    "color": "9005",
    "texture": "MATE",
    "pricingMode": "DIMENSIONS",
    "linearMeters": 2,
    "quantity": 3
  }]
}
```

No envies `unitPrice`, `totalPrice` ni `saveAsSpecialPiece`.

### Cambiar estado

`PATCH /delivery-notes/:id/status`, solo tras confirmacion independiente.

```json
{"status": "PENDING"}
```

Estados aceptados: `DRAFT`, `PENDING`, `REVIEWED`.

## Operaciones no disponibles

- Actualizar lineas o eliminar albaranes.
- Crear, editar o eliminar piezas especiales.
- Aplicar porcentajes o tarifas excepcionales por ml o m2.
- Escribir clientes.

No uses las rutas generales `/api/customers`, `/api/delivery-notes` o
`/api/special-pieces` como alternativa. No pruebes rutas por tanteo. Indica que la
operacion debe realizarse en la aplicacion hasta que exista un endpoint restringido.
