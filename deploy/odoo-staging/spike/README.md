# Spike API Odoo

Script aislado del dominio de Epoxiron. Compara JSON-2 y XML-RPC y guarda
informes sanitizados en `output/`.

## Instalar y validar

```bash
pnpm install --ignore-workspace
pnpm check
pnpm test
```

Cada comando debe finalizar con código 0. El lockfile del spike permite repetir
la misma instalación.

## Solo lectura

```bash
pnpm spike:json2
pnpm spike:xmlrpc
```

Autentican, inspeccionan campos de contactos/facturas y buscan el IVA de venta,
sin crear documentos.

## Escritura explícitamente confirmada

Con `SPIKE_ALLOW_WRITES=true` y un `ODOO_TEST_PARTNER_ID` de pruebas:

```bash
pnpm spike:json2 -- --confirm-write
pnpm spike:xmlrpc -- --confirm-write
```

Cada ejecución crea y contabiliza una factura de prueba, sondea los campos
VeriFactu y descarga el PDF. Nunca usar estas órdenes contra producción.

Los resultados deben trasladarse a `../FASE0B_CONTRATO_ODOO.md`. `output/`
permanece fuera de Git.

