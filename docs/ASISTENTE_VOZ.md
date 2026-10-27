# Asistente de voz

El asistente permite operar el sistema con comandos en lenguaje natural (texto o
voz) sin duplicar la lógica de negocio: cada acción delega en el endpoint que ya
usa la interfaz.

## Alcance de esta versión

- **Voz en el navegador** con la Web Speech API (`es-CO`) y `speechSynthesis`
  para las respuestas. No requiere servicios externos.
- **Cerebro** con *function calling* sobre 31 acciones del sistema.
- **Proveedor real**: xAI Grok o Groq (ambos con API compatible con OpenAI).
  **Proveedor de desarrollo**: mock determinista que entiende comandos en
  español y no necesita API key.
- **Acciones destructivas** (eliminar, transferir, retirar ahorros, registrar
  cambio de aceite) siempre piden confirmación explícita del usuario.
- La conversación y las confirmaciones viven **en memoria del proceso**
  (10 minutos de vigencia). Es suficiente para un despliegue de un solo worker.

Fuera de alcance por ahora: agente autónomo general, memoria de largo plazo,
automatizaciones masivas y voz en tiempo real por WebSocket.

## Arquitectura

```
Micrófono / teclado
        │
        ▼
VoiceAssistant.tsx ── useVoiceAssistant.ts ── assistantApi.ts
        │                                        │
        │                              POST /api/assistant/chat
        │                              POST /api/assistant/confirm
        ▼                                        │
speechSynthesis (respuesta hablada)              ▼
                                   backend/assistant/router.py
                                                │
                                     AssistantService (service.py)
                                      │                    │
                              providers.py            registry.py
                          (mock | xAI Grok)      31 herramientas tipadas
                                                         │
                                                         ▼
                                        funciones de endpoint de backend/main.py
                                        (misma validación y efectos que la UI)
```

Puntos clave:

- `router.py` recibe el módulo `main` por inyección (`create_router(main_module)`),
  así que no hay imports circulares y funciona tanto con
  `uvicorn backend.main:app` como con los tests que importan `main`.
- `registry.py` resuelve nombres humanos a ids: “comida” → categoría,
  “nequi” → medio de pago, “viaje” → meta de ahorro, “gimnasio” → hábito.
- `service.py` ejecuta el ciclo modelo → herramienta → resultado → respuesta,
  con un máximo de 6 pasos para evitar bucles.
- `summaries.py` genera frases cortas en español para confirmaciones y como
  respaldo del proveedor mock.

## Endpoints

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/api/assistant/chat` | Envía un comando. Devuelve `reply`, `executed`, `pending_confirmation` y `session_id`. |
| `POST` | `/api/assistant/confirm` | Confirma o cancela una acción pendiente con `confirmation_id`. |
| `GET` | `/api/assistant/tools` | Catálogo de acciones (`name`, `description`, `destructive`, `parameters`). |

Todos requieren `Authorization: Bearer <token>`.

Ejemplo:

```bash
curl -X POST http://127.0.0.1:8000/api/assistant/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "gasté 25.000 en comida con nequi"}'
```

```json
{
  "session_id": "9f2c...",
  "reply": "Registré un gasto de $25.000 en comida.",
  "provider": "mock",
  "executed": [
    {
      "tool": "crear_gasto_variable",
      "argumentos": {"monto": 25000, "categoria": "comida", "medio_pago": "nequi"},
      "estado": "ok",
      "resumen": "Registré un gasto de $25.000 en comida.",
      "datos": {"id": 7, "...": "..."}
    }
  ],
  "pending_confirmation": null
}
```

Cuando la acción es destructiva, `executed` viene vacío y llega
`pending_confirmation`:

```json
{
  "session_id": "9f2c...",
  "reply": "Voy a eliminar el gasto variable número 7. ¿Confirmas? Responde sí o no.",
  "provider": "mock",
  "executed": [],
  "pending_confirmation": {
    "id": "3b1e...",
    "tool": "eliminar_registro",
    "resumen": "eliminar el gasto variable número 7",
    "prompt": "Voy a eliminar el gasto variable número 7. ¿Confirmas? Responde sí o no."
  }
}
```

Después se responde con:

```json
{"session_id": "9f2c...", "confirmation_id": "3b1e...", "accept": true}
```

La confirmación solo es válida para el mismo usuario y la misma `session_id`.
Si expira (10 minutos) o no coincide, no se ejecuta nada.

## Variables de entorno

| Variable | Valor por defecto | Uso |
| --- | --- | --- |
| `ASSISTANT_PROVIDER` | vacío | `mock`, `xai` o `groq`. Si se omite, se detecta por las claves. |
| `XAI_API_KEY` | vacío | Clave de xAI (empieza por `xai-`). |
| `XAI_MODEL` | `grok-4.7` | Modelo de xAI. |
| `XAI_BASE_URL` | `https://api.x.ai/v1` | Base de xAI. |
| `GROQ_API_KEY` | vacío | Clave de Groq (empieza por `gsk_`). |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Modelo de Groq con tool calling. |
| `GROQ_BASE_URL` | `https://api.groq.com/openai/v1` | Base de Groq. |

