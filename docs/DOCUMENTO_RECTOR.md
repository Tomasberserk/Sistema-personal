# Sistema Personal 2.0 — Documento Rector

**Versión:** 1.1  
**Estado:** Aprobado para guiar el desarrollo  
**Última actualización:** 14 de agosto de 2026

## 1. Propósito

Este documento es la fuente de verdad estratégica de Sistema Personal 2.0. Define qué estamos construyendo, por qué lo construimos, qué principios deben guiar las decisiones y cómo debe evolucionar el producto.

Las herramientas de IA pueden proponer soluciones, pero no deben sustituir estas decisiones de producto.

## 2. Visión

Sistema Personal 2.0 aspira a convertirse en un **sistema operativo personal**: una plataforma que centraliza información relevante de la vida de una persona, permite visualizarla, relacionarla y, posteriormente, interactuar con ella mediante un agente inteligente.

La web/dashboard es una interfaz visual para comprender y administrar el sistema. A largo plazo, el agente podrá convertirse en la interfaz más natural para registrar, consultar y actuar sobre la información.

## 3. Misión

Construir primero un sistema personal útil, completo y confiable mediante captura manual de datos. Después, utilizar ese sistema probado como fundamento para desarrollar un agente que reduzca el esfuerzo de registrar, consultar, organizar y conectar información.

## 4. Principios rectores

1. **Una sola fuente de verdad.** La información personal debe vivir en un sistema central y consistente.
2. **Primero utilidad, después inteligencia.** No construir un agente complejo antes de demostrar valor real.
3. **El sistema antes que la pantalla.** La lógica de negocio debe ser reutilizable por web, móvil, Telegram, WhatsApp u otras interfaces.
4. **Los módulos deben conectarse.** Cada módulo debe aportar valor por sí mismo y más valor cuando comparte información con otros.
5. **Captura simple.** Registrar información debe requerir el menor esfuerzo posible.
6. **No inventar datos.** La IA puede interpretar y proponer, pero no inventar información personal.
7. **Automatizar después de validar.** Primero se demuestra valor; después se automatiza.
8. **Construir para evolucionar.** Nuevas interfaces y módulos no deben obligar a rehacer el núcleo.
9. **Privacidad y control.** La persona conserva el control sobre sus datos y sobre acciones sensibles.
10. **Menos complejidad, más valor.** Toda funcionalidad debe justificar su existencia.

## 5. Estado actual

El proyecto ya cuenta con una base funcional de frontend, backend, base de datos y despliegue, además de módulos de Finanzas, Moto, Hábitos y Rutina/Agenda.

La prioridad inmediata no es añadir módulos indiscriminadamente. Es **consolidar lo construido, eliminar lo genérico, conectar los módulos y validar el sistema en uso real**.

## 6. Módulos

### Finanzas

Finanzas será un único módulo que gestione tanto los movimientos de dinero como la ubicación o medio donde están los recursos.

Debe contemplar:

- Ingresos.
- Gastos fijos.
- Gastos variables.
- Categorías.
- Presupuesto y seguimiento.
- Saldos.
- Distribución de recursos.
- Medios o ubicaciones del dinero.

Dentro de Finanzas se debe poder distinguir, por ejemplo:

- Efectivo.
  - Billetes.
  - Monedas.
- Cuentas bancarias.
- Tarjetas.
- Billeteras digitales.
- Otros medios que el usuario defina.

No se crea un módulo independiente de "Dinero y medios de pago" en esta etapa. La separación futura solo se hará si el uso real demuestra que aporta valor.

Un movimiento financiero debe poder expresar, cuando aplique, **origen y destino**. Transferir dinero entre dos medios no es lo mismo que gastar dinero.

### Moto / vehículo

Debe gestionar:

- Kilometraje.
- Combustible.
- Cambio de aceite.
- Mantenimientos.
- Costos relacionados.
- Próximos servicios.
- Indicadores derivados del uso.

Cuando corresponda, los eventos de Moto deben poder generar o relacionarse con movimientos de Finanzas.

### Hábitos

Debe gestionar hábitos definidos por el usuario, seguimiento, cumplimiento, rachas y evolución.

No debe imponer hábitos genéricos.

### Rutina / Agenda

