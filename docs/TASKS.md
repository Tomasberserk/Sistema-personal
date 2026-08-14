# TASKS.md — Sistema Personal 2.0

Este archivo contiene tareas ejecutables. Las tareas deben realizarse en orden salvo decisión explícita.

## P0 — Consolidación

### T001 — Auditoría del repositorio

**Objetivo:** producir un inventario real de frontend, backend, rutas API, tablas, seeds, componentes y documentación.

**Reglas:**
- Inspeccionar código real.
- No asumir que la documentación antigua está actualizada.
- Identificar duplicaciones y funcionalidades sin uso.

**Resultado esperado:** informe de hallazgos y lista de cambios recomendados.

### T002 — Eliminar/replantear rutina hardcodeada

**Objetivo:** impedir que el sistema imponga una rutina personal genérica.

**Debe revisarse:**
- seed de `bloques_rutina`,
- comportamiento cuando la tabla está vacía,
- UI de rutina,
- endpoints relacionados,
- cualquier documentación que diga que la rutina seed es "real" o deseada.

**Resultado esperado:** una instalación nueva no recibe una rutina inventada por el sistema.

### T003 — Verificar PostgreSQL/Supabase

**Objetivo:** comprobar que la capa PostgreSQL funciona de forma equivalente a SQLite en los flujos relevantes.

**Validar:**
- conexión,
- inicialización,
- schemas,
- CRUD,
- claves foráneas,
- booleanos,
- fechas,
- transacciones,
- endpoints principales.

**Resultado esperado:** evidencia de pruebas y cualquier corrección necesaria.

### T004 — Diseñar medios de dinero dentro de Finanzas

**Objetivo:** permitir distinguir dónde están los recursos sin crear un módulo independiente.

**Conceptos mínimos:**
- efectivo/billetes,
- efectivo/monedas,
- cuenta bancaria,
- tarjeta,
- billetera digital,
- otros.

**Regla:** transferencia entre medios ≠ gasto.

Antes de modificar schema, documentar el modelo y revisar compatibilidad con datos existentes.

### T005 — Actualizar contratos API y cliente

**Objetivo:** mantener OpenAPI y cliente frontend sincronizados después de cambios de backend.

**Resultado esperado:** cliente regenerado y frontend compilable.

## P1 — Conexión

### T006 — Conectar Moto y Finanzas

Diseñar cómo mantenimiento y combustible pueden producir o relacionarse con movimientos financieros sin duplicar información.

### T007 — Conectar ingresos y medios de dinero

Registrar dónde entra un ingreso y actualizar el saldo correspondiente.

### T008 — Conectar transferencias

Permitir mover dinero entre medios sin contarlo como ingreso o gasto.

### T009 — Revisar Dashboard

Mostrar relaciones útiles y no simplemente más widgets.

## P2 — Sistema manual completo

### T010 — Fechas especiales

Diseñar y construir cumpleaños, aniversarios y recordatorios.

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
