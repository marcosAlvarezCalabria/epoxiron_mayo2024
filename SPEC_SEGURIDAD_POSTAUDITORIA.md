# SPEC — Endurecimiento de seguridad post-auditoría

> Plan ejecutable de implementación para Epoxiron.
> **Fecha:** 2026-07-26
> **Estado:** en ejecución.
> **Rama obligatoria:** `feature/facturacion-odoo`.
> **Origen:** auditoría de seguridad de solo lectura del 2026-07-26 sobre el estado de cierre de Fase 1.

---

## 0. Objetivo y límites

Corregir los hallazgos de la auditoría de seguridad sin alterar el comportamiento funcional de
facturación, albaranes ni voz.

Quedan fuera de esta spec:

- fusionar en `main`;
- desplegar o activar nada en producción;
- cambios funcionales en facturación, clientes, albaranes o voz;
- rotación de secretos existentes (se hace a mano en el servidor si procede).

Validar en staging al terminar. Mantener las reglas no negociables de
`CODEX_FACTURAS_ODOO_FASE1.md` (arquitectura limpia, sin secretos en Git, sin placeholders,
tests antes de continuar).

---

## 1. Hallazgos y tareas

### 1.1 Dependencias vulnerables (prioridad alta)

En `api/`:

- `nodemailer` ≤ 9.0.0 — GHSA-p6gq-j5cr-w38f (lectura de archivos / SSRF). Actualizar a ≥ 9.0.3.
  Es cambio de versión mayor: revisar las llamadas existentes y probar el envío del informe diario.
- `morgan` 1.2.0–1.10.1 — GHSA-4vj7-5mj6-jm8m (log forging). Actualizar a la versión parcheada.

Criterio de aceptación: `npm audit --omit=dev` en `api/` sin vulnerabilidades altas ni moderadas.
La web estaba limpia en la auditoría inicial; el hallazgo posterior queda registrado en 1.6.

### 1.2 Rate limiting (prioridad media)

No existe limitación de peticiones en ningún endpoint.

- `POST /api/auth/login/google`: límite estricto por IP (por defecto 5 peticiones/minuto).
- Resto de `/api/*`: límite general razonable (por defecto 300 peticiones/minuto por IP).
- Respuesta `429` con mensaje neutro, sin detalles internos.
- Límites configurables por variables de entorno con valores por defecto seguros;
  documentarlas en `api/.env.example`.
- El bypass de Hermes por secreto compartido no debe quedar bloqueado por el límite general.

### 1.3 Comparación timing-safe del secreto Hermes (prioridad media)

`authMiddleware` y `requireHermesSecret` comparan el secreto con `===`.

- Sustituir por `crypto.timingSafeEqual` sobre buffers, comprobando antes longitudes iguales.
- Sin cambio de contrato: se siguen aceptando las cabeceras `X-Hermes-Secret` y
  `X-Epoxiron-Hermes-Secret`.

### 1.4 Fuga de detalle en errorHandler (prioridad media-baja)

Ante `PrismaClientInitializationError` y `PrismaClientKnownRequestError P1001` se devuelve
`error.message` al cliente, que puede contener host o cadena de conexión.

- Devolver únicamente `"Base de datos no disponible"` con `503`.
- Registrar el detalle completo solo en el log del servidor.
- Ninguna respuesta HTTP debe incluir rutas de sistema, hosts ni cadenas de conexión.

### 1.5 Caducidad del JWT (prioridad baja)

`JWT_EXPIRES_IN` está en `7d` y no existe revocación de tokens.

- Cambiar el valor por defecto documentado a `1d` en `api/.env.example` y en la documentación
  de despliegue.
- Sin cambios de código salvo que algo asuma 7 días.
- La revocación de tokens queda fuera de esta spec.

### 1.6 React Router vulnerable (hallazgo posterior, prioridad media)

El audit repetido el 2026-07-27 detectó avisos moderados publicados después de la auditoría inicial
en `react-router` y `react-router-dom` 6.30.3:

