# Incidencia: color RAL no promovido desde una nota de voz

Fecha: 2026-10-02

## Sintoma

El agente transcribio correctamente `TUBO 8019 MATE` y `SOPORTE 8019 MATE`,
pero al terminar el borrador indico que ambas lineas carecian de color.

## Causa demostrada

El parser estructurado dejo `8019` dentro de `description` y devolvio `color:
null`. La normalizacion posterior confiaba solo en el campo `color` y no
recuperaba un RAL conocido desde la descripcion. La validacion obligatoria de la
API rechazo despues las dos lineas.

## Correccion

La API recupera un unico codigo incluido en su lista RAL cuando aparece:

- precedido por la palabra `RAL`; o
- junto a un acabado MATE, TEXTURADO o GOFRADO.

El codigo y el acabado se retiran de la descripcion recuperada para que el
resumen no los repita. Los codigos desconocidos, las medidas, los numeros sin
contexto y las combinaciones ambiguas permanecen pendientes de confirmacion.

## Prevencion y verificacion

Se anadio una regresion con las dos lineas reales de RAL 8019 y casos negativos
para un codigo desconocido, un numero sin contexto y una dimension. El despliegue
debe verificar la propuesta sin confirmar ninguna escritura real.
