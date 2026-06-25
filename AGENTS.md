# Epoxiron Agent Instructions

## Project

Monorepo con:

- `api/`: Node.js + TypeScript + Express + Prisma
- `web/`: React + Vite + Tailwind
- `deploy/`: infraestructura y operacion
- `docs/`: specs y documentacion auxiliar

## Business Rules

- La logica de precios vive solo en la API.
- Hermes nunca escribe directamente en la base de datos.
- Las escrituras requieren confirmacion explicita del usuario.
- El backend es el unico puente entre la UI y Hermes.
- La entrada por voz solo pre-rellena el formulario; no crea albaranes automaticamente.

## Conventions

- TypeScript `strict: true` en API y web.
- Arquitectura limpia por capas.
- Sin `any` salvo justificacion explicita.
- Tests minimos para logica critica.
- Las rutas bajo `/api/*` usan `authMiddleware`, salvo excepciones registradas de forma explicita.

## Current Structure

### API

- `api/src/application/use-cases/`
- `api/src/domain/`
- `api/src/infrastructure/repositories/`
- `api/src/infrastructure/services/`
- `api/src/routes/`
- `api/src/controllers/`
- `api/src/schemas/`
- `api/src/config/env.ts`

### Voice Flow

- `api/src/routes/voice.routes.ts`
- `api/src/controllers/VoiceController.ts`
- `api/src/application/use-cases/parseVoiceAlbaran.ts`
- `api/src/application/use-cases/parseVoiceAlbaranAudio.ts`
- `api/src/infrastructure/services/VoiceAlbaranParserFactory.ts`
- `web/src/components/VoiceAlbaranButton.tsx`
- `web/src/features/voice/voiceAlbaran.ts`
- `web/src/pages/DeliveryNotesPage.tsx`

### Hermes Surface

- `api/src/routes/hermesTools.routes.ts`
- `api/src/middleware/requireHermesSecret.ts`
- `deploy/hermes/`

## Notes

- `api/src/integrations/hermes/` no existe en el estado actual del repo.
- `web/src/features/hermes/` no existe en el estado actual del repo.
- La documentacion funcional de voz vive en `docs/VOICE_ALBARAN_SPEC.md`.
