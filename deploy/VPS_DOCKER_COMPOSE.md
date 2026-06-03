# VPS Docker Compose

Objetivo: ejecutar Epoxiron en el VPS con un contenedor por servicio.

Servicios:

- `postgres`
- `api`
- `web`
- `hermes`
- `engram`

`web` sigue siendo un servicio separado. Si quieres proxy inverso y TLS dentro de Docker, eso seria un sexto contenedor.

## 1. Requisitos

En el VPS:

```bash
sudo apt update
sudo apt install -y git docker.io docker-compose-plugin
sudo systemctl enable --now docker
```

## 2. Repo

```bash
cd /opt
git clone <TU_REPO> epoxiron
cd /opt/epoxiron
```

## 3. Archivos de entorno

```bash
cp deploy/env/vps.example .env
cp api/.env.production.example api/.env.production
cp deploy/hermes/hermes.env.example deploy/hermes/hermes.env
cp deploy/hermes/config.vps.example.yaml deploy/hermes/config.vps.yaml
cp deploy/engram/engram.env.example deploy/engram/engram.env
```

## 4. Ajustes obligatorios

Edita estos archivos:

- `.env`
- `api/.env.production`
- `deploy/hermes/hermes.env`
- `deploy/hermes/config.vps.yaml`
- `deploy/engram/engram.env`

Valores criticos:

- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `CORS_ORIGIN`
- `VITE_API_URL`
- `HERMES_SHARED_SECRET`
- `EPOXIRON_API_KEY`
- claves del proveedor LLM de Hermes
- SMTP si quieres envio de PDF diario

Regla importante:

- `api/.env.production` debe usar `postgres` como host de base de datos
- Hermes debe usar `http://api:3001/api/hermes-tools`

## 5. Levantar la plataforma

```bash
docker compose -f deploy/docker-compose.vps.yml up -d --build
```

## 6. Migraciones Prisma

```bash
docker compose -f deploy/docker-compose.vps.yml exec api npx prisma migrate deploy --schema api/prisma/schema.prisma
```

## 7. Comprobar estado

```bash
docker compose -f deploy/docker-compose.vps.yml ps
docker compose -f deploy/docker-compose.vps.yml logs api --tail 100
docker compose -f deploy/docker-compose.vps.yml logs hermes --tail 100
docker compose -f deploy/docker-compose.vps.yml logs engram --tail 100
curl http://127.0.0.1:3001/health
```

## 8. Actualizar

```bash
cd /opt/epoxiron
git pull
docker compose -f deploy/docker-compose.vps.yml up -d --build
docker compose -f deploy/docker-compose.vps.yml exec api npx prisma migrate deploy --schema api/prisma/schema.prisma
```

## 9. Apagar PM2 antiguo

Cuando el stack Docker este validado:

```bash
pm2 stop epoxiron-api
pm2 delete epoxiron-api
pm2 save
```

Haz esto solo cuando la API en Docker ya responda bien.

## 10. Notas

- `engram` queda con volumen persistente `engram_data`
- `hermes` queda con volumen persistente `hermes_data`
- `postgres` queda con volumen persistente `postgres_data`
- los servicios se hablan por nombre interno de Docker: `postgres`, `api`, `engram`, `hermes`
- este stack deja `api`, `web` y `hermes` publicados en `127.0.0.1`; si quieres cero procesos en el host tambien para la entrada HTTP/HTTPS, mete un `caddy` o `nginx` como contenedor extra delante
