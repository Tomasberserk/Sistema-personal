# ROADMAP.md — Sistema Personal 2.0

**Estado:** Fase 5 — Agente inicial (implementado, en validación)
**Última actualización:** 27 de octubre de 2026
**Fuente estratégica:** [DOCUMENTO_RECTOR.md](./DOCUMENTO_RECTOR.md)
**Tareas ejecutables:** [TASKS.md](./TASKS.md)
**Decisiones de arquitectura:** [adr/](./adr/)

## Principio

No avanzar por cantidad de módulos. Avanzar por **valor, coherencia y conexión**.
Cada fase debe dejar el sistema más confiable y más útil, no solo más grande.

## Estado actual

### Base técnica

| Área | Estado |
| --- | --- |
| Backend | FastAPI + SQLAlchemy; SQLite local y PostgreSQL soportado |
| Autenticación | JWT; datos aislados por usuario |
| Frontend | React + Vite + TanStack Query; app responsive |
| Contratos | OpenAPI + cliente y schemas generados con Orval |
| Pruebas | 17 pruebas de backend en verde; typecheck y build del frontend en verde |
| Asistente | 31 herramientas; proveedores mock, xAI y Groq; Groq verificado en vivo |

> `backend/test_recordatorios_canal.py` se ejecuta aparte porque depende de un
> canal de notificación externo. El resto de la suite corre con `pytest backend`.

### Módulos

| Módulo | Estado | Implementado | Pendiente |
| --- | --- | --- | --- |
| Finanzas | Operativo | Ingresos, gastos fijos y variables, categorías, medios de pago, transferencias, resumen mensual, ahorros con aportes | Presupuesto, reportes históricos, exportación |
| Moto | Operativo | Kilometraje, configuración de aceite, cambio de aceite con gasto financiero opcional | Combustible, mantenimientos programados |
| Hábitos | Operativo | CRUD, marcado diario, rachas, resumen | Vínculo con metas |
| Rutina | Operativo | Bloques por día, vista semanal, plantilla editable | Vínculo con recordatorios y estudio |
| Fechas y recordatorios | Operativo | Fechas especiales, recordatorios puntuales y recurrentes, canales in-app/push, alarmas | Validación de push en dispositivo real |
| Ahorros / metas | Parcial | Metas de ahorro y aportes | Metas generales (moto, hábitos, estudio) |
| Estudio / SENA | Pendiente | — | Clases, materias, entregas, horarios y progreso |
| Agente personal | Operativo en desarrollo | Voz y texto, 31 herramientas, confirmaciones, Groq/xAI/mock | Clave en producción, validación de uso real, métricas |
| Onboarding | Pendiente | Estado inicial limpio, sin seeds personales | Tour guiado, PWA/Capacitor |

## Fase 1 — Consolidación [COMPLETADA]

**Objetivo:** convertir la base inicial en una versión coherente de Sistema
Personal 2.0.

Resultados:

- Auditoría del repositorio y documento rector consolidado (T001).
- Eliminación de la rutina genérica impuesta (T002).
- Verificación de la capa PostgreSQL/Supabase (T003).
- Medios de dinero dentro de Finanzas, sin módulo separado (T004).
- Contratos OpenAPI y cliente generado sincronizados (T005).

**Salida cumplida:** sistema estable, sin rutinas ni datos personales impuestos y
con una base financiera que distingue dónde están los recursos.

## Fase 2 — Conexión de módulos [COMPLETADA]

**Objetivo:** conectar lo existente antes de crear módulos nuevos.

Resultados:

- Moto ↔ Finanzas: el cambio de aceite puede generar el gasto (T006).
- Ingresos y gastos ↔ medios de pago: los saldos reales se actualizan (T007).
- Transferencias entre medios sin contarlas como ingreso o gasto (T008).
- Dashboard con dinero disponible, desglose por medio y trazabilidad (T009).

**Extensión pendiente:** combustible ↔ Finanzas + Moto. Hoy el kilometraje no
registra galones ni costo de gasolina.

## Fase 3 — Sistema manual completo [EN CURSO]

**Objetivo:** cerrar los módulos que faltan antes de ampliar el agente.

Completado:

- Fechas especiales y recordatorios universales, con alarmas y canales (T010).
- Metas de ahorro con aportes y seguimiento.
- Estado inicial limpio en cuentas nuevas.

Pendiente, en este orden:

1. **T011 — Estudio / SENA.** Clases, materias, entregas, horarios y progreso.
2. **T012 — Metas generales.** Además de ahorro: moto, hábitos, estudio y proyectos.
3. **Combustible.** Registro de gasolina conectado con Moto y Finanzas.
4. **Presupuesto.** Límites por categoría y alertas de desviación.
5. **Onboarding.** Tour inicial y transición a PWA/Capacitor.

**Salida de fase:** el sistema cubre las áreas importantes de la vida diaria sin
depender del agente y sin datos genéricos impuestos.

## Fase 4 — Validación en uso real [PRIORIDAD ACTUAL]

**Objetivo:** demostrar que el sistema y el asistente aportan valor antes de
seguir agregando capacidades.

Esta fase debía ejecutarse antes del agente. Como el asistente ya está
implementado (T016), ahora se usa como caso de validación: no se amplía hasta
tener evidencia.

Actividades:

