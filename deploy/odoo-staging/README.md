# Odoo 19 Enterprise — staging

Stack aislado para validar Odoo Custom/Enterprise y VeriFactu. No comparte
contenedores, red, PostgreSQL ni volúmenes con Epoxiron producción.

## Preparación

1. Copiar este directorio al servidor Hetzner de staging.
2. Copiar `.env.example` a `.env` y reemplazar todos los valores de ejemplo.
3. Colocar los addons Enterprise 19 autorizados en `enterprise/`. El directorio
   está ignorado y nunca se publica en Git.
4. Validar la configuración:

```bash
docker compose --env-file .env config
```

El comando debe finalizar sin variables vacías ni errores de sintaxis.

5. Arrancar solo este stack:

```bash
docker compose --env-file .env up -d
```

Debe crear recursos con nombres `epoxiron_odoo_staging_*`.

6. Verificar contenedores y logs:

```bash
docker compose --env-file .env ps
docker compose --env-file .env logs --tail=200 odoo
```

PostgreSQL debe estar `healthy` y Odoo debe arrancar sin errores de base de
datos ni addons.

## Pasos manuales de Marcos

1. Activar la suscripción Enterprise.
2. Configurar España, razón social y NIF de la empresa.
3. Instalar Localización España (`l10n_es`).
4. Instalar `l10n_es_edi_verifactu`.
5. Cargar manualmente el certificado digital. Nunca copiarlo al repositorio.
6. Mantener VeriFactu en entorno de pruebas.
7. Anotar el método de redondeo fiscal en `FASE0B_CONTRATO_ODOO.md`.
8. Crear un contacto exclusivo de pruebas y guardar su ID en
   `ODOO_TEST_PARTNER_ID`.

## Usuario técnico y API key

1. Crear un usuario exclusivo, por ejemplo `epoxiron-api`.
2. Conceder el mínimo acceso necesario a contactos y facturación.
3. Generar una API key desde sus preferencias.
4. Guardar usuario y key únicamente en `.env`.
5. Revocar la key si no se reutilizará tras el spike.

## Seguridad

- Odoo escucha en `127.0.0.1`; el acceso externo debe pasar por HTTPS.
- No reutilizar secretos, certificados ni volúmenes de producción.
- No ejecutar el spike contra producción.
- Las escrituras del spike requieren a la vez `SPIKE_ALLOW_WRITES=true` y
  `--confirm-write`.

Las instrucciones del spike están en [`spike/README.md`](spike/README.md).

