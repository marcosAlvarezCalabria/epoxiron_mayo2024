FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY web/package.json ./web/package.json
RUN pnpm install --filter @epoxiron/web... --frozen-lockfile

FROM deps AS build
COPY web ./web
ARG VITE_API_URL=https://app.example.com
ENV VITE_API_URL=${VITE_API_URL}
RUN pnpm --filter @epoxiron/web build

FROM nginx:1.27-alpine AS runtime
COPY deploy/nginx/web.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80

