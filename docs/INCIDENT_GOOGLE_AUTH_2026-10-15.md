# Incidente: autorización de Google ausente en la web

Fecha: 2026-10-15

## Síntoma

El acceso web mediante Google dejó de funcionar después de publicar la mejora
de medidas mixtas del 2026-10-14.

## Causa demostrada

El despliegue de producción `026c3228-f696-413f-a266-07e9fbfcbcf9`, construido
desde `dbbc513`, servía el artefacto `index-JWZwdB7F.js`. El artefacto contenía
la URL pública correcta de la API, pero no contenía ningún Google Client ID.

`VITE_GOOGLE_CLIENT_ID` es una variable de compilación de Vite. Configurarla en
el proveedor después de generar `dist` no modifica un artefacto ya compilado.

## Recuperación disponible

El despliegue anterior `5822a706-5f2f-424e-b7da-cb77fe0667cb`, construido desde
`46ee829`, conserva el Google Client ID y la URL pública de la API correctos.

## Corrección y prevención

- Se conserva la mejora de medidas mixtas de `dbbc513`.
- El build de producción exige `VITE_API_URL` y `VITE_GOOGLE_CLIENT_ID`.
- Se rechazan URLs locales, de ejemplo, sin HTTPS y clientes OAuth distintos
  al autorizado para producción.
- La pantalla de acceso muestra un error explícito si falta la configuración en
  un entorno de desarrollo.

## Despliegue y verificación

- Commit de código: `baf1a65`.
- Primer despliegue corregido: `3d95ed4c-78d7-4fbf-8ccb-e9038a799ab4`.
- Artefacto web: `index-y00oG1DS.js`.
- SHA-256 del artefacto local publicado:
  `8854c5b0e9133f3f75838fd822c8797b0ffe37ce3b791b5dc65ea05951d8795c`.
- El dominio público sirve la API correcta, un único Google Client ID y ninguna
  referencia a `localhost`.
- Google Identity Services crea el botón de acceso con el Client ID esperado y
  no registra un error nuevo de origen en el dominio de producción.

