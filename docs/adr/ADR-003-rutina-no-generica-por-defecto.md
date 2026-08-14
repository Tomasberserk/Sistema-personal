# ADR-003 — La rutina no debe ser genérica por defecto

**Estado:** Aceptada  
**Fecha:** 14 de agosto de 2026

## Contexto

La implementación actual crea una rutina seed/hardcodeada cuando `bloques_rutina` está vacía. Aunque inicialmente se consideró una rutina personal, el principio actual exige que hábitos y rutinas representen información definida por el usuario.

## Decisión

Eliminar o replantear el seed de rutina para que una instalación nueva no imponga bloques personales genéricos.

La rutina debe construirse desde actividades explícitamente definidas por el usuario o desde datos configurados.

## Consecuencia

El módulo requiere una revisión en Fase 1 antes de añadir más funcionalidades.
