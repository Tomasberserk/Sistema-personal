# CONTEXT.md — Sistema Personal 2.0

Este archivo es el **contexto operativo del repositorio** para cualquier desarrollador o agente de IA que trabaje en él.

Para la visión estratégica completa, leer primero [`docs/DOCUMENTO_RECTOR.md`](docs/DOCUMENTO_RECTOR.md).  
Para el orden de trabajo actual, leer [`docs/ROADMAP.md`](docs/ROADMAP.md) y [`docs/TASKS.md`](docs/TASKS.md).

## 1. Regla principal para agentes de IA

Antes de modificar código:

1. Leer este archivo.
2. Leer `docs/DOCUMENTO_RECTOR.md`.
3. Revisar `docs/ROADMAP.md`.
4. Revisar `docs/TASKS.md` y las ADR relevantes.
5. Inspeccionar el código real antes de asumir que una funcionalidad existe o funciona.
6. No implementar módulos nuevos solo porque aparezcan como "pendientes" en documentación antigua.

Si una propuesta contradice el Documento Rector, señalarlo antes de implementarla.

## 2. Qué es el proyecto

Sistema Personal 2.0 es un sistema de gestión personal all-in-one. La primera etapa es un sistema manual y visual que el usuario pueda utilizar diariamente.

La visión futura es añadir un agente capaz de interpretar lenguaje natural y operar sobre las capacidades existentes del sistema.

El dashboard **no es el producto completo**: es una de las interfaces del sistema.

## 3. Stack actual

- Backend: Python + FastAPI.
- Base de datos: SQLite en desarrollo / PostgreSQL en producción, seleccionado mediante `DATABASE_URL`.
- Frontend real: React + TypeScript + Vite en `artifacts/jarvis/`.
- API client: generado con Orval a partir de OpenAPI.
- Hosting/despliegue: el repositorio contiene configuración para Render y el frontend se ha desplegado en Vercel.
- Moneda: COP, formato `es-CO`.
- UX: responsive y mobile-first.

## 4. Estructura importante

```text
/backend          FastAPI, modelos, rutas y lógica backend
/artifacts/jarvis Frontend React real
/frontend         No es el frontend principal actual
/lib/db           Infraestructura relacionada con DB; revisar antes de modificar
/scripts           Scripts auxiliares
/docs              Documentación rectora, roadmap, tareas y decisiones
```

No mover el frontend real de `artifacts/jarvis/` sin una decisión explícita.

## 5. Estado funcional conocido

### Finanzas

Existe:

- Ingresos.
- Gastos fijos.
- Gastos variables.
- Categorías.
- Resumen mensual.
- Resumen por categoría.

La evolución inmediata debe incorporar la distinción de **dónde están los recursos dentro de Finanzas**, sin crear un módulo separado:

- efectivo/billetes,
- efectivo/monedas,
- cuentas bancarias,
- tarjetas,
- billeteras digitales,
- otros medios.

La transferencia entre medios debe distinguirse de un gasto.

### Moto

Existe configuración y cálculo del estado del aceite basado en kilometraje, registro de cambio de aceite y configuración del intervalo/alerta.

El kilometraje valida que el odómetro no retroceda.

La conexión futura debe permitir que combustible y mantenimiento se relacionen con Finanzas.

### Hábitos

Existe CRUD, registro diario, rachas y resumen por fecha.

Los hábitos deben ser definidos por el usuario. No añadir hábitos genéricos automáticamente.

### Rutina / Agenda

Existe CRUD de bloques y vista día/semana.

**Problema conocido:** actualmente existe una rutina seed/hardcodeada. Esto contradice la nueva filosofía de producto y debe tratarse como deuda de Fase 1.

No agregar más bloques genéricos hasta redefinir este comportamiento.

## 6. Base de datos

La capa actual soporta:

- SQLite local.
- PostgreSQL mediante `DATABASE_URL`.

Hay compatibilidad específica entre ambos motores. Antes de cambiar SQL, migraciones o schemas, revisar la implementación existente en backend y mantener pruebas para ambos motores cuando sea posible.

No asumir que Supabase/PostgreSQL está correctamente configurado en producción solo porque el código lo soporte: debe verificarse mediante pruebas/health checks reales.

## 7. Principios de implementación

- Preferir reutilización sobre duplicación.
- Mantener la lógica de negocio en backend/servicios, no en componentes visuales.
- Mantener las interfaces desacopladas de la lógica de dominio.
- Usar la API como contrato entre frontend y backend.
- Regenerar el cliente cuando cambie el OpenAPI.
- Mantener mobile-first.
- No introducir dependencias innecesarias.
- No sobrearquitecturar para el agente futuro.
- No implementar event sourcing completo solo por la visión futura; primero construir relaciones y capacidades de dominio limpias.
- Toda automatización debe tener una razón de producto clara.

## 8. Convenciones del producto

- Idioma de interfaz: español.
- Moneda: COP.
- Formato local: `es-CO`.
- Evitar textos genéricos o datos ficticios presentados como reales.
- Las rutinas, hábitos y preferencias personales deben provenir del usuario o de una configuración explícita.
- El sistema no debe inventar datos personales.

## 9. Orden de prioridad actual

1. Consolidar lo existente.
2. Eliminar/replantear la rutina hardcodeada.
3. Verificar la base de datos PostgreSQL/Supabase.
4. Incorporar medios/ubicaciones de dinero dentro de Finanzas.
5. Actualizar y estabilizar los contratos API.
6. Conectar módulos existentes.
7. Probar el sistema en uso real.
8. Continuar módulos pendientes según evidencia.
9. Construir el primer agente únicamente cuando existan casos de uso validados.

## 10. Regla para nuevas funcionalidades

Antes de implementar una funcionalidad, responder:

- ¿Qué problema real resuelve?
- ¿Dónde encaja en Sistema Personal 2.0?
- ¿Puede reutilizar una capacidad existente?
- ¿Conecta módulos?
- ¿Aumenta complejidad de forma justificada?
- ¿Pertenece a la fase actual?

Si no hay una respuesta clara, no implementarla todavía.

## 11. Documentación relacionada

- `docs/DOCUMENTO_RECTOR.md` — visión y principios.
- `docs/ROADMAP.md` — fases y prioridades.
- `docs/TASKS.md` — tareas ejecutables.
- `docs/adr/` — decisiones técnicas importantes.

El Documento Rector tiene precedencia sobre cualquier roadmap histórico incluido en archivos antiguos.
