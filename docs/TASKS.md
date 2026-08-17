# TASKS.md — Sistema Personal 2.0

Este archivo contiene tareas ejecutables. Las tareas deben realizarse en orden salvo decisión explícita.

## P0 — Consolidación

### T001 — Auditoría del repositorio [COMPLETADA]

**Objetivo:** producir un inventario real de frontend, backend, rutas API, tablas, seeds, componentes y documentación.

**Resultado:** Inventario completado y fuente rectora consolidada en `docs/DOCUMENTO_RECTOR.md` y `CONTEXT.md`.

### T002 — Eliminar/replantear rutina hardcodeada [COMPLETADA]

**Objetivo:** impedir que el sistema imponga una rutina personal genérica.

**Resultado:** Se retiró `DEFAULT_BLOQUES` y la inicialización forzada en `init_db()`. Las instalaciones nuevas inician vacías y los bloques los crea el usuario manualmente. Validado con tests de no regresión.

### T003 — Verificar PostgreSQL/Supabase [COMPLETADA]

**Objetivo:** comprobar que la capa PostgreSQL funciona de forma equivalente a SQLite en los flujos relevantes.

**Resultado:** Se desacopló la detección estática de base de datos (`_is_postgres()` dinámico), se validaron schemas idénticos, RETURNING ids, placeholders y suite completa de tests automatizados (`test_sqlite_suite.py` y `test_rutina.py`).

### T004 — Diseñar medios de dinero dentro de Finanzas [COMPLETADA]

**Objetivo:** permitir distinguir dónde están los recursos sin crear un módulo independiente.

**Resultado:** Diseñado en ADR-004 e implementado con tabla `medios_pago` y `transferencias_medios`.

### T005 — Actualizar contratos API y cliente [COMPLETADA]

**Objetivo:** mantener OpenAPI y cliente frontend sincronizados después de cambios de backend.

**Resultado:** OpenAPI alineado, frontend TypeScript/React en `artifacts/jarvis` pasando `typecheck` y `vite build` al 100% sin errores.

## P1 — Conexión

### T006 — Conectar Moto y Finanzas [COMPLETADA]

**Objetivo:** Diseñar cómo mantenimiento y combustible pueden producir o relacionarse con movimientos financieros sin duplicar información.

**Resultado:** El cambio de aceite ahora permite registrar opcionalmente el gasto variable en finanzas con selección de medio de pago y nota.

### T007 — Conectar ingresos y medios de dinero [COMPLETADA]

**Objetivo:** Registrar dónde entra un ingreso y actualizar el saldo correspondiente.

**Resultado:** Ingresos y Gastos Variables soportan `medio_pago_id`, actualizando el balance real de cada cuenta (Efectivo, Nequi, Bancos, etc.).

### T008 — Conectar transferencias [COMPLETADA]

**Objetivo:** Permitir mover dinero entre medios sin contarlo como ingreso o gasto.

**Resultado:** Implementado endpoint `/api/transferencias` y UI modal en Dashboard que transfiere saldo entre medios sin alterar el resumen mensual de ingresos ni gastos.

### T009 — Revisar Dashboard [COMPLETADA]

**Objetivo:** Mostrar relaciones útiles y no simplemente más widgets.

**Resultado:** Dashboard rediseñado con tarjeta de métrica de "Dinero disponible", desglose visual por medio de pago/cuenta con balances reales, trazabilidad de medio en listas de ingresos y gastos, y botón rápido para mover entre cuentas.

## P2 — Sistema manual completo

### T010 — Fechas especiales y Recordatorios Universales [COMPLETADA]

**Objetivo:** Diseñar y construir cumpleaños, aniversarios y recordatorios universales (puntuales o recurrentes con alertas).

**Resultado:**
- Creadas tablas `fechas_especiales` (con cálculo dinámico de días restantes y edad/aniversario) y `recordatorios` (con soporte para eventos puntuales con anticipación o recurrentes tipo "cada 2 horas", y canales push/in_app).
- Eliminados los seeds hardcodeados de gastos fijos personales (`Cuota moto`, `Plan Claro`) en `init_db()` para garantizar un estado inicial limpio en cualquier cuenta nueva.
- Desarrollada la vista interactiva `FechasPage` en React con cuentas regresivas, gestión de alarmas y disparador de notificaciones del navegador/móvil (Web Push Notification API).
- OpenAPI sincronizado y frontend build verificado al 100%.

### T011 — SENA / estudio

Diseñar y construir clases, materias, entregas y progreso, conectados con agenda cuando corresponda.

### T012 — Metas

Diseñar metas medibles y conectarlas con Finanzas, Moto, Hábitos o estudio cuando corresponda.

## P3 — Validación

### T013 — Semana de uso real

Usar el sistema diariamente y registrar observaciones.

### T014 — Informe de fricciones

Convertir observaciones en decisiones de producto.

## P4 — Agente

### T015 — Primer agente

Implementar únicamente casos de uso validados.

**No construir todavía:**
- agente autónomo general,
- memoria compleja sin necesidad,
- automatizaciones masivas,
- arquitectura comercial multiusuario.

## Definición de terminado

Una tarea no está terminada solo porque el código compile.

Debe incluir, cuando aplique:

- implementación,
- pruebas,
- actualización de API/OpenAPI,
- regeneración del cliente,
- documentación,
- revisión de regresiones,
- validación contra el Documento Rector.