Debe representar actividades que realmente tengan valor para el usuario:

- Estudio.
- Trabajo.
- Proyectos.
- Compromisos.
- Bloques de tiempo.
- Actividades recurrentes relevantes.

No debe inventar una rutina diaria genérica de actividades obvias. La rutina hardcodeada existente es deuda de Fase 1 y debe revisarse/eliminarse.

### Fechas y recordatorios

Debe cubrir cumpleaños, aniversarios, vencimientos, pagos, mantenimientos y otros eventos importantes.

### Estudio / SENA

Debe cubrir clases, materias, tareas, entregas, horarios y progreso cuando este módulo sea priorizado.

### Metas

Debe permitir objetivos medibles, como ahorro, kilometraje, hábitos, estudio o proyectos.

### Dashboard

Debe permitir comprender el estado del sistema de forma visual. No debe convertirse en un catálogo de widgets.

### Agente personal

Es una etapa posterior. Debe ser una interfaz inteligente sobre las capacidades reales del sistema, no un chatbot decorativo.

## 7. Relaciones entre módulos

El valor diferencial de Sistema Personal está en las conexiones.

Ejemplos:

- Registrar kilometraje → actualiza historial del vehículo y cálculos de mantenimiento.
- Registrar cambio de aceite → actualiza mantenimiento y puede generar un gasto financiero.
- Registrar gasolina → actualiza Finanzas y estadísticas del vehículo.
- Registrar ingreso → actualiza Finanzas y el medio donde entró el dinero.
- Transferir dinero → mueve saldo entre dos medios sin crear un gasto ficticio.
- Registrar una reunión → actualiza Agenda y posteriormente puede generar un recordatorio.
- Registrar una meta de ahorro → utiliza información financiera para medir progreso.

## 8. El agente: visión futura

El agente debe evolucionar progresivamente:

1. Interpretar instrucciones sencillas.
2. Consultar información existente.
3. Registrar datos estructurados a partir de lenguaje natural.
4. Relacionar una instrucción con varios módulos.
5. Pedir confirmación ante acciones ambiguas o sensibles.
6. Proponer acciones basadas en contexto.
7. Ejecutar automatizaciones autorizadas.

Ejemplo objetivo:

> "Hoy recorrí 120 kilómetros y gasté 40.000 en gasolina."

El sistema debería poder interpretar ambas intenciones y actualizar las áreas correspondientes sin obligar al usuario a navegar por dos paneles.

## 9. Estrategia de costos

Se mantiene la filosofía de construir la mayor cantidad posible de infraestructura propia y aprovechar servicios gratuitos o de bajo costo.

### Ruta 0 — bajo/cero costo

Primero se construye el sistema manual completo y se utilizan reglas, automatizaciones deterministas y capacidades gratuitas o existentes siempre que sea viable.

**Objetivo:** validar producto y arquitectura sin depender de una inversión significativa.

### Ruta de inversión

Más adelante se podrán incorporar modelos, APIs o infraestructura especializada cuando exista un caso de uso validado y un beneficio medible.

**Objetivo:** aumentar capacidad de interpretación, contexto, automatización y experiencia.

**Decisión actual:** no invertir significativamente en un agente avanzado antes de completar y probar la base manual.

## 10. Comercialización y Experiencia de Usuario

La posibilidad de convertir Sistema Personal en un producto comercial es una **visión de largo plazo**, no un requisito de las decisiones inmediatas.

Principios acordados para la evolución comercial:
- **Estado inicial limpio (Virgin State):** Ninguna cuenta nueva contendrá datos, gastos fijos ni rutinas hardcodeadas. Cada usuario construye su propio espacio desde cero.
- **Onboarding interactivo:** Se planificará un tour/guía interactiva de bienvenida (estilo Nequi) que guíe al usuario en su primer registro de cuentas, categorías y rutinas.
- **Estrategia Móvil:** La transición de Web a App Móvil se realizará mediante **Capacitor / PWA** en primera instancia, preservando el 100% de la lógica de negocio y APIs REST desacopladas.

## 11. Regla de oro

> **No estamos construyendo una colección de aplicaciones dentro de una sola web. Estamos construyendo un sistema personal integrado, primero confiable y después inteligente.**
