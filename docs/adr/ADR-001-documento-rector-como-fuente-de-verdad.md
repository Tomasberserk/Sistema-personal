# ADR-001 — Documento Rector como fuente de verdad estratégica

**Estado:** Aceptada  
**Fecha:** 14 de agosto de 2026

## Contexto

El repositorio tenía un `CONTEXT.md` que mezclaba visión de producto, estado del código y una hoja de ruta anterior. Esto podía hacer que distintas herramientas de IA continuaran construyendo módulos aislados.

## Decisión

Separar responsabilidades:

- `docs/DOCUMENTO_RECTOR.md`: visión, misión y principios.
- `CONTEXT.md`: contexto operativo del repositorio.
- `docs/ROADMAP.md`: fases y prioridades.
- `docs/TASKS.md`: tareas ejecutables.
- `docs/adr/`: decisiones técnicas.

## Consecuencia

Las IAs pueden recibir contexto apropiado para cada tipo de decisión y se reduce el riesgo de que documentación histórica gobierne el desarrollo actual.
