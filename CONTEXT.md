# JARVIS — Sistema Personal

## Qué es esto
Sistema de gestión personal all-in-one. La meta final es un bot de Telegram que lea y modifique todo el sistema por chat. Por ahora estamos construyendo el backend y el frontend web.

## Repo
https://github.com/Tomasberserk/Sistema-personal

## Stack
- Backend: Python + FastAPI
- Base de datos: SQLite (dev) / PostgreSQL (producción), seleccionado vía `DATABASE_URL`
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

## Estado actual del módulo de Rutina / Cronograma semanal (COMPLETADO)
- Tabla `bloques_rutina` (id, dia_semana 0=lunes..6=domingo, hora_inicio/hora_fin "HH:MM" con patrón
  validado, titulo, descripcion, color hex, icono emoji, activo 0/1). Se seedea la rutina real del usuario
  sólo si la tabla está vacía (45 bloques): Paseo y carrera 05-06 y Desayuno 07-07:30 (todos los días),
  Gym 08:30-11 (Lun/Mar/Jue/Vie), SENA/Didi 11-12, Tiempo libre 13:30-17, Preparación SENA 17-17:30 y
  SENA 18-23:30 (Lun-Vie), Almuerzo 12-13 (todos los días)
- Endpoints: CRUD `/api/rutina/bloques`, `GET /api/rutina/dia/{dia_semana}` (solo activos ordenados por
  hora_inicio, 400 si fuera de 0-6), `GET /api/rutina/semana` (7 días con bloques activos). Validación:
  hora_fin debe ser posterior a hora_inicio (400, incluso al PATCHear una sola hora contra la guardada)
- `require_row.allowed_tables` incluye `bloques_rutina`
- Página `/rutina` (ícono CalendarClock en nav desktop + móvil): tabs Día/Semana, selector de 7 días con
  conteo de bloques y día actual resaltado; cards con franja de color, emoji, hora inicio-fin y descripción,
  con badge "ahora" y resaltado cuando el bloque está transcurriendo; vista semanal grid de 7 columnas con
  pastillas de colores; sección "Todos los bloques" con pausar/editar/eliminar; modal con día, horas,
  título, descripción, emoji picker, swatches de color y toggle activo
- Cliente regenerado: `useListBloquesRutina`, `useCreateBloqueRutina`, `useGetRutinaSemana`, `useGetRutinaDia`,
  `useGetBloqueRutina`, `useUpdateBloqueRutina`, `useDeleteBloqueRutina`

---

## SIGUIENTE TAREA - Módulo Fechas especiales
Los módulos Finanzas (Cosmos), Moto, Hábitos y Rutina están terminados.
La próxima tarea natural es **fechas especiales** (cumpleaños, aniversarios, recordatorios automáticos):

- Reutilizar la plantilla: tabla en backend/main.py, patch en lib/api-spec/openapi.yaml,
  regenerar cliente (`pnpm --filter @workspace/api-spec run codegen`), y UI Cosmos en artifacts/jarvis/

---

## MODULOS PENDIENTES

### 2. Fechas especiales
- Cumpleanos, aniversarios, recordatorios automaticos

### 3. SENA
- Entregas pendientes, horario de clases, ficha y materias

### 4. Metas
- Objetivos con progreso (ahorro, km, habitos)

### 5. Bot Telegram (fase final)
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

## Capa de base de datos (migración PostgreSQL — COMPLETADA y verificada)
- `get_connection()` elige motor por `DATABASE_URL`: si la variable existe → psycopg2 (PostgreSQL),
  si no → SQLite (dev local). `IS_POSTGRES = bool(DATABASE_URL)`.
- `_PgConnection`/`_SqliteConnection`/`_normalize_sql` emulan la API de sqlite3: el SQL interno usa
  placeholders `%s`; se convierten a `?` para SQLite en tiempo de ejecución. `_Row`/`sqlite3.Row`
  dan acceso por nombre o por posición (`row["col"]`, `row[0]`).
- Schemas `POSTGRES_SCHEMA`/`SQLITE_SCHEMA` con las 9 tablas (categorias, ingresos, gastos_fijos,
  gastos_variables, kilometraje, moto_config, habitos, registro_habitos, bloques_rutina). Diferencias:
  `id SERIAL` vs `AUTOINCREMENT`, `DOUBLE PRECISION` vs `REAL`, booleanos `BOOLEAN`/`TRUE` vs
  `INTEGER 0/1`, `creado_en` default `to_char(now(),...)` vs `(datetime('now'))`.
- `init_db()`: los seeds de categorías, gastos fijos, config moto y bloques de rutina se insertan solo
  si sus tablas están vacías (contar antes de insertar, no `INSERT OR IGNORE`); migración
  `gastos_variables` (categoria→categoria_id) solo en SQLite.
- `create_item` usa `RETURNING id` en PG (psycopg2 no expone `lastrowid`) y `cursor.lastrowid` en SQLite.
- `_norm_bool()` normaliza 0/1 vs TRUE/FALSE al escribir (`activa`, `activo`) según motor.
- `requirements.txt` incluye `psycopg2-binary`. Verificado con smoke tests integrales en ambos motores
  (SQLite local y PostgreSQL 17 vía Docker, todos los módulos: categorías, gastos, ingresos, kilometraje,
  moto, hábitos, rutina, resúmenes → 39 checks PASS en cada motor).
- Para probar PG localmente: `docker run -d --name jarvis-pg -e POSTGRES_USER=jarvis -e POSTGRES_PASSWORD=jarvis
  -e POSTGRES_DB=jarvis -p 5433:5432 postgres:17-alpine` y usar
  `DATABASE_URL=postgresql://jarvis:jarvis@localhost:5433/jarvis`.
