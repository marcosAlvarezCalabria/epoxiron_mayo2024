# Epoxiron

Monorepo de Epoxiron.

- `api/`: Node.js + TypeScript + Express + Prisma
- `web/`: React + Vite + Tailwind
- `deploy/`: infraestructura y operacion de produccion
- `docs/`: prompts y documentacion auxiliar

## Documentacion

- Infraestructura y despliegue: [deploy/README_DEPLOY.md](C:/Users/Marcos/Documents/Codex/epoxiron%20mayo_2026/deploy/README_DEPLOY.md)

## Requisitos locales

- Node.js
- Docker Desktop
- `pnpm`

## Variables de entorno

### API local

Crea `api/.env` a partir de `api/.env.example`.

Valores minimos:

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

Si quieres fijarlo explicitamente:

```env
VITE_API_URL="http://localhost:3001"
```

## Desarrollo local

### 1. Instalar dependencias

```powershell
pnpm install
```

### 2. Arrancar Docker Desktop

Comprobar:

```powershell
docker ps
```

Si Docker Desktop no esta abierto:

```powershell
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

### 3. Levantar PostgreSQL local

Este repo ya no tiene `docker-compose.yml` en la raiz. Para desarrollo local, arranca PostgreSQL manualmente:

```powershell
docker run -d --name epoxiron-local-postgres `
  -e POSTGRES_DB=epoxiron `
  -e POSTGRES_USER=epoxiron `
  -e POSTGRES_PASSWORD=epoxiron123 `
  -p 127.0.0.1:5432:5432 `
  -v epoxiron_local_postgres_data:/var/lib/postgresql/data `
  postgres:15
```

Si el contenedor ya existe y esta parado:

```powershell
docker start epoxiron-local-postgres
```

Comprobar estado:

```powershell
docker ps
```

### 4. Ejecutar migraciones y seed

```powershell
.\api\node_modules\.bin\prisma.CMD migrate dev --schema api\prisma\schema.prisma
.\node_modules\.bin\pnpm.CMD --filter @epoxiron/api prisma:seed
```

### 5. Arrancar API y web

```powershell
.\node_modules\.bin\pnpm.CMD dev
```

Servicios esperados:

- Web: `http://localhost:5173`
- API: `http://localhost:3001`
- Healthcheck API: `http://localhost:3001/health`

### 6. Parar PostgreSQL local

```powershell
docker stop epoxiron-local-postgres
```

## Problemas habituales

### Docker no responde

Si ves un error como:

```text
failed to connect to the docker API at npipe:////./pipe/docker_engine
```

significa que Docker Desktop no esta arrancado o el daemon todavia no esta listo.

### La API devuelve 503

Si PostgreSQL no esta arriba, la API respondera `503` en endpoints como `/api/customers` o `/api/delivery-notes`.

### Prisma no alinea la base local

Si has anadido una migracion nueva, ejecuta siempre:

```powershell
.\api\node_modules\.bin\prisma.CMD migrate dev --schema api\prisma\schema.prisma
```

## Comandos rapidos

```powershell
docker start epoxiron-local-postgres
.\api\node_modules\.bin\prisma.CMD migrate dev --schema api\prisma\schema.prisma
.\node_modules\.bin\pnpm.CMD --filter @epoxiron/api prisma:seed
.\node_modules\.bin\pnpm.CMD dev
```

## Produccion

La operacion de produccion, el Compose del VPS y la configuracion de Hermes y Engram estan documentados en:

- [deploy/README_DEPLOY.md](C:/Users/Marcos/Documents/Codex/epoxiron%20mayo_2026/deploy/README_DEPLOY.md)
