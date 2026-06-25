# Deploy en Hostinger KVM 2

Esta guia asume:

- Ubuntu 22.04 o 24.04
- `Hermes Agent`, `Epoxiron API` y `web` conviviran en la misma maquina
- El trafico publico entrara por `Nginx`

## Arquitectura recomendada

- `Nginx` publico: `80/443`
- `web` en contenedor local: `127.0.0.1:8081`
- `api` en contenedor local: `127.0.0.1:3001`
- `Hermes Agent` como proceso `systemd`: `127.0.0.1:8080`
- `PostgreSQL` local o en contenedor: `127.0.0.1:5432`

`Hermes` no debe quedar expuesto publicamente. Solo `api` debe hablar con el.

## 1. Preparar el usuario de despliegue

```bash
sudo adduser --system --group --home /opt/epoxiron epoxiron
sudo mkdir -p /opt/epoxiron /etc/epoxiron /var/lib/hermes
sudo chown -R epoxiron:epoxiron /opt/epoxiron /var/lib/hermes
```

## 2. Instalar dependencias base

```bash
sudo apt update
sudo apt install -y git nginx docker.io docker-compose-plugin
sudo systemctl enable --now docker nginx
```

## 3. Clonar el proyecto

```bash
cd /opt
sudo git clone https://github.com/marcosAlvarezCalabria/epoxiron_mayo2024.git epoxiron
sudo chown -R epoxiron:epoxiron /opt/epoxiron
cd /opt/epoxiron
```

## 4. Preparar env de produccion

```bash
cp api/.env.production.example api/.env.production
cp deploy/env/vps.example .env
sudo cp deploy/hermes/hermes.env.example /etc/epoxiron/hermes.env
```

Editar:

- `api/.env.production`
- `/opt/epoxiron/.env`
- `/etc/epoxiron/hermes.env`

Valores minimos:

- `DATABASE_URL`
- `CORS_ORIGIN`
- `HERMES_BASE_URL=http://127.0.0.1:8080`
- `HERMES_SHARED_SECRET`
- `POSTGRES_PASSWORD`
- claves LLM de Hermes

`EPOXIRON_API_KEY` en Hermes debe ser el mismo valor que `HERMES_SHARED_SECRET` en la API.

## 5. Instalar Hermes Agent

Instalalo fuera del repo, como runtime independiente:

```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
```

Verifica:

```bash
hermes doctor
```

Configura su contexto:

- Copia o adapta [hermes/config/hermes.config.example.yaml](/opt/epoxiron/hermes/config/hermes.config.example.yaml)
- Usa `project_context_files` con `.hermes.md` y `AGENTS.md`
- Instala la skill del proyecto desde [hermes/skills/epoxiron-operations/SKILL.md](/opt/epoxiron/hermes/skills/epoxiron-operations/SKILL.md)

## 6. Levantar API, web y Postgres

```bash
docker compose -f deploy/docker-compose.vps.yml up -d --build
```

## 7. Ejecutar migraciones Prisma

Como la API vive en contenedor, ejecuta:

```bash
docker compose -f deploy/docker-compose.vps.yml exec api npx prisma migrate deploy --schema api/prisma/schema.prisma
```

## 8. Configurar systemd

```bash
sudo cp deploy/systemd/hermes.service /etc/systemd/system/
sudo cp deploy/systemd/epoxiron-api.service /etc/systemd/system/
sudo cp deploy/systemd/epoxiron-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hermes epoxiron-api epoxiron-web
```

## 9. Configurar Nginx

```bash
sudo cp deploy/nginx/epoxiron.conf /etc/nginx/sites-available/epoxiron.conf
sudo ln -s /etc/nginx/sites-available/epoxiron.conf /etc/nginx/sites-enabled/epoxiron.conf
sudo nginx -t
sudo systemctl reload nginx
```

Sustituye `app.example.com` por tu dominio real y provisiona TLS con Let's Encrypt.

## 10. Coexistencia con otros servicios

Para no romper otros servicios ya desplegados en el VPS:

- No reutilices puertos ya ocupados
- Manten `Hermes` en `127.0.0.1:8080`
- Manten `Epoxiron API` en `127.0.0.1:3001`
- Revisa si ya existe configuracion de `Nginx`; si si, añade un `server_name` distinto y no sobrescribas configuracion ajena
- Si ya hay otros stacks en Docker, evita nombres de red o servicio genericos compartidos

## 11. Verificaciones operativas

```bash
curl http://127.0.0.1:3001/health
curl http://127.0.0.1:8080
docker compose -f deploy/docker-compose.vps.yml ps
sudo systemctl status hermes epoxiron-api epoxiron-web
```

## 12. Actualizacion

```bash
cd /opt/epoxiron
git pull
docker compose -f deploy/docker-compose.vps.yml up -d --build
docker compose -f deploy/docker-compose.vps.yml exec api npx prisma migrate deploy --schema api/prisma/schema.prisma
sudo systemctl restart hermes epoxiron-api epoxiron-web
```
