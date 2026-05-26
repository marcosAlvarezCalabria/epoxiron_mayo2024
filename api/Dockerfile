FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY api/package.json ./api/package.json
RUN pnpm install --filter @epoxiron/api... --frozen-lockfile

FROM deps AS build
COPY api ./api
RUN pnpm --filter @epoxiron/api prisma:generate
RUN pnpm --filter @epoxiron/api build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY api/package.json ./api/package.json
RUN pnpm install --filter @epoxiron/api... --prod --frozen-lockfile
COPY --from=build /app/api/prisma ./api/prisma
COPY --from=build /app/api/dist ./api/dist
EXPOSE 3001
CMD ["node", "api/dist/src/server.js"]

