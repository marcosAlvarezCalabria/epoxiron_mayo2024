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

## Usuario técnico

1. Crear un usuario exclusivo, por ejemplo `epoxiron-api`.
2. Conceder el mínimo acceso necesario a contactos y facturación.
3. Generar una API key desde sus preferencias.
4. Copiar `.env.example` a `.env` y guardar allí URL, base, usuario y key.
5. No enviar ni versionar la API key.

## Validaciones del spike

El script de [`spike/`](spike/README.md) compara JSON-2 y XML-RPC, inspecciona
VeriFactu, descarga el PDF y comprueba la disponibilidad de
`x_epoxiron_idempotency_key`.

Las escrituras requieren simultáneamente `SPIKE_ALLOW_WRITES=true` y el
argumento `--confirm-write`. Nunca se ejecutará el modo escritura contra una
base de producción.
