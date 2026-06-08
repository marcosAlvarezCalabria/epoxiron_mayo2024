# Deploy de Produccion

Este documento describe la infraestructura definida en el repo para produccion.

La fuente de verdad es:

- [deploy/docker-compose.vps.yml](C:/Users/Marcos/Documents/Codex/epoxiron%20mayo_2026/deploy/docker-compose.vps.yml)
- [api/Dockerfile](C:/Users/Marcos/Documents/Codex/epoxiron%20mayo_2026/api/Dockerfile)

## Servicios definidos

El `docker-compose.vps.yml` actual define 3 servicios:

- `postgres`
- `api`
- `hermes`

## Resumen de la arquitectura

- `postgres`: base de datos PostgreSQL 15
- `api`: backend Node.js/TypeScript con Prisma
- `hermes`: agente ejecutado como servicio Docker permanente en este compose

## Estado esperado en el VPS

VPS: `187.127.97.59`

Puertos publicados:

- `postgres`: `127.0.0.1:5432`
- `api`: `127.0.0.1:3001`
- `hermes`: `127.0.0.1:8642` y `127.0.0.1:9119`

## Archivos clave en el VPS

```text
/opt/epoxiron/
  api/
    Dockerfile
    .env.production
  deploy/
    docker-compose.vps.yml
    hermes/
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
- `deploy/hermes/hermes.env` es el `env_file` esperado por el servicio `hermes`

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

- `/root/.hermes` en `/root/.hermes`

Configuracion relevante del servicio:

- imagen `epoxiron-hermes:latest`
- `container_name` `hermes-gateway`
- comando `["/usr/local/bin/hermes", "gateway", "run"]`
- `env_file` en `deploy/hermes/hermes.env`

`deploy/hermes/hermes.env` es la fuente de verdad del secreto y variables de runtime del servicio `hermes` en produccion.

## Seguridad y Autenticacion

### Resumen

El 2026-06-07 se completo la capa de autenticacion y limpieza de configuracion para produccion.

### 1. Limpieza de variables de entorno

Las variables de la API ya no dependen de una imagen Docker antigua con `ENV` horneados.

- la configuracion real vive en `/opt/epoxiron/api/.env.production`
- ese fichero no esta en el repo y nunca debe subirse a Git
- el contenedor de la API carga variables en runtime desde ese fichero

### 2. Google OAuth y JWT en la API

- `POST /api/auth/login/google` recibe el `credential` de Google Identity Services
- la API verifica el token con Google
- la API valida que el email exista en `ALLOWED_EMAILS`
- la API devuelve un JWT propio
- `authMiddleware` protege todas las rutas `/api/*`

Bypasses permitidos:

- `Authorization: Bearer <JWT>` para usuarios web autenticados
- `X-Hermes-Secret` o `X-Epoxiron-Hermes-Secret` para Epoxi/Hermes

### 3. Web con login protegido

- la web expone `/login`
- `ProtectedRoute` redirige a `/login` cuando no hay sesion
- el JWT se guarda en `sessionStorage`
- el cliente HTTP del frontend añade el `Bearer` automaticamente
- solo los emails definidos en `ALLOWED_EMAILS` pueden entrar

### 4. Variables nuevas en `api/.env.production`

Variables relevantes:

```env
GOOGLE_CLIENT_ID=20604165419-dps72fkkha457807c56d39cqlj5g2j4v.apps.googleusercontent.com
JWT_SECRET=<generado con openssl rand -hex 32>
JWT_EXPIRES_IN=7d
ALLOWED_EMAILS=calalva82@gmail.com,epoxiron@gmail.com
HERMES_SHARED_SECRET=<generado con openssl rand -hex 32>
GOOGLE_DRIVE_ENABLED=false
```

### 5. Google Drive desactivado temporalmente

La subida del PDF diario a Google Drive sigue desactivada con `GOOGLE_DRIVE_ENABLED=false` hasta decidir la integracion final.

Pendiente:

- retomar una estrategia con `rclone`
- o configurar correctamente la Service Account de Google

### 6. Epoxi y bypass de autenticacion

Epoxi no usa Google OAuth. Accede a la API con secreto compartido.

Ejemplo de llamada:

```bash
curl -s -H "X-Hermes-Secret: $EPOXIRON_SECRET" http://epoxiron-api-1:3001/api/customers
```

Notas:

- `deploy/hermes/hermes.env` es la fuente de verdad del secreto del servicio `hermes`
- la skill de Epoxi debe incluir el header en todos sus `curl`

### 7. `hermes-gateway` en docker-compose

El contenedor `hermes-gateway` ya esta gestionado por `deploy/docker-compose.vps.yml` como el resto del stack.

Configuracion esperada:

```yaml
hermes:
  image: epoxiron-hermes:latest
  container_name: hermes-gateway
  restart: unless-stopped
  command: ["/usr/local/bin/hermes", "gateway", "run"]
  env_file:
    - path: ./hermes/hermes.env
      required: false
  depends_on:
    api:
      condition: service_started
  volumes:
    - /root/.hermes:/root/.hermes
  networks:
    - epoxiron_net
```

### 8. Cloudflare Pages

Variables de entorno configuradas en Cloudflare Pages:

```env
VITE_API_URL=https://api.wwwmarcos-alvarez.com
VITE_GOOGLE_CLIENT_ID=20604165419-dps72fkkha457807c56d39cqlj5g2j4v.apps.googleusercontent.com
```

### Estado actual

- web protegida con login Google
- API protegida con JWT
- Epoxi funciona con `X-Hermes-Secret`
- Google Drive sigue desactivado temporalmente

## Notas tecnicas

- Usa `-p epoxiron` para fijar el prefijo de contenedores, red y volumenes
- `postgres_data` contiene datos persistentes de PostgreSQL
- `hermes_data` contiene datos persistentes de Hermes

## Riesgos y observaciones

- Si `POSTGRES_PASSWORD=epoxiron123` sigue siendo real en produccion, conviene rotarlo
- Conviene mantener una sola fuente de verdad para secretos
- `package.json#pnpm.onlyBuiltDependencies` muestra warning en pnpm moderno y conviene migrarlo a la configuracion nueva cuando toque
