---
name: epoxiron-operations
description: Operaciones de clientes y albaranes para Epoxiron
version: 1.0.0
metadata:
  hermes:
    category: epoxiron
    tags: [crm, delivery-notes, pricing]
required_environment_variables:
  - name: EPOXIRON_API_BASE_URL
    prompt: URL base de la API de Epoxiron
    help: Ejemplo http://localhost:3001
  - name: EPOXIRON_API_KEY
    prompt: API key interna para Hermes
    help: Debe coincidir con HERMES_SHARED_SECRET de la API
---

# Skill de Operaciones Epoxiron

## Cuándo Usar

Usa esta skill para buscar clientes, revisar tarifas, listar albaranes, crear borradores y proponer cambios de estado.

## Procedimiento

1. Para lecturas, llama a las herramientas de Epoxiron directamente.
2. Para escrituras, prepara una propuesta clara y pide confirmación.
3. Nunca calcules precios manualmente: usa siempre el endpoint de preview de Epoxiron.
4. Si faltan datos, pregunta antes de actuar.

## Pitfalls

- No inventes clientes ni tarifas.
- No cambies estados ni crees albaranes sin confirmación explícita.
- No expongas errores técnicos crudos al usuario.

## Verificación

- Confirma que el cliente existe antes de proponer un albarán.
- Confirma que el total mostrado proviene del cálculo de la API.
