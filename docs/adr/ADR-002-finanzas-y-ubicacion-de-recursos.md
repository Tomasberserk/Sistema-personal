# ADR-002 — Finanzas contiene la ubicación de los recursos

**Estado:** Aceptada  
**Fecha:** 14 de agosto de 2026

## Contexto

Se necesita distinguir cuánto dinero existe y dónde está: efectivo, billetes, monedas, cuentas, tarjetas y medios digitales.

## Decisión

No crear un módulo independiente de "Dinero y medios de pago" en esta etapa. Esta capacidad pertenece a Finanzas.

Finanzas debe distinguir entre:

- movimientos financieros,
- saldos,
- medios/ubicaciones de recursos,
- origen y destino de movimientos.

Una transferencia entre dos medios no es un gasto ni un ingreso.

## Consecuencia

El modelo mantiene una experiencia financiera unificada y evita fragmentar el producto demasiado pronto. La separación podrá reconsiderarse si el uso real demuestra que aporta valor.
