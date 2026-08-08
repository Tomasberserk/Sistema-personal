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

## Estado actual del módulo de Finanzas
Ya construido por Replit. Incluye:
- Tabla ingresos: fecha, fuente, monto, nota
- Tabla gastos_fijos: nombre, monto, tipo (mensual/por_kilometraje), activo
- Tabla gastos_variables: fecha, categoria (texto libre), monto, nota ESTO HAY QUE MEJORAR
- Tabla kilometraje: fecha, km_actuales, nota
- CRUD completo para cada tabla
- Endpoint resumen mensual (total ingresos, gastos, saldo)
- Frontend React básico funcional

## Gastos fijos ya insertados en la BD
- Cuota moto: 390.000 COP, mensual
- Aceite moto: 60.000 COP, por kilometraje (cada 2.000-2.500 km)
- Plan Claro: 45.000 COP, mensual

## Ingresos del usuario (todos variables, no fijos)
- Didi: 20k-60k/dia segun horas trabajadas
- Papa: 70k/semana (no siempre)
- Recorrido amigo: 10k (no siempre)

---

## PROXIMA TAREA - Mejora modulo finanzas estilo Monefy + diseno Cosmos

### Cambios en la base de datos

1. Crear tabla categorias:
   - id, nombre (texto unico), icono (emoji), color (hex), activa (bool)

2. Modificar gastos_variables:
   - Reemplazar campo categoria (texto) por categoria_id (FK a categorias)

3. Insertar categorias por defecto:
   - Comida #e85d4a
   - Transporte #5d8ae8
   - Gasolina #e8a85d
   - Entretenimiento #a85de8
   - Ropa #5de8c4
   - Medicina #e85d8a
   - Regalos #e8d95d
   - Hogar #5de87a
   - Tecnologia #5dc4e8
   - Aseo personal #e8755d

### Nuevos endpoints FastAPI
- CRUD completo para categorias
- Resumen mensual desglosado por categoria (nombre, total, porcentaje)

### Cambios en el frontend React - ESTILO VISUAL COSMOS

Fondo: #0a0a0a con textura grain sutil (SVG noise filter)
Blobs decorativos: 2-3 circulos grandes blur(80px), opacity: 0.15, color #333, en esquinas
Cards: background rgba(255,255,255,0.04), border 1px solid rgba(255,255,255,0.08), border-radius 20px, backdrop-filter blur(12px)
Tipografia titulos: Georgia o serif, color #f5f5f5
Tipografia cuerpo: Inter o system-ui, color #a0a0a0
Inputs: background rgba(255,255,255,0.06), border-radius 14px, sin borde en reposo, borde sutil al focus
Boton primario: background #ffffff, color #000000, border-radius 50px, bold
Boton secundario: outline blanco fondo transparente
Acento: solo los colores de cada categoria

### Funcionalidades nuevas del frontend
- Selector visual de categorias al registrar gasto: grid de pills oscuros con emoji y nombre
- Dashboard: grafico de dona con gastos por categoria sobre card glassmorphism
- Seccion Categorias: CRUD visual con emoji, color y nombre
- Resumen mensual: lista de categorias con barra de progreso coloreada y porcentaje

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
