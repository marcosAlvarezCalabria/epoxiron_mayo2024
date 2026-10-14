# Incidente: medidas mixtas ocultas en el albarán

Fecha: 2026-10-14

## Síntoma

Una línea con dimensiones y metros lineales, por ejemplo `TABURETE 220X220` con
`4.5 ml`, mostraba las dimensiones pero ocultaba los metros lineales en el
albarán final. La propuesta del agente sí enseñaba ambos valores.

## Causa

El formateador de la web trataba todas las medidas como un único dato. Si la
descripción ya incluía dimensiones, consideraba que cualquier medida estaba
representada y no añadía los metros lineales calculados.

Los datos persistidos y el cálculo económico eran correctos; el fallo estaba
limitado a la descripción renderizada por la web.

## Corrección

- Se separó la detección de dimensiones y metros lineales.
- Cada medida se añade solamente cuando no está ya presente.
- Se añadió una prueba de regresión para `TABURETE 220X220` con `4.5MLIN`.
- Se verificó que `ESMERILADO` continúa disponible como color especial en el
  selector RAL y es aceptado por el backend y el flujo de voz.

## Verificación y despliegue

- Web: 43/43 pruebas superadas y lint correcto.
- Commit de código desplegado: `dbbc513`.
- Artefacto: `index-JWZwdB7F.js`.
- SHA-256: `47256763bad7f75b61d2b4c8e7847242d18344b73a20893d63bb41f4b5b8e468`.
- Preview: `dd0a5d49-c97f-46a3-aa5d-f341db66cf7f`.
- Producción: `026c3228-f696-413f-a266-07e9fbfcbcf9`.
- Despliegue anterior de recuperación: `5822a706-5f2f-424e-b7da-cb77fe0667cb`.

La URL personalizada y la URL inmutable de producción sirvieron exactamente el
mismo artefacto verificado. La API permaneció saludable durante la publicación.
