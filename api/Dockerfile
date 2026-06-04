FROM node:22-alpine
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY api/package.json ./api/package.json
RUN pnpm install --filter @epoxiron/api... --frozen-lockfile

COPY api ./api
RUN pnpm --filter @epoxiron/api prisma:generate
RUN pnpm --filter @epoxiron/api build

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "api/dist/src/server.js"]
