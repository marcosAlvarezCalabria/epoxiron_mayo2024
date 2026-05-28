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

Valores mínimos:

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

Si quieres fijarlo explícitamente:

```env
VITE_API_URL="http://localhost:3001"
```

## Levantar en local

### 1. Instalar dependencias

```powershell
pnpm install
```

### 2. Arrancar Docker Desktop

Sin Docker Desktop levantado, PostgreSQL no arrancará y la API devolverá error de base de datos no disponible.

Comprobar:

```powershell
docker ps
```

Si Docker Desktop no está abierto:

```powershell
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

### 3. Levantar PostgreSQL

Desde la raíz del repo:

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

significa que Docker Desktop no está arrancado.

### La API arranca pero falla al pedir datos

Si PostgreSQL no está arriba, la API responderá `503` y el frontend mostrará el error en pantalla. El proceso ya no debería caerse por esa causa.

## Levantar en servidor Linux

Este repo ya trae un flujo de despliegue basado en `docker compose` y `systemd`. No hay un script `pnpm --filter @epoxiron/api start` definido hoy; por tanto, el camino soportado actualmente es contenedores + servicios del sistema.

### 1. Verificar Docker

```bash
sudo systemctl status docker
```

Si no estuviera activo:

```bash
sudo systemctl start docker
sudo systemctl enable docker
```

### 2. Entrar en el repo

```bash
cd /opt/epoxiron
```

### 3. Instalar dependencias del monorepo

```bash
pnpm install
```

### 4. Preparar variables de entorno

```bash
cp api/.env.example api/.env.production
cp deploy/env/vps.example .env
```

Editar como mínimo:

- `api/.env.production`
- `.env`

Valores críticos:

- `DATABASE_URL`
- `POSTGRES_PASSWORD`
- `CORS_ORIGIN`
- `HERMES_BASE_URL`
- `HERMES_SHARED_SECRET`
- `VITE_API_URL`

### 5. Levantar PostgreSQL

```bash
docker compose -f deploy/docker-compose.vps.yml up -d postgres
```

### 6. Levantar API y web

```bash
docker compose -f deploy/docker-compose.vps.yml up -d --build api web
```

Si prefieres levantar todo junto:

```bash
docker compose -f deploy/docker-compose.vps.yml up -d --build
```

### 7. Ejecutar migraciones Prisma

Con la base ya levantada:

```bash
docker compose -f deploy/docker-compose.vps.yml exec api npx prisma migrate deploy --schema api/prisma/schema.prisma
```

### 8. Verificar estado

```bash
docker compose -f deploy/docker-compose.vps.yml ps
curl http://127.0.0.1:3001/health
```

### 9. Hacer persistente el arranque con systemd

El repo ya incluye unidades en `deploy/systemd/`.

Instalación:

```bash
sudo cp deploy/systemd/hermes.service /etc/systemd/system/
sudo cp deploy/systemd/epoxiron-api.service /etc/systemd/system/
sudo cp deploy/systemd/epoxiron-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hermes epoxiron-api epoxiron-web
```

Verificación:

```bash
sudo systemctl status hermes epoxiron-api epoxiron-web
```

### 10. Actualizar una instalación existente

```bash
cd /opt/epoxiron
git pull
pnpm install
docker compose -f deploy/docker-compose.vps.yml up -d --build
docker compose -f deploy/docker-compose.vps.yml exec api npx prisma migrate deploy --schema api/prisma/schema.prisma
sudo systemctl restart hermes epoxiron-api epoxiron-web
```

## Comandos rápidos

### Local

```powershell
docker compose up -d postgres
pnpm --filter @epoxiron/api prisma:migrate
pnpm --filter @epoxiron/api prisma:seed
pnpm dev
```

### Servidor

```bash
sudo systemctl enable --now docker
cd /opt/epoxiron
pnpm install
docker compose -f deploy/docker-compose.vps.yml up -d --build
docker compose -f deploy/docker-compose.vps.yml exec api npx prisma migrate deploy --schema api/prisma/schema.prisma
sudo systemctl enable --now hermes epoxiron-api epoxiron-web
```
