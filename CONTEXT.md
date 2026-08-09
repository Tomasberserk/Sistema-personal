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

---

## SIGUIENTE TAREA - Módulo Habitos
El módulo de Finanzas con categorías + estilo Cosmos ya está terminado.
La próxima tarea natural es el **módulo de Hábitos**:

- Check diario por hábito
- Racha (streak)
- Categorías personalizables con iconos custom
- Reutilizar la plantilla: tabla en backend/main.py, patch en lib/api-spec/openapi.yaml,
  regenerar cliente (`pnpm --filter @workspace/api-spec run codegen`), y UI Cosmos en artifacts/jarvis/

---

## MODULOS PENDIENTES

### 2. Habitos
- Check diario por habito
- Racha (streak)
- Categorias personalizables con iconos custom

### 3. Rutina / Cronograma semanal
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

### 4. Moto
- Registro de kilometraje
- Recordatorio aceite cada 2.000-2.500 km (60k COP)
- Alerta 5-6 dias antes de que toque cambio

### 5. Fechas especiales
- Cumpleanos, aniversarios, recordatorios automaticos

### 6. SENA
- Entregas pendientes, horario de clases, ficha y materias

### 7. Metas
- Objetivos con progreso (ahorro, km, habitos)

### 8. Bot Telegram (fase final)
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