- GHSA-2j2x-hqr9-3h42 — redirección abierta mediante rutas que empiezan por `//`.
- GHSA-wrjc-x8rr-h8h6 — redirección abierta mediante barras invertidas.
- GHSA-jjmj-jmhj-qwj2 — redirección abierta con posible XSS.
- GHSA-337j-9hxr-rhxg — inyección de constructor en hidratación SSR.
- GHSA-qwww-vcr4-c8h2 — bypass CSRF en modo RSC de React Router 7.12.0–8.2.x,
  detectado al verificar la primera actualización.

- Actualizar `react-router-dom` a `7.18.1` para resolver los cuatro avisos aplicables a la SPA.
- Revisar todos los usos de `BrowserRouter`, `Routes`, `Route`, `Navigate`, `Link`, `NavLink`,
  `useNavigate`, `useLocation` y `useSearchParams`.
- Mantener las mismas rutas, redirecciones y protección de sesión.
- No introducir SSR ni cambiar el comportamiento funcional de la web.
- Aceptar temporalmente GHSA-qwww-vcr4-c8h2 porque afecta exclusivamente al modo RSC, que
  Epoxiron no utiliza. La excepción debe quedar registrada en `docs/SECURITY_EXCEPTIONS.md`.
- Prohibir la activación de RSC, Framework Mode y acciones de servidor sin una nueva revisión de
  seguridad y la retirada previa de esta excepción.

Criterio de aceptación: sin vulnerabilidades altas ni moderadas aplicables a la arquitectura SPA;
GHSA-qwww-vcr4-c8h2 es la única excepción admitida, lint, tests y build web en verde.

---

## 2. Estrategia de pruebas

- Tests nuevos para el rate limiting: bajo el límite pasa, sobre el límite responde `429`,
  el bypass de Hermes no queda bloqueado.
- Tests nuevos para el errorHandler: los errores de base de datos no exponen `error.message`.
- Test existente de `authMiddleware` ampliado para la comparación timing-safe
  (secreto correcto, incorrecto y de longitud distinta).
- Tests web existentes en verde tras la migración de React Router; añadir pruebas únicamente si
  la compatibilidad exige cambiar lógica de navegación.
- Suites completas de api y web en verde.

---

## 3. Comandos de verificación

```powershell
pnpm --dir api lint
pnpm --dir api test
pnpm --dir api build
pnpm --dir web lint
pnpm --dir web test
pnpm --dir web build
npm --prefix api audit --omit=dev
pnpm audit --prod # solo se admite GHSA-qwww-vcr4-c8h2 según la excepción documentada
git diff --check
git status --short
```

---

## 4. Validación en staging

1. Desplegar la rama en staging con la configuración actual.
2. Verificar login con Google de un usuario permitido.
3. Verificar el límite del login: superar el umbral desde una IP y recibir `429`; esperar y entrar.
4. Crear una factura desde albaranes revisados y descargar el PDF autenticado.
5. Verificar que Hermes sigue accediendo con su secreto.
6. Verificar que el envío del informe diario funciona con `nodemailer` actualizado
   (si `EMAIL_NOTIFICATIONS_ENABLED=true` en staging).
7. Documentar el resultado en `deploy/` siguiendo el formato de las fases anteriores.

---

## 5. Definition of Done

- `npm audit --omit=dev` en `api/` sin altas ni moderadas.
- Rate limiting activo, configurable y con tests.
- Comparaciones de secretos timing-safe.
- Errores de base de datos sin detalle interno en las respuestas.
- `JWT_EXPIRES_IN=1d` documentado como valor por defecto.
- React Router actualizado sin vulnerabilidades altas ni moderadas aplicables; se admite únicamente
  GHSA-qwww-vcr4-c8h2 mientras RSC permanezca fuera de la arquitectura.
- Lint, tests y build de api y web en verde.
- Staging validado según la sección 4 y resultado documentado en `deploy/`.
- `main` intacto; nada desplegado ni activado en producción.

Si alguna condición no se cumple, la spec permanece abierta.
