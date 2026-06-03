# Epoxiron

Monorepo con:

- `api/`: Node.js + TypeScript + Express + Prisma
- `web/`: React + Vite + Tailwind

## Requisitos

### Local (Windows)

- Node.js instalado
- `pnpm` disponible en terminal
- Docker Desktop arrancado

### Servidor (Linux)

- Ubuntu 22.04 o 24.04
- Docker Engine + Compose plugin
- Node.js
- `pnpm`

## Variables de entorno

### API local

Crea `api/.env` a partir de `api/.env.example`.

Valores mÃ­nimos:

```env
DATABASE_URL="postgresql://epoxiron:epoxiron123@localhost:5432/epoxiron"
PORT=3001
CORS_ORIGIN="http://localhost:5173"
HERMES_BASE_URL="http://localhost:8080"
HERMES_SHARED_SECRET="change-me"
HERMES_TIMEOUT_MS=15000
```

### Web local

`web/.env` es opcional. Si no existe, la web usa `http://localhost:3001` por defecto.

Si quieres fijarlo explÃ­citamente:

```env
VITE_API_URL="http://localhost:3001"
```

## Levantar en local

### 1. Instalar dependencias

```powershell
pnpm install
```

### 2. Arrancar Docker Desktop

Sin Docker Desktop levantado, PostgreSQL no arrancarÃ¡ y la API devolverÃ¡ error de base de datos no disponible.

Comprobar:

```powershell
docker ps
```

Si Docker Desktop no estÃ¡ abierto:

```powershell
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

### 3. Levantar PostgreSQL

Desde la raÃ­z del repo:

```powershell
docker compose up -d postgres
```

Comprobar estado:

```powershell
docker compose ps
```

### 4. Ejecutar migraciones y seed

```powershell
pnpm --filter @epoxiron/api prisma:migrate
pnpm --filter @epoxiron/api prisma:seed
```

### 5. Arrancar API y web en modo desarrollo

```powershell
pnpm dev
```

Servicios esperados:

- Web: `http://localhost:5173`
- API: `http://localhost:3001`
- Healthcheck API: `http://localhost:3001/health`

### 6. Parar PostgreSQL local

```powershell
docker compose stop postgres
```

## Problemas habituales en local

### Docker no responde

Si ves un error como:

```text
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine
```

significa que Docker Desktop no estÃ¡ arrancado.

### La API arranca pero falla al pedir datos

Si PostgreSQL no estÃ¡ arriba, la API responderÃ¡ `503` y el frontend mostrarÃ¡ el error en pantalla. El proceso ya no deberÃ­a caerse por esa causa.

## Levantar en servidor Linux

La opcion recomendada para VPS es `docker compose` con un contenedor por servicio.

Servicios:

- `postgres`
- `api`
- `web`
- `hermes`
- `engram`

Guia operativa completa:

- [deploy/VPS_DOCKER_COMPOSE.md](deploy/VPS_DOCKER_COMPOSE.md)

Comandos base:

```bash
cd /opt/epoxiron
docker compose -f deploy/docker-compose.vps.yml up -d --build
docker compose -f deploy/docker-compose.vps.yml exec api npx prisma migrate deploy --schema api/prisma/schema.prisma
docker compose -f deploy/docker-compose.vps.yml ps
```

## Comandos rÃ¡pidos

### Local

```powershell
docker compose up -d postgres
pnpm --filter @epoxiron/api prisma:migrate
pnpm --filter @epoxiron/api prisma:seed
pnpm dev
```

### Servidor

```bash
cd /opt/epoxiron
docker compose -f deploy/docker-compose.vps.yml up -d --build
docker compose -f deploy/docker-compose.vps.yml exec api npx prisma migrate deploy --schema api/prisma/schema.prisma
docker compose -f deploy/docker-compose.vps.yml ps
```
