# JARVIS — Sistema Personal

## Qué es esto
Sistema de gestión personal all-in-one. La meta final es un bot de Telegram que lea y modifique todo el sistema por chat. Por ahora estamos construyendo el backend y el frontend web.

## Repo
https://github.com/Tomasberserk/Sistema-personal

## Stack
- Backend: Python + FastAPI
- Base de datos: SQLite (por ahora), luego PostgreSQL
- Frontend: React + TypeScript (está en artifacts/jarvis/)
- Hosting: Replit (puede cambiar)

## Estructura del proyecto
/backend         → FastAPI, main.py, modelos, rutas
/artifacts/jarvis → Frontend React real (ignorar /frontend/, solo tiene un README)
/lib/db          → Schema Drizzle (vacío, ignorar)
/scripts         → Scripts varios

## Estado actual del módulo de Finanzas (tarea Cosmos COMPLETADA)
Todo lo anterior sigue funcionando (ingresos, gastos_fijos, gastos_variables, kilometraje, resumen mensual),
pero con el rediseño Cosmos + categorías ya terminado:

- Tabla `categorias` (id, nombre único, icono emoji, color hex, activa) + CRUD en API
- `gastos_variables` ahora usa `categoria_id` (FK a categorias); migración automática de la BD vieja
- 10 categorías por defecto sembradas al arrancar (Comida, Transporte, Gasolina, ...)
- Endpoint `GET /api/resumen/mes-actual/por-categoria` (nombre, icono, color, cantidad, total, %)
- Frontend con estilo **Cosmos**: fondo #0a0a0a + grain SVG, blobs blur, cards glassmorphism
  (rgba blanco 0.04 / border 0.08 / radius 20px / backdrop-blur 12px), títulos serif (Georgia),
  cuerpo Inter, inputs 14px redondeados, botón primario blanco pill, acentos = color de cada categoría
- Dashboard: dona de gastos por categoría + resumen con barras de progreso coloreadas y %
- Modal de gasto variable con selector de categorías en pills (emoji + nombre + color)
- Página `/categorias` con CRUD visual (picker de emoji, swatches de color, toggle activo)
- Cliente regenerado con orval (hooks `useListCategorias`, `useCreateCategoria`, `useUpdateCategoria`,
  `useDeleteCategoria`, `useGetResumenMensualPorCategoria`)

## Gastos fijos ya insertados en la BD
- Cuota moto: 390.000 COP, mensual
- Aceite moto: 60.000 COP, por kilometraje (cada 2.000-2.500 km)
- Plan Claro: 45.000 COP, mensual

## Ingresos del usuario (todos variables, no fijos)
- Didi: 20k-60k/dia segun horas trabajadas
- Papa: 70k/semana (no siempre)
- Recorrido amigo: 10k (no siempre)

## Estado actual del módulo de Moto (reminder de aceite — COMPLETADO)
- Tabla `moto_config` (singleton id=1): km_ultimo_cambio, intervalo_km (default 2000), alerta_km_antes (default 200)
- `GET /api/moto/estado-aceite` → km_actuales, km_ultimo_cambio, km_proximo_cambio, km_restantes,
  alerta, porcentaje_vida_aceite, intervalo_km, alerta_km_antes
- `POST /api/moto/cambio-aceite` → resetea km_ultimo_cambio al odómetro actual
- `PUT /api/moto/config` → edita intervalo, alerta y km del último cambio
- Página `/moto` (navegación): anillo de % de vida (verde >50, amarillo 20-50, rojo <20), banner de alerta,
  botón "Registrar cambio de aceite" y card de configuración en estilo Cosmos
- Cliente regenerado: `useGetMotoEstadoAceite`, `usePostMotoCambioAceite`, `usePutMotoConfig`
- KilometrajePage invalida el estado del aceite al registrar/editar km
- `GET /api/kilometraje/resumen` devuelve km_actuales (última lectura del odómetro) + registros;
  KilometrajePage muestra "Odómetro actual" con ese valor (ya no suma). POST/PATCH validan que el
  odómetro no retroceda (400 con detalle claro); permite igualar el último valor.

---

## Estado actual del módulo de Hábitos (COMPLETADO)
- Tablas `habitos` (id, nombre único, icono emoji, color hex, activo 0/1, creado_en) y
  `registro_habitos` (habito_id FK ON DELETE CASCADE, fecha, completado, UNIQUE(habito_id, fecha))
- Endpoints: CRUD `/api/habitos`, `GET /api/habitos/resumen/{fecha}` (solo activos: racha + completado del
  día), `GET /api/habitos/{id}/racha`, `POST /api/habitos/{id}/check/{fecha}` (toggle marca/desmarca)
- La racha se calcula hacia atrás desde la fecha consultada (hoy por defecto); para fechas pasadas
  `resumen/{fecha}` usa esa fecha como punto de partida
- `require_row.allowed_tables` incluye `habitos` y `registro_habitos` (reusa create/update/delete_item)
- Página `/habitos`: navegación de fechas (chevrons + botón Hoy), avance del día con barra %, cards por
  hábito con emoji, 🔥 racha y check circular que se enciende con el color del hábito; sección "Tus hábitos"
  con editar/eliminar/pausar; modal nuevo/editar con picker de emoji, swatches de color y toggle activo
- Cliente regenerado: `useListHabitos`, `useCreateHabito`, `useUpdateHabito`, `useDeleteHabito`,
  `useGetResumenHabitos`, `useGetRachaHabito`, `useToggleHabitoFecha`
- Nav (desktop + móvil): ícono Flame "Hábitos"

---

## SIGUIENTE TAREA - Módulo Rutina / Cronograma semanal
Los módulos Finanzas (Cosmos), Moto y Hábitos están terminados.
La próxima tarea natural es el **cronograma semanal** (bloques de tiempo editables):

- Reutilizar la plantilla: tabla en backend/main.py, patch en lib/api-spec/openapi.yaml,
  regenerar cliente (`pnpm --filter @workspace/api-spec run codegen`), y UI Cosmos en artifacts/jarvis/

---

## MODULOS PENDIENTES

### 2. Rutina / Cronograma semanal
- Bloques de tiempo editables
- 5-6am paseo y carrera con perra
- 7-7:30am desayuno
- 8/8:30-10:30/11am gym 4 dias
- 11am-12pm SENA o Didi
- 12pm almuerzo
- 1:30-4:30/5pm libre
- 5pm lunch bano alistarse
- 6pm-11:30pm SENA
- 12:30am llegada a casa

### 3. Fechas especiales
- Cumpleanos, aniversarios, recordatorios automaticos

### 4. SENA
- Entregas pendientes, horario de clases, ficha y materias

### 5. Metas
- Objetivos con progreso (ahorro, km, habitos)

### 6. Bot Telegram (fase final)
- Registrar gastos por chat
- Consultar habitos
- Recordatorios automaticos
- Leer y modificar cualquier modulo por mensaje

---

## Notas importantes
- El usuario controla el sistema desde el celular - todo debe ser responsive mobile-first
- Monedas en COP (pesos colombianos), formato es-CO
- El frontend real esta en /artifacts/jarvis/ NO en /frontend/
- No mover archivos de carpeta
