"""Frases cortas en español para confirmar acciones.

Se usan cuando el proveedor no redacta la respuesta (confirmaciones) y como
respaldo determinista del proveedor mock.
"""

from __future__ import annotations

from typing import Any


def dinero(value: Any) -> str:
    try:
        amount = float(value or 0)
    except (TypeError, ValueError):
        amount = 0.0
    return "$" + f"{amount:,.0f}".replace(",", ".")


def _lista(items: list[Any], limite: int = 4) -> str:
    return ", ".join(str(item) for item in items[:limite])


def resumir_accion(tool: str, result: Any) -> str:
    """Convierte el resultado de una herramienta en una frase hablable."""
    if isinstance(result, dict) and result.get("error"):
        return f"No pude completarlo: {result['error']}"

    if tool == "resumen_mes_actual" and isinstance(result, dict):
        return (
            f"Este mes llevas ingresos por {dinero(result.get('ingresos'))}, "
            f"gastos por {dinero((result.get('gastos_fijos') or 0) + (result.get('gastos_variables') or 0))} "
            f"y un saldo de {dinero(result.get('saldo'))}. "
            f"En medios de pago tienes {dinero(result.get('saldo_total_medios'))}."
        )

    if tool == "gastos_por_categoria" and isinstance(result, list):
        if not result:
            return "Todavía no hay gastos variables este mes."
        partes = [f"{row['categoria']}: {dinero(row['total'])}" for row in result[:4]]
        return "Este mes se te ha ido en " + "; ".join(partes) + "."

    if tool == "crear_ingreso" and isinstance(result, dict):
        return f"Registré un ingreso de {dinero(result.get('monto'))} por {result.get('fuente', 'otro concepto')}."

    if tool == "crear_gasto_variable" and isinstance(result, dict):
        categoria = result.get("categoria") or "la categoría indicada"
        return f"Registré un gasto de {dinero(result.get('monto'))} en {categoria}."

    if tool == "crear_gasto_fijo" and isinstance(result, dict):
        return f"Creé el gasto fijo {result.get('nombre')} por {dinero(result.get('monto'))}."

    if tool == "crear_ahorro" and isinstance(result, dict):
        return f"Creé la meta de ahorro {result.get('nombre')} con objetivo de {dinero(result.get('monto_objetivo'))}."

    if tool in ("aportar_ahorro", "retirar_ahorro") and isinstance(result, dict):
        verbo = "Aporté" if tool == "aportar_ahorro" else "Retiré"
        return (
            f"{verbo} a la meta {result.get('nombre')}. "
            f"Ahora tienes {dinero(result.get('monto_actual'))} de {dinero(result.get('monto_objetivo'))}."
        )

    if tool == "transferir_entre_medios" and isinstance(result, dict):
        return f"Transferí {dinero(result.get('monto'))} correctamente."

    if tool == "crear_medio_pago" and isinstance(result, dict):
        return f"Creé el medio de pago {result.get('nombre')}."

    if tool == "marcar_habito" and isinstance(result, dict):
        if result.get("completado"):
            return f"Marqué {result.get('habito', 'el hábito')} como completado. ¡Bien hecho!"
        return f"Desmarqué {result.get('habito', 'el hábito')}."

    if tool == "crear_habito" and isinstance(result, dict):
        return f"Creé el hábito {result.get('nombre')}."

    if tool == "resumen_habitos" and isinstance(result, list):
        hechos = sum(1 for item in result if item.get("completado"))
        return f"Llevas {hechos} de {len(result)} hábitos completados en esa fecha."

    if tool == "listar_habitos" and isinstance(result, list):
        return f"Tienes {len(result)} hábitos: {_lista([item['nombre'] for item in result])}."

    if tool == "consultar_rutina":
        if isinstance(result, dict):
            bloques = result.get("bloques") or []
            if not bloques:
                return f"No tienes bloques para el {result.get('dia', 'día indicado')}."
            return f"Para el {result.get('dia')} tienes {_lista([b['titulo'] for b in bloques])}."
        if isinstance(result, list):
            return f"Tu rutina tiene {len(result)} días con actividades."

    if tool == "crear_bloque_rutina" and isinstance(result, dict):
        return f"Agregué {result.get('titulo')} de {result.get('hora_inicio')} a {result.get('hora_fin')}."

    if tool == "crear_recordatorio" and isinstance(result, dict):
        return f"Creé el recordatorio {result.get('titulo')} para el {result.get('fecha_disparo')}."

    if tool == "crear_fecha_especial" and isinstance(result, dict):
        return f"Registré {result.get('nombre')} para el {result.get('fecha')}."

    if tool == "listar_fechas_especiales" and isinstance(result, list):
        if not result:
            return "No tienes fechas especiales registradas."
        cercana = result[0]
        return f"La fecha más cercana es {cercana.get('nombre')} en {cercana.get('dias_restantes')} días."

    if tool == "estado_aceite_moto" and isinstance(result, dict):
        if result.get("alerta"):
            return (
                f"Ojo: al aceite le quedan {result.get('km_restantes')} kilómetros. "
                "Ya toca el cambio."
            )
        return (
            f"Vas en {result.get('km_actuales')} kilómetros y te quedan "
            f"{result.get('km_restantes')} para el cambio de aceite."
        )

    if tool == "registrar_kilometraje" and isinstance(result, dict):
        return f"Registré {result.get('km_actuales')} kilómetros en el odómetro."

    if tool == "registrar_cambio_aceite" and isinstance(result, dict):
        return f"Listo, reinicié el contador de aceite en {result.get('km_ultimo_cambio')} kilómetros."

    if tool == "eliminar_registro" and isinstance(result, dict):
        entidad = str(result.get("entidad", "registro")).replace("_", " ")
        return f"Eliminé el {entidad} número {result.get('id')}."

    if tool in ("listar_ingresos", "listar_gastos_variables", "listar_transferencias") and isinstance(result, list):
        return f"Encontré {len(result)} registros."

    if tool == "listar_gastos_fijos" and isinstance(result, list):
        activos = [row for row in result if row.get("activo")]
        return f"Tienes {len(activos)} gastos fijos activos por {dinero(sum(row.get('monto', 0) for row in activos))}."

    if tool == "listar_medios_pago" and isinstance(result, list):
        return "Tus medios de pago son " + _lista([row.get("nombre") for row in result]) + "."

    if tool == "listar_ahorros" and isinstance(result, list):
        if not result:
            return "Todavía no tienes metas de ahorro."
        return "Tus metas son " + _lista([row.get("nombre") for row in result]) + "."

    if tool == "listar_categorias" and isinstance(result, list):
        return f"Tienes {len(result)} categorías de gasto disponibles."

    if tool == "listar_recordatorios" and isinstance(result, list):
        pendientes = [row for row in result if row.get("activo")]
        return f"Tienes {len(pendientes)} recordatorios activos."

    return "Listo, la acción se ejecutó correctamente."


def describir_accion(tool: str, args: Any) -> str:
    """Describe una acción destructiva antes de pedir confirmación."""
    def field(name: str, default: Any = "") -> Any:
        return getattr(args, name, default)

    if tool == "eliminar_registro":
        entidad = str(field("entidad", "registro")).replace("_", " ")
        return f"eliminar el {entidad} número {field('id')}"
    if tool == "transferir_entre_medios":
        return f"transferir {dinero(field('monto'))} de {field('origen')} a {field('destino')}"
    if tool == "retirar_ahorro":
        return f"retirar {dinero(field('monto'))} de la meta {field('meta')}"
    if tool == "registrar_cambio_aceite":
        return "registrar el cambio de aceite y reiniciar el contador"
    return f"ejecutar {tool.replace('_', ' ')}"