Prioridad sin forzar nada: **xAI → Groq → mock**. Si fuerzas un proveedor sin
su clave, el backend avisa por consola y usa el mock para no dejar de arrancar.

> **Ojo:** Groq (`gsk_...`) y xAI Grok (`xai-...`) son proveedores distintos y
> las claves no son intercambiables. La clave solo se lee en el backend; nunca
> se envía al navegador.

### Configurar la clave sin subirla al repo

1. Copia el ejemplo: `Copy-Item .env.example .env` (Windows) o
   `cp .env.example .env`.
2. Abre `.env` y pega la clave en la variable que corresponda. No la pongas en
   el chat, en el código ni en `git`.
3. Arranca el backend normalmente; `backend/main.py` carga `.env` al iniciar:
   `uvicorn backend.main:app --reload`.
4. Verifica el proveedor activo:

```bash
curl http://127.0.0.1:8000/api/assistant/tools \
  -H "Authorization: Bearer $TOKEN"
```

Debe responder `"provider": "groq"` o `"provider": "xai"`.

También puedes usar variables de sesión sin `.env`:

```powershell
$env:GROQ_API_KEY = "gsk_..."
uvicorn backend.main:app --reload
```

En producción (Render), agrega la clave en **Environment** del servicio; nunca
en el repositorio. `.env` ya está en `.gitignore`.

## Catálogo de acciones

**Finanzas (lectura):** `resumen_mes_actual`, `gastos_por_categoria`,
`listar_ingresos`, `listar_gastos_variables`, `listar_gastos_fijos`,
`listar_categorias`, `listar_medios_pago`, `listar_ahorros`,
`listar_transferencias`.

**Finanzas (escritura):** `crear_ingreso`, `crear_gasto_variable`,
`crear_gasto_fijo`, `crear_ahorro`, `aportar_ahorro`, `crear_medio_pago`.

**Destructivas:** `eliminar_registro`, `transferir_entre_medios`,
`retirar_ahorro`, `registrar_cambio_aceite`.

**Hábitos:** `listar_habitos`, `resumen_habitos`, `marcar_habito`,
`crear_habito`.

**Rutina:** `consultar_rutina`, `crear_bloque_rutina`.

**Recordatorios y fechas:** `listar_recordatorios`, `crear_recordatorio`,
`listar_fechas_especiales`, `crear_fecha_especial`.

**Moto:** `estado_aceite_moto`, `registrar_kilometraje`.

`eliminar_registro` acepta: `ingreso`, `gasto_variable`, `gasto_fijo`, `ahorro`,
`habito`, `recordatorio`, `fecha_especial`, `bloque_rutina`, `transferencia`,
`medio_pago`. El modelo debe listar primero para obtener el `id`; nunca inventa
ids.

## Fechas y montos

El registro acepta lenguaje natural y lo normaliza antes de llamar al endpoint:

- fechas: `hoy`, `ayer`, `anteayer`, `mañana`, `el lunes`, `20/10/2026`,
  `2026-10-20`;
- fecha y hora: `hoy 18:00`, `mañana 09:30`, `2026-11-01T08:00`;
- montos: `25.000`, `25 mil`, `2 millones` (el modelo o el mock los convierten
  a pesos).

## Voz en el navegador

- Usa `webkitSpeechRecognition` / `SpeechRecognition` con `lang="es-CO"`.
- Funciona en Chrome y Edge. Requiere `https://` o `localhost`.
- El micrófono se activa manualmente (push-to-talk) y se detiene al terminar la
  frase.
- Las respuestas se leen con `speechSynthesis`; el botón de volumen las silencia
  y la preferencia se guarda en `localStorage`.
- Si el navegador no soporta dictado, el panel sigue funcionando con texto.

## Pruebas

```bash
# Backend (incluye los tests del asistente)
python -m pytest backend -q --ignore=backend/test_recordatorios_canal.py

# Solo asistente
python -m pytest backend/test_assistant.py -q

# Frontend
corepack pnpm --filter @workspace/jarvis build
```

Los tests usan el proveedor mock y una base SQLite temporal, así que no
necesitan red ni API key.

### Prueba manual

1. Levanta el backend: `uvicorn backend.main:app --reload`.
2. Levanta el frontend: `corepack pnpm --filter @workspace/jarvis dev`.
3. Entra con el usuario demo (`tomas@personal.io` / `demo`).
4. Abre el botón flotante del micrófono (abajo a la derecha).
5. Prueba: “gasté 25 mil en comida con nequi”, “¿cómo voy este mes?”,
   “marca el hábito gimnasio”, “elimina el gasto id 3” (debe pedir
   confirmación) y responde “sí” o “no”.

## Limitaciones conocidas

- El estado de conversación y las confirmaciones son por proceso; con varios
  workers o reinicios se pierden. Si se necesita persistencia, mover a Redis o a
  la base de datos.
- El mock entiende un conjunto acotado de comandos; con xAI el lenguaje es
  abierto.
- La voz en tiempo real (xAI Realtime, `wss://api.x.ai/v1/realtime`) queda como
  siguiente fase; el registro de herramientas no cambia.
