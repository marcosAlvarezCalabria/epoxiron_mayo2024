# Epoxiron Agent Instructions

## Project

Monorepo con:

- `api/`: Node.js + TypeScript + Express + Prisma
- `web/`: React + Vite + Tailwind

## Business Rules

- La lógica de precios vive solo en la API.
- Hermes nunca escribe directamente en la base de datos.
- Las escrituras requieren confirmación explícita del usuario.
- El backend es el único puente entre la UI y Hermes.

## Conventions

- TypeScript `strict: true`
- Arquitectura limpia por capas
- Sin `any` salvo justificación explícita
- Tests mínimos para lógica crítica

## Useful Paths

- `api/src/application/use-cases/`
- `api/src/integrations/hermes/`
- `api/src/routes/hermesTools.routes.ts`
- `web/src/features/hermes/`
