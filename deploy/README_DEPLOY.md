# Deploy de Produccion

Este documento describe la infraestructura definida en el repo para produccion.

La fuente de verdad es:

- [deploy/docker-compose.vps.yml](C:/Users/Marcos/Documents/Codex/epoxiron%20mayo_2026/deploy/docker-compose.vps.yml)
- [api/Dockerfile](C:/Users/Marcos/Documents/Codex/epoxiron%20mayo_2026/api/Dockerfile)

## Servicios definidos

El `docker-compose.vps.yml` actual define 4 servicios:

- `postgres`
- `api`
- `engram`
- `hermes`

## Resumen de la arquitectura

- `postgres`: base de datos PostgreSQL 15
- `api`: backend Node.js/TypeScript con Prisma
- `engram`: servicio externo de memoria/indexado
- `hermes`: agente ejecutado como servicio Docker permanente en este compose

## Estado esperado en el VPS

VPS: `187.127.97.59`

Puertos publicados:

- `postgres`: `127.0.0.1:5432`
- `api`: `127.0.0.1:3001`
- `hermes`: `127.0.0.1:8642` y `127.0.0.1:9119`

`engram` no publica puertos al host. Solo queda accesible dentro de la red Docker `epoxiron_net`.

## Archivos clave en el VPS

```text
/opt/epoxiron/
  api/
    Dockerfile
    .env.production
  deploy/
    docker-compose.vps.yml
    engram/
      engram.env
    hermes/
      config.vps.example.yaml
      hermes.env.example
      skills/
        epoxiron-operations/
          SKILL.md
  README.md
  pnpm-lock.yaml
  package.json
```

Notas:

- `api/.env.production` es el `env_file` del servicio `api`
- `deploy/engram/engram.env` es el `env_file` del servicio `engram`
- `deploy/hermes/hermes.env` es el `env_file` esperado por el servicio `hermes`
- `deploy/hermes/config.vps.yaml` es el archivo que el contenedor de Hermes monta como `/opt/data/config.yaml`

## API Dockerfile

El backend usa un Dockerfile single-stage:

```dockerfile
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
```

## Comandos operativos

Desde `/opt/epoxiron`:

Levantar todo el stack:

```bash
docker compose -f deploy/docker-compose.vps.yml -p epoxiron up -d
```

Rebuild de la API:

```bash
docker compose -f deploy/docker-compose.vps.yml -p epoxiron up -d --build api
```

Aplicar migraciones Prisma en produccion:

```bash
docker compose -f deploy/docker-compose.vps.yml -p epoxiron exec api sh -lc 'cd /app/api && ./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma'
```

Regenerar Prisma Client dentro del contenedor:

```bash
docker compose -f deploy/docker-compose.vps.yml -p epoxiron exec api sh -lc 'cd /app/api && ./node_modules/.bin/prisma generate --schema prisma/schema.prisma'
```

Ver estado:

```bash
docker compose -f deploy/docker-compose.vps.yml -p epoxiron ps
```

Ver logs:

```bash
docker compose -f deploy/docker-compose.vps.yml -p epoxiron logs -f api
docker compose -f deploy/docker-compose.vps.yml -p epoxiron logs -f engram
docker compose -f deploy/docker-compose.vps.yml -p epoxiron logs -f hermes
```

Reiniciar solo la API:

```bash
docker compose -f deploy/docker-compose.vps.yml -p epoxiron restart api
```

## Cambios relevantes ya integrados

- `pnpm-lock.yaml` ya se trackea en Git
- `api/Dockerfile` ya no usa multi-stage
- el repo ya no usa `docker-compose.yml` en la raiz
- los prompts de Codex ya no viven en la raiz
- la skill `epoxiron-operations` vive en `deploy/hermes/skills/`

## Hermes

El compose actual define Hermes como servicio Docker permanente.

Montajes del servicio `hermes`:

- volumen `hermes_data` en `/opt/data`
- `./hermes/config.vps.yaml` en `/opt/data/config.yaml`
- `../` en `/workspace/epoxiron` como solo lectura

Si en un VPS concreto Hermes se ejecuta bajo demanda en vez de permanente, eso ya seria un desvio operativo respecto a este repo y deberia documentarse aparte.

## Notas tecnicas

- Usa `-p epoxiron` para fijar el prefijo de contenedores, red y volumenes
- `postgres_data` contiene datos persistentes de PostgreSQL
- `engram_data` contiene datos persistentes de Engram
- `hermes_data` contiene datos persistentes de Hermes

## Riesgos y observaciones

- Si `POSTGRES_PASSWORD=epoxiron123` sigue siendo real en produccion, conviene rotarlo
- Conviene mantener una sola fuente de verdad para secretos
- `package.json#pnpm.onlyBuiltDependencies` muestra warning en pnpm moderno y conviene migrarlo a la configuracion nueva cuando toque
