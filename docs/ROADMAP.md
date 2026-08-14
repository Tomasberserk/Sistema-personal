# ROADMAP.md — Sistema Personal 2.0

**Estado:** Fase 1 — Consolidación

## Principio

No avanzar por cantidad de módulos. Avanzar por **valor, coherencia y conexión**.

## Fase 1 — Consolidación

**Objetivo:** convertir la base actual en una versión coherente de Sistema Personal 2.0.

### Prioridades

1. Auditar frontend, backend, DB y API actuales.
2. Eliminar la rutina hardcodeada/genérica o convertirla en una configuración explícita del usuario.
3. Verificar PostgreSQL/Supabase en un entorno real.
4. Incorporar dentro de Finanzas la dimensión de ubicación/medio del dinero.
5. Revisar contratos OpenAPI y cliente generado.
6. Eliminar documentación obsoleta que pueda inducir a agentes de IA a seguir la hoja de ruta anterior.
7. Mantener pruebas de regresión.

**Salida de fase:** sistema estable, sin rutinas genéricas impuestas y con una base financiera preparada para distinguir dónde están los recursos.

## Fase 2 — Conexión de módulos

Conectar los módulos que ya existen antes de crear muchos nuevos.

Ejemplos:

- Moto ↔ Finanzas.
- Kilometraje ↔ mantenimiento.
- Combustible ↔ Finanzas + Moto.
- Ingresos ↔ medios de dinero.
- Transferencias ↔ saldos.
- Hábitos ↔ metas.
- Agenda ↔ recordatorios.

**Salida de fase:** acciones relevantes producen cambios consistentes en más de un área.

## Fase 3 — Completar el sistema manual

Priorizar módulos pendientes que aporten valor real:

1. Fechas especiales / recordatorios.
2. SENA / estudio.
3. Metas.

Cada módulo debe diseñarse con sus relaciones desde el inicio.

## Fase 4 — Uso real

Usar el sistema diariamente durante al menos una semana.

Registrar:

- Qué se usa.
- Qué no se usa.
- Qué cuesta registrar.
- Qué información se consulta repetidamente.
- Qué relaciones resultan útiles.
- Qué datos faltan.
- Qué automatizaciones serían realmente valiosas.

No tomar decisiones de agente basadas únicamente en suposiciones.

## Fase 5 — Primer agente

Construir una capa conversacional mínima sobre capacidades existentes.

Primeros casos de uso:

- Registrar un gasto.
- Registrar un ingreso.
- Registrar kilometraje.
- Registrar cambio de aceite.
- Consultar saldo.
- Consultar gastos.
- Consultar hábitos.
- Crear un evento/recordatorio cuando la infraestructura esté lista.

El agente debe usar herramientas/capacidades del backend y no duplicar la lógica de negocio.

## Fase 6 — Agente contextual

Después de validar el primer agente:

- contexto personal controlado,
- consultas cruzadas,
- instrucciones con varias acciones,
- confirmaciones para acciones sensibles,
- recordatorios,
- propuestas,
- automatizaciones autorizadas.

## Fase 7 — Producto comercial (horizonte)

No es prioridad actual.

Solo cuando el producto personal esté probado:

- multiusuario,
- aislamiento de datos,
- seguridad,
- costos por usuario,
- escalabilidad,
- onboarding,
- analítica de producto,
- modelo de negocio.

No diseñar hoy alrededor de estos problemas salvo que una decisión presente lo requiera.

## Criterio para avanzar

Una fase se considera terminada cuando:

- el objetivo de producto está cumplido,
- no existen regresiones críticas,
- el flujo puede utilizarse realmente,
- la documentación está actualizada,
- y la siguiente fase está justificada por evidencia.