- Usar el sistema a diario durante **7 días consecutivos** (T013).
- Registrar qué se usa, qué no, cuánto cuesta registrar y qué se consulta.
- Probar el asistente con al menos **10 comandos reales** de las áreas activas.
- Medir: éxito de la acción, claridad de la respuesta, latencia percibida y
  necesidad de corregir.
- Convertir las fricciones en tareas concretas (T014).

Criterios de salida:

- 90 % o más de los comandos habituales terminan en la acción correcta.
- 100 % de las acciones destructivas exigen confirmación explícita.
- Ningún dato personal se inventa ni se duplica.
- Existe una lista priorizada de fricciones con evidencia, no suposiciones.

## Fase 5 — Agente inicial [EN CURSO]

**Objetivo:** operar el sistema por voz o texto reutilizando los endpoints
existentes, sin duplicar lógica de negocio.

Implementado (T016):

- Paquete `backend/assistant/` con 31 herramientas tipadas.
- `POST /api/assistant/chat`, `POST /api/assistant/confirm` y
  `GET /api/assistant/tools`, autenticados con el token existente.
- Confirmaciones en memoria con vigencia de 10 minutos, atadas a usuario y
  sesión; el modelo nunca confirma por sí solo.
- Frontend con botón flotante, dictado `es-CO`, respuestas habladas, texto y
  confirmación Sí/No.
- Proveedores mock, xAI Grok y Groq; selección por `ASSISTANT_PROVIDER` o por
  clave disponible. Groq verificado con una llamada real.

Pendiente para cerrar la fase:

- Configurar `GROQ_API_KEY` o `XAI_API_KEY` en el entorno del despliegue.
- Validar el asistente dentro de la Fase 4 (comandos reales y fricciones).
- Medir latencia y consumo; definir límites y fallback ante errores del proveedor.
- Documentar qué comandos son confiables y cuáles conviene mantener en la UI.

**No construir todavía:** agente autónomo general, memoria de largo plazo sin
necesidad, automatizaciones masivas ni arquitectura multiusuario comercial.

## Fase 6 — Agente contextual [FUTURA]

Solo después de validar la Fase 5:

- Instrucciones que abarquen varios módulos, por ejemplo:
  “Hoy recorrí 120 km y gasté 40.000 en gasolina”.
- Contexto controlado de datos recientes para responder mejor.
- Propuestas y recordatorios basados en el estado real del sistema.
- Automatizaciones autorizadas, siempre con confirmación y trazabilidad.
- Consultas cruzadas entre Finanzas, Moto, Hábitos, Rutina y Estudio.

## Fase 7 — Producto comercial [HORIZONTE]

No es prioridad actual. Solo cuando el producto personal esté probado:

- Multiusuario y aislamiento de datos.
- Seguridad, costos por usuario y escalabilidad.
- Onboarding y analítica de producto.
- Modelo de negocio y soporte.

No diseñar hoy alrededor de estos problemas salvo que una decisión presente lo
requiera.

## Próximos pasos priorizados

| Prioridad | Acción | Evidencia de cierre |
| --- | --- | --- |
| P0 | Configurar la clave del proveedor en producción y verificar `provider` | `GET /api/assistant/tools` responde `groq` o `xai` |
| P0 | Ejecutar la validación de 7 días y 10 comandos reales | Informe de fricciones T014 |
| P0 | Mantener typecheck, build y pruebas en verde | `tsc`, `vite build`, `pytest` sin errores |
| P1 | T011 Estudio / SENA | Módulo usable con clases y entregas |
| P1 | T012 Metas generales | Metas medidas y conectadas a su módulo |
| P1 | Combustible ↔ Moto + Finanzas | Registro de gasolina con costo y consumo |
| P2 | Presupuesto por categoría | Límites y alertas funcionando |
| P2 | Onboarding y PWA/Capacitor | Primera experiencia guiada y uso móvil |
| P3 | Agente contextual (Fase 6) | Casos multi-módulo validados |

## Criterios para avanzar de fase

Una fase se considera terminada cuando:

- el objetivo de producto está cumplido y se puede usar en la vida real;
- no existen regresiones críticas;
- las pruebas, el typecheck y el build están en verde;
- OpenAPI y el cliente generado están sincronizados;
- la documentación refleja el comportamiento real;
- las claves y datos sensibles permanecen fuera del repositorio y del navegador;
- la siguiente fase está justificada por evidencia de uso, no por suposición.

## Riesgos y decisiones abiertas

- **Proveedor del agente:** Groq y xAI tienen límites, precios y modelos que
  cambian. El mock debe seguir siendo el fallback seguro.
- **Claves:** solo en el entorno del backend. Nunca en el frontend, en el repo ni
  en el historial de Git.
- **SQLite vs PostgreSQL:** la suite cubre ambos, pero cualquier migración de
  datos reales requiere una verificación adicional en el entorno desplegado.
- **Push real:** las notificaciones dependen de HTTPS, permisos del navegador y
  del sistema operativo; deben probarse en un dispositivo real.
- **Deriva documental:** este roadmap y `TASKS.md` deben actualizarse juntos; las
  tareas ejecutables viven en `TASKS.md`.
- **Alcance del agente:** ampliarlo antes de la validación contradice el
  principio “primero utilidad, después inteligencia”.

## Registro de cambios

- **27 oct 2026:** reescritura completa del roadmap para reflejar el estado real
  (T001–T016), eliminar el contenido HTML corrupto y ordenar las fases con la
  validación de uso como prioridad actual. Se saneó el typecheck del frontend.
