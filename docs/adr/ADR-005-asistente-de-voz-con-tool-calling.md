# ADR-005 — Asistente de voz con tool calling

**Estado:** Aceptada  
**Fecha:** 23 de octubre de 2026

## Contexto

El sistema ya expone todas sus operaciones en FastAPI y la interfaz web las
consume. Se quiere operar el sistema por voz, incluyendo acciones destructivas,
sin crear una segunda implementación de reglas de negocio (saldos, borrados
suaves, validaciones, cálculo de rachas, etc.).

Restricciones:

- No hay `XAI_API_KEY` en el entorno de desarrollo todavía.
- El despliegue actual es un solo proceso (`uvicorn backend.main:app`).
- El frontend es React + Vite y ya tiene autenticación por token en
  `localStorage`.
- No se quiere introducir un servicio de terceros para el dictado.

## Decisión

1. **Un único endpoint de conversación** (`POST /api/assistant/chat`) que recibe
   lenguaje natural y devuelve una respuesta hablada más la lista de acciones
   ejecutadas. La conversación se identifica con `session_id`.
2. **Tool calling sobre las funciones de endpoint existentes.** El catálogo vive
   en `backend/assistant/registry.py`; cada herramienta resuelve nombres a ids y
   llama a la función de `backend/main.py`. No se reimplementan reglas.
3. **Inyección del módulo `main`** en `create_router(main_module)` para evitar
   imports circulares y permitir cargar la app como `backend.main` o como `main`
   en los tests.
4. **Confirmación explícita en el backend** para acciones destructivas. El
   servicio intercepta la llamada, guarda una confirmación en memoria (10
   minutos) y devuelve `pending_confirmation`. El endpoint
   `POST /api/assistant/confirm` la ejecuta o la cancela. La confirmación está
   atada a usuario y sesión; nunca se ejecuta por el texto del modelo.
5. **Proveedor intercambiable.** `MockProvider` (reglas en español, determinista,
   sin red) para desarrollo y tests; `XAIProvider` y `GroqProvider` (ambos sobre
   `/chat/completions` compatible con OpenAI) para producción. Sin claves se usa
   el mock; con ambas, prioridad xAI y `ASSISTANT_PROVIDER` permite forzar.
6. **Voz en el navegador** con Web Speech API (`es-CO`) y `speechSynthesis` en
   esta fase. La voz en tiempo real de xAI (WebSocket) se pospone, pero el
   catálogo de herramientas no tendrá que cambiar.
7. **Cliente HTTP propio en el frontend** (`assistantApi.ts`, `fetch` con 60 s)
   porque el cliente generado impone 10 s, insuficientes para varios pasos de
   modelo + herramientas.

## Alternativas consideradas

- **Reimplementar acciones en el asistente:** descartado; duplicaría reglas y
  garantías de integridad.
- **Llamar a la API por HTTP desde el backend:** descartado; añade latencia,
  requiere propagar tokens y complica los tests.
- **Texto libre para confirmar acciones destructivas:** descartado; el modelo
  podría “simular” una confirmación. La confirmación es estado del servidor.
- **Guardar conversaciones en la base de datos desde el inicio:** pospuesto;
  no es necesario para el MVP y añade migraciones.

## Consecuencias

- Toda acción nueva de la API debe registrarse en `registry.py` para estar
  disponible por voz (una entrada pequeña y tipada).
- El estado de conversación y las confirmaciones se pierden al reiniciar y no se
  comparten entre workers. Si se escala horizontalmente, habrá que moverlo a
  Redis o a la base de datos.
- El mock cubre los comandos principales; el lenguaje abierto requiere una clave
  de xAI Grok o de Groq. Las claves no son intercambiables entre proveedores.
- Los tests del backend no dependen de red ni de la clave, y la suite existente
  sigue pasando.
