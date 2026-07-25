# Odoo Custom — Standard Cloud Hosting

Fase 0 para validar Odoo 19 Custom/Enterprise y VeriFactu en una base de
pruebas alojada y operada por Odoo. Epoxiron no instala Odoo, PostgreSQL ni
contenedores en su VPS.

## Decisión de alojamiento

- Plan: **Custom**.
- Hosting: **Standard Cloud Hosting de Odoo**.
- Odoo administra la infraestructura y las actualizaciones.
- Epoxiron se integra exclusivamente mediante la API externa.
- Odoo.sh y self-hosting quedan como alternativas únicamente si el spike
  demuestra que hace falta un módulo propio.

## Configuración manual de Marcos

1. Contratar o activar el plan Custom.
2. Crear una base exclusiva de pruebas en la región europea.
3. Configurar España, razón social y NIF de la empresa.
4. Instalar Localización España (`l10n_es`).
5. Instalar `l10n_es_edi_verifactu`.
6. Cargar manualmente el certificado digital.
7. Mantener VeriFactu en entorno de pruebas.
8. Crear un contacto exclusivo de pruebas y guardar su ID.
9. Anotar en `FASE0B_CONTRATO_ODOO.md` el método de redondeo fiscal.

## Usuario y API key para el spike

1. No crear todavía un segundo usuario interno: una suscripción de un usuario
   puede requerir pagar el usuario adicional.
2. En el único usuario administrador, generar una API key dedicada con una
   descripción inequívoca, por ejemplo `epoxiron-fase0-spike`.
3. Copiar `.env.example` a `.env` y usar el email del administrador en
   `ODOO_USER`, junto con la API key generada.
4. No enviar ni versionar la API key.
5. Revocar la key al terminar el spike si no se reutiliza.
6. Antes de producción, decidir si se contrata un segundo usuario técnico con
   permisos mínimos o se mantiene una key exclusiva y revocable del
   administrador.

## Validaciones del spike

El script de [`spike/`](spike/README.md) compara JSON-2 y XML-RPC, inspecciona
VeriFactu, descarga el PDF y comprueba la disponibilidad de
`x_epoxiron_idempotency_key`.

Las escrituras requieren simultáneamente `SPIKE_ALLOW_WRITES=true` y el
argumento `--confirm-write`. Nunca se ejecutará el modo escritura contra una
base de producción.
