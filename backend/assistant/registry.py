"""Registro de acciones del sistema expuestas al asistente.

Cada herramienta:

* declara un esquema Pydantic con los argumentos que el modelo puede enviar;
* resuelve nombres humanos ("comida", "nequi", "viaje") a ids de la base;
* delega en la función de endpoint existente de ``backend.main`` para que el
  comportamiento (validaciones, saldos, borrados suaves, etc.) sea idéntico al
  de la interfaz.

``build_tools(main_module)`` recibe el módulo ``main`` por inyección para
evitar imports circulares y para que los tests puedan cargarlo como ``main`` o
``backend.main`` indistintamente.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from difflib import SequenceMatcher
from typing import Any, Callable, Literal

from pydantic import BaseModel, Field

DIAS_SEMANA = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]


# ---------------------------------------------------------------------------
# Helpers de lenguaje natural
# ---------------------------------------------------------------------------
def _normalizar(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


DIAS_SEMANA_NORMALIZADOS = {_normalizar(dia): i for i, dia in enumerate(DIAS_SEMANA)}


def _parecido(query: str, candidate: str) -> float:
    """Puntaje 0..1 tolerante a plurales, tildes y nombres compuestos."""
    q, c = _normalizar(query), _normalizar(candidate)
    if not q or not c:
        return 0.0
    if q == c:
        return 1.0
    if q in c or c in q:
        return 0.9
    q_words, c_words = set(q.split()), set(c.split())
    if q_words and c_words:
        overlap = len(q_words & c_words) / len(q_words | c_words)
    else:
        overlap = 0.0
    return max(overlap, SequenceMatcher(None, q, c).ratio() * 0.85)


def elegir_por_nombre(rows: list[dict[str, Any]], nombre: str, *, etiqueta: str = "nombre") -> dict[str, Any]:
    """Devuelve la fila que mejor coincide con el nombre dictado por voz."""
    if not rows:
        raise ValueError(f"No hay {etiqueta}s registrados todavía.")
    scored = [(_parecido(nombre, row.get(etiqueta, "")), row) for row in rows]
    scored.sort(key=lambda pair: pair[0], reverse=True)
    score, best = scored[0]
    if score < 0.55:
        opciones = ", ".join(str(row.get(etiqueta)) for row in rows[:8])
        raise ValueError(f"No encontré '{nombre}'. Opciones disponibles: {opciones}.")
    return best


def parsear_fecha(value: Any) -> date:
    """Acepta 'hoy', 'ayer', 'el lunes', 'DD/MM/AAAA' o ISO."""
    raw = _normalizar(value)
    hoy = date.today()
    if raw in ("", "hoy", "ahora", "el dia de hoy"):
        return hoy
    if raw in ("ayer", "el dia de ayer"):
        return hoy - timedelta(days=1)
    if raw == "anteayer":
        return hoy - timedelta(days=2)
    if raw in ("manana", "el dia de manana"):
        return hoy + timedelta(days=1)

    match = re.fullmatch(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", raw)
    if match:
        return date(int(match.group(1)), int(match.group(2)), int(match.group(3)))

    match = re.fullmatch(r"(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})", raw)
    if match:
        year = int(match.group(3))
        if year < 100:
            year += 2000
        return date(year, int(match.group(2)), int(match.group(1)))

    match = re.fullmatch(r"(\d{1,2})[-/](\d{1,2})", raw)
    if match:
        return date(hoy.year, int(match.group(2)), int(match.group(1)))

    if raw in DIAS_SEMANA_NORMALIZADOS:
        indice = DIAS_SEMANA_NORMALIZADOS[raw]
        return hoy - timedelta(days=(hoy.weekday() - indice) % 7)

    raise ValueError(f"No entendí la fecha '{value}'. Usa hoy, ayer o AAAA-MM-DD.")


def parsear_fecha_hora(value: Any, hora_por_defecto: str = "09:00") -> str:
    """Devuelve 'AAAA-MM-DDTHH:MM', formato que consume el frontend."""
    raw = str(value or "").strip()
    hora = hora_por_defecto
    match = re.search(r"(\d{1,2}):(\d{2})\s*$", raw)
    if match:
        hora = f"{int(match.group(1)):02d}:{match.group(2)}"
        raw = raw[: match.start()].strip()
    dia = parsear_fecha(raw or "hoy")
    return f"{dia.isoformat()}T{hora}"


def indice_dia_semana(value: Any) -> int:
    raw = _normalizar(value)
    if raw in ("hoy", ""):
        return date.today().weekday()
    if raw in DIAS_SEMANA_NORMALIZADOS:
        return DIAS_SEMANA_NORMALIZADOS[raw]
    if raw.isdigit() and 0 <= int(raw) <= 6:
        return int(raw)
    raise ValueError("Indica un día entre lunes y domingo.")


def resumir_error(error: Exception) -> str:
    detail = getattr(error, "detail", None)
    if detail:
        return str(detail)
    return str(error) or "Ocurrió un error inesperado."


# ---------------------------------------------------------------------------
# Especificación de herramientas
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    params_model: type[BaseModel]
    handler: Callable[..., Any]
    destructive: bool = False

    def parameters_schema(self) -> dict[str, Any]:
        schema = self.params_model.model_json_schema()
        schema.setdefault("type", "object")
        schema.setdefault("properties", {})
        return schema

    def function_schema(self) -> dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters_schema(),
            },
        }


# ---------------------------------------------------------------------------
# Esquemas de argumentos
# ---------------------------------------------------------------------------
class SinArgumentos(BaseModel):
    pass


class ArgsResumen(BaseModel):
    pass


class ArgsListar(BaseModel):
    limite: int = Field(default=10, ge=1, le=50, description="Máximo de registros a devolver.")


class ArgsCrearIngreso(BaseModel):
    monto: float = Field(gt=0, description="Monto en pesos colombianos.")
    fuente: str = Field(default="Otro", description="Origen del dinero, por ejemplo Sueldo, Freelance, Venta.")
    fecha: str = Field(default="hoy", description="hoy, ayer o AAAA-MM-DD.")
    medio_pago: str | None = Field(default=None, description="Nombre del medio de pago, por ejemplo Nequi o Bancolombia.")
    nota: str = ""


class ArgsCrearGastoVariable(BaseModel):
    monto: float = Field(gt=0, description="Monto en pesos colombianos.")
    categoria: str = Field(description="Categoría del gasto, por ejemplo Comida, Transporte, Salud.")
    fecha: str = Field(default="hoy", description="hoy, ayer o AAAA-MM-DD.")
    medio_pago: str | None = Field(default=None, description="Nombre del medio de pago usado.")
    nota: str = ""


class ArgsCrearGastoFijo(BaseModel):
    nombre: str = Field(description="Nombre del gasto fijo, por ejemplo Arriendo.")
    monto: float = Field(gt=0, description="Monto mensual en pesos colombianos.")
    tipo: Literal["mensual", "por_kilometraje"] = "mensual"
    activo: bool = True


class ArgsCrearAhorro(BaseModel):
    nombre: str = Field(description="Nombre de la meta de ahorro.")
    monto_objetivo: float = Field(gt=0, description="Cuánto se quiere ahorrar en total.")
    fecha_limite: str | None = Field(default=None, description="Fecha límite opcional, AAAA-MM-DD.")
    medio_pago: str | None = Field(default=None, description="Medio de pago asociado, opcional.")
    nota: str = ""


class ArgsAporteAhorro(BaseModel):
    meta: str = Field(description="Nombre de la meta de ahorro.")
    monto: float = Field(gt=0, description="Monto del aporte o retiro.")
    fecha: str = Field(default="hoy")
    medio_pago: str | None = None
    nota: str = ""


class ArgsTransferencia(BaseModel):
    origen: str = Field(description="Nombre del medio de pago de origen.")
    destino: str = Field(description="Nombre del medio de pago de destino.")
    monto: float = Field(gt=0)
    fecha: str = Field(default="hoy")
    nota: str = ""


class ArgsCrearMedioPago(BaseModel):
    nombre: str = Field(description="Nombre del nuevo medio de pago.")
    tipo: Literal[
        "efectivo_billetes",
        "efectivo_monedas",
        "cuenta_bancaria",
        "billetera_digital",
        "tarjeta",
        "otro",
    ] = "otro"
    saldo_inicial: float = Field(default=0.0, ge=0)


class ArgsResumenHabitos(BaseModel):
    fecha: str = Field(default="hoy", description="hoy, ayer o AAAA-MM-DD.")


class ArgsMarcarHabito(BaseModel):
    nombre: str = Field(description="Nombre del hábito.")
    fecha: str = Field(default="hoy")
    completado: bool = Field(default=True, description="true para marcar hecho, false para desmarcar.")


class ArgsCrearHabito(BaseModel):
    nombre: str = Field(min_length=1)
    icono: str = "✅"
    color: str = "#5de8c4"


class ArgsConsultarRutina(BaseModel):
    dia: str = Field(default="hoy", description="hoy, lunes..domingo, o 'semana'.")


class ArgsCrearBloque(BaseModel):
    dia: str = Field(description="lunes..domingo")
    hora_inicio: str = Field(pattern=r"^\d{2}:\d{2}$")
    hora_fin: str = Field(pattern=r"^\d{2}:\d{2}$")
    titulo: str = Field(min_length=1)
    descripcion: str = ""
    tipo_bloque: str = "Flexible"


class ArgsCrearRecordatorio(BaseModel):
    titulo: str = Field(min_length=1)
    fecha_disparo: str = Field(description="Cuándo avisar: 'hoy 18:00', 'mañana 09:00' o AAAA-MM-DDTHH:MM.")
    descripcion: str = ""
    anticipacion_minutos: int = Field(default=0, ge=0)


class ArgsCrearFechaEspecial(BaseModel):
    nombre: str = Field(min_length=1)
    fecha: str = Field(description="Fecha AAAA-MM-DD.")
    tipo: Literal["cumpleanos", "aniversario", "evento", "otro"] = "cumpleanos"
    recordar_dias_antes: int = Field(default=1, ge=0)
    nota: str = ""


class ArgsKilometraje(BaseModel):
    km_actuales: int = Field(ge=0, description="Lectura actual del odómetro.")
    fecha: str = Field(default="hoy")
    nota: str = ""


class ArgsCambioAceite(BaseModel):
    costo: float | None = Field(default=None, ge=0, description="Costo del cambio de aceite, si se registra como gasto.")
    crear_gasto: bool = False
    medio_pago: str | None = None
    nota: str = ""


class ArgsEliminar(BaseModel):
    entidad: Literal[
        "ingreso",
        "gasto_variable",
        "gasto_fijo",
        "ahorro",
        "habito",
        "recordatorio",
        "fecha_especial",
        "bloque_rutina",
        "transferencia",
        "medio_pago",
    ] = Field(description="Tipo de registro a eliminar.")
    id: int = Field(ge=1, description="Id del registro, obtenido con una herramienta de listado.")


# ---------------------------------------------------------------------------
# Utilidades de resolución contra la base de datos
# ---------------------------------------------------------------------------
def _medio_pago_id(m: Any, user: Any, nombre: str | None) -> int | None:
    if not nombre:
        return None
    medios = m.list_medios_pago(user=user)
    return int(elegir_por_nombre(medios, nombre)["id"])


def _categoria_id(m: Any, user: Any, nombre: str) -> int:
    categorias = m.list_categorias(user=user)
    return int(elegir_por_nombre(categorias, nombre)["id"])


def _meta_ahorro(m: Any, user: Any, nombre: str) -> dict[str, Any]:
    return elegir_por_nombre(m.list_ahorros(user=user), nombre)


def _habito(m: Any, user: Any, nombre: str) -> dict[str, Any]:
    return elegir_por_nombre(m.list_habitos(user=user), nombre)


# ---------------------------------------------------------------------------
# Handlers (delegan en los endpoints existentes de main.py)
# ---------------------------------------------------------------------------
def _resumen_mes(m: Any, user: Any, _: BaseModel) -> dict[str, Any]:
    data = m.resumen_mes_actual(user=user)
    return {
        "mes": data["mes"],
        "ingresos": data["total_ingresos"],
        "gastos_fijos": data["total_gastos_fijos"],
        "gastos_variables": data["total_gastos_variables"],
        "saldo": data["saldo"],
        "saldo_total_medios": data["saldo_total_medios"],
        "total_ahorros": data["total_ahorros"],
        "medios": [
            {"nombre": medio["nombre"], "saldo": medio["saldo_actual"], "activo": medio["activo"]}
            for medio in data["saldos_medios"]
        ],
        "metas_ahorro": [
            {
                "nombre": meta["nombre"],
                "objetivo": meta["monto_objetivo"],
                "actual": meta["monto_actual"],
                "porcentaje": meta["porcentaje"],
            }
            for meta in data["metas_ahorro"]
        ],
    }


def _gastos_por_categoria(m: Any, user: Any, _: BaseModel) -> list[dict[str, Any]]:
    return [
        {"categoria": row["nombre"], "total": row["total"], "porcentaje": row["porcentaje"], "cantidad": row["cantidad"]}
        for row in m.resumen_mes_actual_por_categoria(user=user)
    ]


def _listar_ingresos(m: Any, user: Any, args: ArgsListar) -> list[dict[str, Any]]:
    return [
        {"id": row["id"], "fecha": row["fecha"], "fuente": row["fuente"], "monto": row["monto"], "nota": row["nota"]}
        for row in m.list_ingresos(user=user)[: args.limite]
    ]


def _listar_gastos_variables(m: Any, user: Any, args: ArgsListar) -> list[dict[str, Any]]:
    categorias = {row["id"]: row["nombre"] for row in m.list_categorias(user=user)}
    return [
        {
            "id": row["id"],
            "fecha": row["fecha"],
            "categoria": categorias.get(row["categoria_id"], row["categoria_id"]),
            "monto": row["monto"],
            "nota": row["nota"],
        }
        for row in m.list_gastos_variables(user=user)[: args.limite]
    ]


def _listar_gastos_fijos(m: Any, user: Any, _: BaseModel) -> list[dict[str, Any]]:
    return [
        {"id": row["id"], "nombre": row["nombre"], "monto": row["monto"], "tipo": row["tipo"], "activo": bool(row["activo"])}
        for row in m.list_gastos_fijos(user=user)
    ]


def _listar_categorias(m: Any, user: Any, _: BaseModel) -> list[dict[str, Any]]:
    return [{"id": row["id"], "nombre": row["nombre"], "activa": bool(row["activa"])} for row in m.list_categorias(user=user)]


def _listar_medios(m: Any, user: Any, _: BaseModel) -> list[dict[str, Any]]:
    return [
        {"id": row["id"], "nombre": row["nombre"], "tipo": row["tipo"], "saldo": row["saldo_actual"], "activo": row["activo"]}
        for row in m.list_medios_pago(user=user)
    ]


def _listar_ahorros(m: Any, user: Any, _: BaseModel) -> list[dict[str, Any]]:
    return [
        {
            "id": row["id"],
            "nombre": row["nombre"],
            "objetivo": row["monto_objetivo"],
            "actual": row["monto_actual"],
            "porcentaje": row["porcentaje"],
            "activo": row["activo"],
        }
        for row in m.list_ahorros(user=user)
    ]


def _listar_transferencias(m: Any, user: Any, args: ArgsListar) -> list[dict[str, Any]]:
    return [dict(row) for row in m.list_transferencias(user=user)[: args.limite]]


def _crear_ingreso(m: Any, user: Any, args: ArgsCrearIngreso) -> dict[str, Any]:
    payload = m.IngresoInput(
        fecha=parsear_fecha(args.fecha),
        fuente=args.fuente,
        monto=args.monto,
        medio_pago_id=_medio_pago_id(m, user, args.medio_pago),
        nota=args.nota,
    )
    created = m.create_ingreso(payload, user)
    return {**created, "fuente": args.fuente, "medio_pago": args.medio_pago}


def _crear_gasto_variable(m: Any, user: Any, args: ArgsCrearGastoVariable) -> dict[str, Any]:
    payload = m.GastoVariableInput(
        fecha=parsear_fecha(args.fecha),
        categoria_id=_categoria_id(m, user, args.categoria),
        monto=args.monto,
        medio_pago_id=_medio_pago_id(m, user, args.medio_pago),
        nota=args.nota,
    )
    created = m.create_gasto_variable(payload, user)
    return {**created, "categoria": args.categoria, "medio_pago": args.medio_pago}


def _crear_gasto_fijo(m: Any, user: Any, args: ArgsCrearGastoFijo) -> dict[str, Any]:
    payload = m.GastoFijoInput(nombre=args.nombre, monto=args.monto, tipo=args.tipo, activo=args.activo)
    return m.create_gasto_fijo(payload, user)


def _crear_ahorro(m: Any, user: Any, args: ArgsCrearAhorro) -> dict[str, Any]:
    payload = m.MetaAhorroInput(
        nombre=args.nombre,
        monto_objetivo=args.monto_objetivo,
        fecha_limite=parsear_fecha(args.fecha_limite) if args.fecha_limite else None,
        medio_pago_id=_medio_pago_id(m, user, args.medio_pago),
        nota=args.nota,
    )
    return m.create_ahorro(payload, user)


def _movimiento_ahorro(m: Any, user: Any, args: ArgsAporteAhorro, tipo: str) -> dict[str, Any]:
    meta = _meta_ahorro(m, user, args.meta)
    payload = m.MovimientoAhorroInput(
        meta_ahorro_id=int(meta["id"]),
        tipo=tipo,
        monto=args.monto,
        fecha=parsear_fecha(args.fecha),
        medio_pago_id=_medio_pago_id(m, user, args.medio_pago),
        nota=args.nota,
    )
    return m.aportar_ahorro(int(meta["id"]), payload, user)


def _transferir(m: Any, user: Any, args: ArgsTransferencia) -> dict[str, Any]:
    origen = _medio_pago_id(m, user, args.origen)
    destino = _medio_pago_id(m, user, args.destino)
    payload = m.TransferenciaMedioInput(
        fecha=parsear_fecha(args.fecha),
        origen_id=int(origen or 0),
        destino_id=int(destino or 0),
        monto=args.monto,
        nota=args.nota,
    )
    created = m.create_transferencia(payload, user)
    return {**created, "origen": args.origen, "destino": args.destino}


def _crear_medio_pago(m: Any, user: Any, args: ArgsCrearMedioPago) -> dict[str, Any]:
    payload = m.MedioPagoInput(nombre=args.nombre, tipo=args.tipo, saldo_inicial=args.saldo_inicial)
    return m.create_medio_pago(payload, user)


def _listar_habitos(m: Any, user: Any, _: BaseModel) -> list[dict[str, Any]]:
    return [
        {"id": row["id"], "nombre": row["nombre"], "activo": row["activo"]}
        for row in m.list_habitos(user=user)
    ]


def _resumen_habitos(m: Any, user: Any, args: ArgsResumenHabitos) -> list[dict[str, Any]]:
    return m.resumen_habitos(parsear_fecha(args.fecha), user=user)


def _marcar_habito(m: Any, user: Any, args: ArgsMarcarHabito) -> dict[str, Any]:
    habito = _habito(m, user, args.nombre)
    dia = parsear_fecha(args.fecha)
    actual = next(
        (item["completado"] for item in m.resumen_habitos(dia, user=user) if item["id"] == habito["id"]),
        False,
    )
    if bool(actual) != bool(args.completado):
        resultado = m.toggle_habito(int(habito["id"]), dia, user)
    else:
        resultado = {"habito_id": habito["id"], "fecha": dia.isoformat(), "completado": bool(actual)}
    return {"habito": habito["nombre"], **resultado}


def _crear_habito(m: Any, user: Any, args: ArgsCrearHabito) -> dict[str, Any]:
    payload = m.HabitoInput(nombre=args.nombre, icono=args.icono, color=args.color)
    return m.create_habito(payload, user)


def _consultar_rutina(m: Any, user: Any, args: ArgsConsultarRutina) -> Any:
    if _normalizar(args.dia) in ("semana", "toda la semana", "semanal"):
        return [
            {"dia": DIAS_SEMANA[dia["dia_semana"]], "bloques": dia["bloques"]}
            for dia in m.rutina_semana(user=user)
            if dia["bloques"]
        ]
    indice = indice_dia_semana(args.dia)
    bloques = m.bloques_dia(indice, user=user)
    return {"dia": DIAS_SEMANA[indice], "bloques": bloques}


def _crear_bloque(m: Any, user: Any, args: ArgsCrearBloque) -> dict[str, Any]:
    indice = indice_dia_semana(args.dia)
    payload = m.BloqueRutinaInput(
        dia_semana=indice,
        hora_inicio=args.hora_inicio,
        hora_fin=args.hora_fin,
        titulo=args.titulo,
        descripcion=args.descripcion,
        tipo_bloque=args.tipo_bloque,
    )
    return m.create_bloque_rutina(payload, user)


def _listar_recordatorios(m: Any, user: Any, args: ArgsListar) -> list[dict[str, Any]]:
    return [
        {
            "id": row["id"],
            "titulo": row["titulo"],
            "fecha_disparo": row["fecha_disparo"],
            "activo": row["activo"],
            "disparado": row["disparado"],
        }
        for row in m.list_recordatorios(user=user)[: args.limite]
    ]


def _crear_recordatorio(m: Any, user: Any, args: ArgsCrearRecordatorio) -> dict[str, Any]:
    payload = m.RecordatorioInput(
        titulo=args.titulo,
        descripcion=args.descripcion,
        tipo="puntual",
        fecha_disparo=parsear_fecha_hora(args.fecha_disparo),
        anticipacion_minutos=args.anticipacion_minutos,
        canal="notificacion",
    )
    return m.create_recordatorio(payload, user)


def _listar_fechas_especiales(m: Any, user: Any, _: BaseModel) -> list[dict[str, Any]]:
    return [
        {
            "id": row["id"],
            "nombre": row["nombre"],
            "fecha": row["fecha"],
            "tipo": row["tipo"],
            "dias_restantes": row["dias_restantes"],
        }
        for row in m.list_fechas_especiales(user=user)
    ]


def _crear_fecha_especial(m: Any, user: Any, args: ArgsCrearFechaEspecial) -> dict[str, Any]:
    payload = m.FechaEspecialInput(
        nombre=args.nombre,
        fecha=parsear_fecha(args.fecha).isoformat(),
        tipo=args.tipo,
        recordar_dias_antes=args.recordar_dias_antes,
        nota=args.nota,
    )
    return m.create_fecha_especial(payload, user)


def _estado_aceite(m: Any, user: Any, _: BaseModel) -> dict[str, Any]:
    return m.moto_estado_aceite(user=user)


def _registrar_km(m: Any, user: Any, args: ArgsKilometraje) -> dict[str, Any]:
    payload = m.KilometrajeInput(fecha=parsear_fecha(args.fecha), km_actuales=args.km_actuales, nota=args.nota)
    return m.create_kilometraje(payload, user)


def _cambio_aceite(m: Any, user: Any, args: ArgsCambioAceite) -> dict[str, Any]:
    payload = m.CambioAceiteInput(
        costo=args.costo,
        medio_pago_id=_medio_pago_id(m, user, args.medio_pago),
        crear_gasto=args.crear_gasto,
        nota=args.nota,
    )
    return m.moto_cambio_aceite(payload, user)


_DELETES: dict[str, tuple[str, str]] = {
    "ingreso": ("ingresos", "delete_ingreso"),
    "gasto_variable": ("gastos_variables", "delete_gasto_variable"),
    "gasto_fijo": ("gastos_fijos", "delete_gasto_fijo"),
    "ahorro": ("metas_ahorro", "delete_ahorro"),
    "habito": ("habitos", "delete_habito"),
    "recordatorio": ("recordatorios", "delete_recordatorio"),
    "fecha_especial": ("fechas_especiales", "delete_fecha_especial"),
    "bloque_rutina": ("bloques_rutina", "delete_bloque_rutina"),
    "transferencia": ("transferencias_medios", "delete_transferencia"),
    "medio_pago": ("medios_pago", "delete_medio_pago"),
}


def _eliminar(m: Any, user: Any, args: ArgsEliminar) -> dict[str, Any]:
    if args.entidad not in _DELETES:
        raise ValueError(f"No se puede eliminar '{args.entidad}'.")
    funcion = getattr(m, _DELETES[args.entidad][1])
    funcion(args.id, user)
    return {"eliminado": True, "entidad": args.entidad, "id": args.id}


# ---------------------------------------------------------------------------
# Catálogo
# ---------------------------------------------------------------------------
def build_tools(m: Any) -> dict[str, ToolSpec]:
    """Construye el catálogo de herramientas para el módulo ``main`` dado."""
    specs = [
        # Finanzas: lectura
        ToolSpec(
            "resumen_mes_actual",
            "Resumen financiero del mes: ingresos, gastos fijos y variables, saldo, saldos por medio de pago y metas de ahorro.",
            ArgsResumen,
            _resumen_mes,
        ),
        ToolSpec(
            "gastos_por_categoria",
            "Desglose de los gastos variables del mes agrupados por categoría.",
            ArgsResumen,
            _gastos_por_categoria,
        ),
        ToolSpec("listar_ingresos", "Últimos ingresos registrados.", ArgsListar, _listar_ingresos),
        ToolSpec(
            "listar_gastos_variables",
            "Últimos gastos variables registrados, con su categoría.",
            ArgsListar,
            _listar_gastos_variables,
        ),
        ToolSpec("listar_gastos_fijos", "Gastos fijos configurados.", ArgsResumen, _listar_gastos_fijos),
        ToolSpec("listar_categorias", "Categorías de gasto disponibles.", ArgsResumen, _listar_categorias),
        ToolSpec("listar_medios_pago", "Medios de pago y su saldo actual.", ArgsResumen, _listar_medios),
        ToolSpec("listar_ahorros", "Metas de ahorro y su progreso.", ArgsResumen, _listar_ahorros),
        ToolSpec("listar_transferencias", "Transferencias recientes entre medios de pago.", ArgsListar, _listar_transferencias),
        # Finanzas: escritura
        ToolSpec(
            "crear_ingreso",
            "Registra un ingreso de dinero.",
            ArgsCrearIngreso,
            _crear_ingreso,
        ),
        ToolSpec(
            "crear_gasto_variable",
            "Registra un gasto variable del día a día.",
            ArgsCrearGastoVariable,
            _crear_gasto_variable,
        ),
        ToolSpec("crear_gasto_fijo", "Crea un gasto fijo mensual.", ArgsCrearGastoFijo, _crear_gasto_fijo),
        ToolSpec("crear_ahorro", "Crea una meta de ahorro.", ArgsCrearAhorro, _crear_ahorro),
        ToolSpec(
            "aportar_ahorro",
            "Aporta dinero a una meta de ahorro.",
            ArgsAporteAhorro,
            lambda m, user, args: _movimiento_ahorro(m, user, args, "aporte"),
        ),
        ToolSpec(
            "retirar_ahorro",
            "Retira dinero de una meta de ahorro.",
            ArgsAporteAhorro,
            lambda m, user, args: _movimiento_ahorro(m, user, args, "retiro"),
            destructive=True,
        ),
        ToolSpec(
            "transferir_entre_medios",
            "Transfiere dinero entre dos medios de pago.",
            ArgsTransferencia,
            _transferir,
            destructive=True,
        ),
        ToolSpec("crear_medio_pago", "Crea un medio de pago o cuenta.", ArgsCrearMedioPago, _crear_medio_pago),
        # Hábitos
        ToolSpec("listar_habitos", "Hábitos configurados.", ArgsResumen, _listar_habitos),
        ToolSpec("resumen_habitos", "Estado y racha de los hábitos en una fecha.", ArgsResumenHabitos, _resumen_habitos),
        ToolSpec("marcar_habito", "Marca o desmarca un hábito como completado.", ArgsMarcarHabito, _marcar_habito),
        ToolSpec("crear_habito", "Crea un hábito nuevo.", ArgsCrearHabito, _crear_habito),
        # Rutina
        ToolSpec("consultar_rutina", "Consulta los bloques de la rutina de un día o de toda la semana.", ArgsConsultarRutina, _consultar_rutina),
        ToolSpec("crear_bloque_rutina", "Agrega un bloque a la rutina semanal.", ArgsCrearBloque, _crear_bloque),
        # Recordatorios y fechas
        ToolSpec("listar_recordatorios", "Recordatorios activos y su próxima fecha.", ArgsListar, _listar_recordatorios),
        ToolSpec("crear_recordatorio", "Crea un recordatorio para una fecha y hora.", ArgsCrearRecordatorio, _crear_recordatorio),
        ToolSpec("listar_fechas_especiales", "Fechas especiales y cuántos días faltan.", ArgsResumen, _listar_fechas_especiales),
        ToolSpec("crear_fecha_especial", "Registra un cumpleaños, aniversario o evento.", ArgsCrearFechaEspecial, _crear_fecha_especial),
        # Moto
        ToolSpec("estado_aceite_moto", "Estado del aceite de la moto y kilómetros restantes.", ArgsResumen, _estado_aceite),
        ToolSpec("registrar_kilometraje", "Registra el kilometraje actual de la moto.", ArgsKilometraje, _registrar_km),
        ToolSpec(
            "registrar_cambio_aceite",
            "Registra un cambio de aceite y reinicia el contador.",
            ArgsCambioAceite,
            _cambio_aceite,
            destructive=True,
        ),
        # Borrado (siempre con confirmación)
        ToolSpec(
            "eliminar_registro",
            "Elimina un registro existente por tipo e id. Requiere confirmación del usuario.",
            ArgsEliminar,
            _eliminar,
            destructive=True,
        ),
    ]
    return {spec.name: spec for spec in specs}
