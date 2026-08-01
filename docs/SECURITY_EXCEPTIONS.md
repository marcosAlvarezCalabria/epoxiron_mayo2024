# Excepciones de seguridad

## GHSA-qwww-vcr4-c8h2 — React Router RSC

- **Estado:** aceptada temporalmente.
- **Fecha de aceptación:** 2026-07-27.
- **Dependencia:** `react-router` a través de `react-router-dom` 7.18.1.
- **Severidad publicada:** alta.
- **Superficie afectada:** acciones de servidor en React Server Components (RSC).

### Justificación

Epoxiron es una SPA estática construida con Vite. React y React Router se ejecutan en el navegador,
la web consume una API Express independiente bajo `/api/*` y no existe servidor React, hidratación
RSC, Framework Mode ni acciones de servidor. La superficie descrita por el aviso no está presente
en la arquitectura desplegada.

### Controles compensatorios

- Mantener `BrowserRouter` en modo declarativo y el build estático de Vite.
- No añadir configuración RSC, Framework Mode ni acciones de servidor.
- Mantener todas las operaciones con estado y autenticación en la API Express.
- Exigir una nueva revisión de seguridad antes de introducir renderizado React en servidor.
- Revisar el aviso en cada actualización de dependencias y retirar la excepción cuando exista una
  versión estable corregida compatible.

### Condiciones de invalidez

Esta excepción deja de ser válida inmediatamente si se introduce cualquiera de estos elementos:

- servidor React o renderizado React en servidor;
- React Server Components;
- Framework Mode de React Router;
- loaders o actions ejecutados en servidor;
- endpoints de acciones RSC.

Si ocurre cualquiera de esas condiciones, el despliegue debe bloquearse hasta actualizar a una
versión corregida y repetir la auditoría.
