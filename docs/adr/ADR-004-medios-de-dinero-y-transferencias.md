# ADR-004 — Modelo de Medios de Dinero y Transferencias en Finanzas

**Estado:** Aceptada  
**Fecha:** 14 de agosto de 2026

## Contexto

Según el Documento Rector y ADR-002, Finanzas debe gestionar tanto los movimientos como la ubicación física o digital de los recursos (efectivo billetes, efectivo monedas, cuentas bancarias, billeteras digitales, tarjetas, otros), así como transferencias entre ellos sin que constituyan un gasto o un ingreso.

## Decisión

1. **Tabla `medios_pago` (o medios de dinero):**
   - `id`: entero autoincremental / serial.
   - `nombre`: texto no nulo (ej. "Efectivo (Billetes)", "Bancolombia", "Nequi", "Efectivo (Monedas)").
   - `tipo`: texto con check (`efectivo_billetes`, `efectivo_monedas`, `cuenta_bancaria`, `billetera_digital`, `tarjeta`, `otro`).
   - `icono`: emoji descriptivo (ej. 💵, 🪙, 🏦, 📱, 💳).
   - `color`: color hexadecimal para la interfaz.
   - `saldo_inicial`: float >= 0 (por defecto 0.0).
   - `activo`: booleano (por defecto true).

2. **Tabla `transferencias_medios`:**
   - `id`: entero autoincremental / serial.
   - `fecha`: texto YYYY-MM-DD.
   - `origen_id`: referencia a `medios_pago(id)`.
   - `destino_id`: referencia a `medios_pago(id)` (con check `origen_id <> destino_id`).
   - `monto`: float > 0.
   - `nota`: texto opcional.

3. **Cálculo de saldos:**
   - Saldo actual por medio = `saldo_inicial` + sum(ingresos al medio) - sum(gastos del medio) + sum(transferencias recibidas) - sum(transferencias enviadas).
   - Las transferencias no afectan el total de ingresos ni el total de gastos del mes en `ResumenMensual`.
