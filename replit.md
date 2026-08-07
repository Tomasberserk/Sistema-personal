# Jarvis

Jarvis es un sistema personal de gestión financiera para registrar ingresos,
gastos, kilometraje y el saldo del mes en pesos colombianos.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `uv run --project . uvicorn backend.main:app --reload` — run the FastAPI backend directly
- SQLite local: `jarvis.sqlite3` (se crea automáticamente y no se versiona)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Python 3.13 + FastAPI + Uvicorn
- DB: SQLite
- Frontend: React + Vite + TanStack Query
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `backend/main.py` — aplicación FastAPI, modelos Pydantic, inicialización SQLite y endpoints.
- `artifacts/jarvis/src/App.tsx` — dashboard React, formularios y CRUD conectado a los hooks generados.
- `artifacts/jarvis/src/index.css` — tema visual responsive de Jarvis.
- `lib/api-spec/openapi.yaml` — contrato fuente para hooks y tipos del cliente.
- `frontend/README.md` — referencia de la separación backend/frontend solicitada.

## Architecture decisions

- FastAPI sirve las rutas bajo `/api` para que el frontend use el proxy del workspace sin URLs hardcodeadas.
- SQLite se usa como persistencia local inicial; las tablas y datos iniciales se crean al iniciar.
- Los gastos fijos `mensual` se suman automáticamente al resumen; los `por_kilometraje` representan configuración y no se cobran automáticamente.
- La interfaz usa React Query para refrescar listas y resumen después de cada mutación.

## Product

- Dashboard mensual con saldo, ingresos, gastos fijos y gastos variables.
- CRUD completo de ingresos, gastos fijos, gastos variables y kilometraje.
- Formularios responsive en español y valores monetarios formateados en COP.

## User preferences

- La app se llama Jarvis.
- La interfaz debe estar en español y los montos deben mostrarse en COP.

## Gotchas

- Si cambia el contrato OpenAPI, ejecutar codegen antes de revisar el frontend.
- El backend usa `jarvis.sqlite3`; borrar ese archivo reinicia los datos iniciales.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
