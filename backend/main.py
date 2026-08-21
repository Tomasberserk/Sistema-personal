from __future__ import annotations

import os
import sqlite3
from contextlib import closing
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

try:
    import psycopg2
    import psycopg2.extras

    _HAS_PSYCOPG2 = True
except ImportError:
    _HAS_PSYCOPG2 = False


ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "jarvis.sqlite3"

def _is_postgres() -> bool:
    url = os.environ.get("DATABASE_URL", "")
    return url.startswith("postgres://") or url.startswith("postgresql://")

IS_POSTGRES = _is_postgres()

if IS_POSTGRES and not _HAS_PSYCOPG2:
    raise RuntimeError(
        "DATABASE_URL está definida como PostgreSQL pero falta psycopg2. "
        "Instalá psycopg2-binary (agregado a requirements.txt)."
    )

_INTEGRITY_ERRORS: tuple[type[BaseException], ...] = (sqlite3.IntegrityError,)
if _HAS_PSYCOPG2:
    _INTEGRITY_ERRORS = (sqlite3.IntegrityError, psycopg2.IntegrityError)

Fuente = str
TipoGastoFijo = Literal["mensual", "por_kilometraje"]
TipoMedioPago = Literal[
    "efectivo_billetes",
    "efectivo_monedas",
    "cuenta_bancaria",
    "billetera_digital",
    "tarjeta",
    "otro",
]

DEFAULT_CATEGORIAS = [
    ("Comida", "🍔", "#e85d4a"),
    ("Transporte", "🛵", "#5d8ae8"),
    ("Gasolina", "⛽", "#e8a85d"),
    ("Entretenimiento", "🎮", "#a85de8"),
    ("Ropa", "👕", "#5de8c4"),
    ("Medicina", "💊", "#e85d8a"),
    ("Regalos", "🎁", "#e8d95d"),
    ("Hogar", "🏠", "#5de87a"),
    ("Tecnologia", "📱", "#5dc4e8"),
    ("Aseo personal", "🧴", "#e8755d"),
]

DEFAULT_MEDIOS_PAGO = [
    ("Efectivo (Billetes)", "efectivo_billetes", "💵", "#5de87a", 0.0),
    ("Efectivo (Monedas)", "efectivo_monedas", "🪙", "#e8d95d", 0.0),
    ("Bancolombia", "cuenta_bancaria", "🏦", "#e85d4a", 0.0),
    ("Nequi", "billetera_digital", "📱", "#a85de8", 0.0),
]

DIAS_SEMANA = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]


class MedioPagoInput(BaseModel):
    nombre: str = Field(min_length=1)
    tipo: TipoMedioPago
    icono: str = "💵"
    color: str = "#5de87a"
    saldo_inicial: float = Field(default=0.0, ge=0)
    activo: bool = True


class MedioPagoUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1)
    tipo: TipoMedioPago | None = None
    icono: str | None = None
    color: str | None = None
    saldo_inicial: float | None = Field(default=None, ge=0)
    activo: bool | None = None


class MedioPago(MedioPagoInput):
    id: int


class MedioPagoSaldo(MedioPago):
    saldo_actual: float
    total_ingresos: float
    total_gastos: float
    total_transferencias_recibidas: float
    total_transferencias_enviadas: float


class TransferenciaMedioInput(BaseModel):
    fecha: date
    origen_id: int = Field(ge=1)
    destino_id: int = Field(ge=1)
    monto: float = Field(gt=0)
    nota: str = ""


class TransferenciaMedio(TransferenciaMedioInput):
    id: int


class IngresoInput(BaseModel):
    fecha: date
    fuente: Fuente
    monto: float = Field(ge=0)
    medio_pago_id: int | None = Field(default=None, ge=1)
    nota: str = ""


class IngresoUpdate(BaseModel):
    fecha: date | None = None
    fuente: Fuente | None = None
    monto: float | None = Field(default=None, ge=0)
    medio_pago_id: int | None = Field(default=None, ge=1)
    nota: str | None = None


class Ingreso(IngresoInput):
    id: int
    model_config = ConfigDict(from_attributes=True)


class GastoFijoInput(BaseModel):
    nombre: str = Field(min_length=1)
    monto: float = Field(ge=0)
    tipo: TipoGastoFijo
    activo: bool = True


class GastoFijoUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1)
    monto: float | None = Field(default=None, ge=0)
    tipo: TipoGastoFijo | None = None
    activo: bool | None = None


class GastoFijo(GastoFijoInput):
    id: int


class CategoriaInput(BaseModel):
    nombre: str = Field(min_length=1)
    icono: str = "🏷️"
    color: str = "#333333"
    activa: bool = True


class CategoriaUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1)
    icono: str | None = None
    color: str | None = None
    activa: bool | None = None


class Categoria(CategoriaInput):
    id: int


class GastoVariableInput(BaseModel):
    fecha: date
    categoria_id: int = Field(ge=1)
    monto: float = Field(ge=0)
    medio_pago_id: int | None = Field(default=None, ge=1)
    nota: str = ""


class GastoVariableUpdate(BaseModel):
    fecha: date | None = None
    categoria_id: int | None = Field(default=None, ge=1)
    monto: float | None = Field(default=None, ge=0)
    medio_pago_id: int | None = Field(default=None, ge=1)
    nota: str | None = None


class GastoVariable(GastoVariableInput):
    id: int


class KilometrajeInput(BaseModel):
    fecha: date
    km_actuales: int = Field(ge=0)
    nota: str = ""


class KilometrajeUpdate(BaseModel):
    fecha: date | None = None
    km_actuales: int | None = Field(default=None, ge=0)
    nota: str | None = None


class Kilometraje(KilometrajeInput):
    id: int


class KilometrajeResumen(BaseModel):
    km_actuales: int
    registros: int


class HabitoInput(BaseModel):
    nombre: str = Field(min_length=1)
    icono: str = "âœ…"
    color: str = "#5de8c4"
    activo: bool = True


class HabitoUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1)
    icono: str | None = None
    color: str | None = None
    activo: bool | None = None


class Habito(HabitoInput):
    id: int
    creado_en: str


class HabitoResumenItem(BaseModel):
    id: int
    nombre: str
    icono: str
    color: str
    racha: int
    completado: bool


class CheckHabitoResult(BaseModel):
    habito_id: int
    fecha: str
    completado: bool


class Racha(BaseModel):
    id: int
    racha: int


class BloqueRutinaInput(BaseModel):
    dia_semana: int = Field(ge=0, le=6)
    hora_inicio: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    hora_fin: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    titulo: str = Field(min_length=1)
    descripcion: str = ""
    color: str = "#5d8ae8"
    icono: str = "â°"
    activo: bool = True


class BloqueRutinaUpdate(BaseModel):
    dia_semana: int | None = Field(default=None, ge=0, le=6)
    hora_inicio: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    hora_fin: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    titulo: str | None = Field(default=None, min_length=1)
    descripcion: str | None = None
    color: str | None = None
    icono: str | None = None
    activo: bool | None = None


class BloqueRutina(BloqueRutinaInput):
    id: int


class DiaRutina(BaseModel):
    dia_semana: int
    bloques: list[BloqueRutina]


class ResumenMensual(BaseModel):
    mes: str
    total_ingresos: float
    total_gastos_fijos: float
    total_gastos_variables: float
    saldo: float
    saldo_total_medios: float = 0.0
    saldos_medios: list[MedioPagoSaldo] = []


class ResumenCategoria(BaseModel):
    id: int
    nombre: str
    icono: str
    color: str
    cantidad: int
    total: float
    porcentaje: float


class CambioAceiteInput(BaseModel):
    costo: float | None = Field(default=None, ge=0)
    medio_pago_id: int | None = Field(default=None, ge=1)
    crear_gasto: bool = False
    nota: str = ""


class MotoConfigUpdate(BaseModel):
    km_ultimo_cambio: int | None = Field(default=None, ge=0)
    intervalo_km: int | None = Field(default=None, ge=1)
    alerta_km_antes: int | None = Field(default=None, ge=0)


class EstadoAceite(BaseModel):
    km_actuales: int
    km_ultimo_cambio: int
    km_proximo_cambio: int
    km_restantes: int
    alerta: bool
    porcentaje_vida_aceite: float
    intervalo_km: int
    alerta_km_antes: int


TipoFechaEspecial = Literal["cumpleanos", "aniversario", "evento", "otro"]
TipoRecordatorio = Literal["puntual", "recurrente", "fecha_especial", "relacionado"]
CanalNotificacion = Literal["push", "in_app", "todos"]


class FechaEspecialInput(BaseModel):
    nombre: str = Field(min_length=1)
    fecha: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")  # YYYY-MM-DD
    tipo: TipoFechaEspecial = "cumpleanos"
    icono: str = "🎂"
    color: str = "#e85d8a"
    recordar_dias_antes: int = Field(default=1, ge=0)
    nota: str = ""


class FechaEspecialUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1)
    fecha: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    tipo: TipoFechaEspecial | None = None
    icono: str | None = None
    color: str | None = None
    recordar_dias_antes: int | None = Field(default=None, ge=0)
    nota: str | None = None


class FechaEspecial(FechaEspecialInput):
    id: int
    dias_restantes: int
    edad_o_aniversario: int | None = None


class RecordatorioInput(BaseModel):
    titulo: str = Field(min_length=1)
    descripcion: str = ""
    tipo: TipoRecordatorio = "puntual"
    fecha_disparo: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$")
    regla_recurrencia: str | None = None  # ej. 'INTERVAL_HOURS:2', 'DAILY', 'WEEKLY:0,2,4'
    anticipacion_minutos: int = Field(default=0, ge=0)
    canal: CanalNotificacion = "todos"
    modulo_origen: str | None = None
    referencia_id: int | None = None
    activo: bool = True


class RecordatorioUpdate(BaseModel):
    titulo: str | None = Field(default=None, min_length=1)
    descripcion: str | None = None
    tipo: TipoRecordatorio | None = None
    fecha_disparo: str | None = None
    regla_recurrencia: str | None = None
    anticipacion_minutos: int | None = Field(default=None, ge=0)
    canal: CanalNotificacion | None = None
    activo: bool | None = None


class Recordatorio(RecordatorioInput):
    id: int
    disparado: bool = False


def _normalize_sql(sql: str) -> str:
    """Asegura el placeholder correcto según el motor (%s para PostgreSQL, ? para SQLite)."""
    if _is_postgres():
        return sql.replace("?", "%s")
    return sql.replace("%s", "?")


def _split_sql_statements(sql: str) -> list[str]:
    return [part.strip() for part in sql.split(";") if part.strip()]


class _Row:
    """Fila con acceso por nombre o por posición (emula sqlite3.Row)."""

    def __init__(self, mapping: dict[str, Any] | Any):
        if isinstance(mapping, (dict, psycopg2.extras.RealDictRow)):
            self._mapping = dict(mapping)
        elif hasattr(mapping, "_asdict"):
            self._mapping = mapping._asdict()
        else:
            self._mapping = dict(mapping)

    def __getitem__(self, key: int | str) -> Any:
        if isinstance(key, int):
            return list(self._mapping.values())[key]
        return self._mapping[key]

    def __iter__(self):
        return iter(self._mapping)

    def __len__(self) -> int:
        return len(self._mapping)

    def keys(self) -> list[str]:
        return list(self._mapping.keys())


class _PgCursor:
    def __init__(self, pg_cursor: Any):
        self._cursor = pg_cursor

    @property
    def lastrowid(self) -> Any:
        return getattr(self._cursor, "lastrowid", None)

    def fetchone(self) -> _Row | None:
        row = self._cursor.fetchone()
        return _Row(row) if row is not None else None

    def fetchall(self) -> list[_Row]:
        return [_Row(row) for row in self._cursor.fetchall()]


class _PgConnection:
    """Wrapper de una conexión psycopg2 con API similar a sqlite3."""

    def __init__(self, pg_conn: Any):
        self._conn = pg_conn

    def execute(self, sql: str, params: Any = None) -> _PgCursor:
        cursor = self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        normalized = _normalize_sql(sql)
        if params is None:
            cursor.execute(normalized)
        else:
            cursor.execute(normalized, params)
        return _PgCursor(cursor)

    def executemany(self, sql: str, seq_of_params: Any) -> _PgCursor:
        cursor = self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        normalized = _normalize_sql(sql)
        cursor.executemany(normalized, seq_of_params)
        return _PgCursor(cursor)

    def executescript(self, script: str) -> None:
        cursor = self._conn.cursor()
        for statement in _split_sql_statements(script):
            if statement.startswith("--") or statement.startswith("/*"):
                continue
            cursor.execute(statement)
        cursor.close()

    def commit(self) -> None:
        self._conn.commit()

    def close(self) -> None:
        self._conn.close()


class _SqliteConnection:
    """Wrapper de una conexión sqlite3 con API uniforme (_normalize_sql)."""

    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    def execute(self, sql: str, params: Any = None) -> Any:
        normalized = _normalize_sql(sql)
        if params is None:
            return self._conn.execute(normalized)
        return self._conn.execute(normalized, params)

    def executemany(self, sql: str, seq_of_params: Any) -> Any:
        normalized = _normalize_sql(sql)
        return self._conn.executemany(normalized, seq_of_params)

    def executescript(self, script: str) -> None:
        self._conn.executescript(script)

    def commit(self) -> None:
        self._conn.commit()

    def close(self) -> None:
        self._conn.close()


def get_connection() -> Any:
    if _is_postgres():
        url = os.environ.get("DATABASE_URL", "")
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        connection = psycopg2.connect(url)
        connection.set_client_encoding("UTF8")
        connection.set_session(autocommit=False)
        return _PgConnection(connection)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return _SqliteConnection(connection)


POSTGRES_SCHEMA = """
    CREATE TABLE IF NOT EXISTS categorias (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL UNIQUE,
        icono TEXT NOT NULL DEFAULT '🏷️',
        color TEXT NOT NULL DEFAULT '#333333',
        activa BOOLEAN NOT NULL DEFAULT TRUE
    );
    CREATE TABLE IF NOT EXISTS medios_pago (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL UNIQUE,
        tipo TEXT NOT NULL CHECK (tipo IN ('efectivo_billetes', 'efectivo_monedas', 'cuenta_bancaria', 'billetera_digital', 'tarjeta', 'otro')),
        icono TEXT NOT NULL DEFAULT '💵',
        color TEXT NOT NULL DEFAULT '#5de87a',
        saldo_inicial DOUBLE PRECISION NOT NULL DEFAULT 0.0 CHECK (saldo_inicial >= 0),
        activo BOOLEAN NOT NULL DEFAULT TRUE
    );
    CREATE TABLE IF NOT EXISTS transferencias_medios (
        id SERIAL PRIMARY KEY,
        fecha TEXT NOT NULL,
        origen_id INTEGER NOT NULL REFERENCES medios_pago(id),
        destino_id INTEGER NOT NULL REFERENCES medios_pago(id),
        monto DOUBLE PRECISION NOT NULL CHECK (monto > 0),
        nota TEXT NOT NULL DEFAULT '',
        CHECK (origen_id <> destino_id)
    );
    CREATE TABLE IF NOT EXISTS ingresos (
        id SERIAL PRIMARY KEY,
        fecha TEXT NOT NULL,
        fuente TEXT NOT NULL,
        monto DOUBLE PRECISION NOT NULL CHECK (monto >= 0),
        medio_pago_id INTEGER REFERENCES medios_pago(id),
        nota TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS gastos_fijos (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        monto DOUBLE PRECISION NOT NULL CHECK (monto >= 0),
        tipo TEXT NOT NULL CHECK (tipo IN ('mensual', 'por_kilometraje')),
        activo BOOLEAN NOT NULL DEFAULT TRUE
    );
    CREATE TABLE IF NOT EXISTS gastos_variables (
        id SERIAL PRIMARY KEY,
        fecha TEXT NOT NULL,
        categoria_id INTEGER NOT NULL REFERENCES categorias(id),
        monto DOUBLE PRECISION NOT NULL CHECK (monto >= 0),
        medio_pago_id INTEGER REFERENCES medios_pago(id),
        nota TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS kilometraje (
        id SERIAL PRIMARY KEY,
        fecha TEXT NOT NULL,
        km_actuales INTEGER NOT NULL CHECK (km_actuales >= 0),
        nota TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS moto_config (
        id SERIAL PRIMARY KEY,
        km_ultimo_cambio INTEGER NOT NULL DEFAULT 0 CHECK (km_ultimo_cambio >= 0),
        intervalo_km INTEGER NOT NULL DEFAULT 2000 CHECK (intervalo_km >= 1),
        alerta_km_antes INTEGER NOT NULL DEFAULT 200 CHECK (alerta_km_antes >= 0)
    );
    CREATE TABLE IF NOT EXISTS habitos (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL UNIQUE,
        icono TEXT NOT NULL DEFAULT '✅',
        color TEXT NOT NULL DEFAULT '#5de8c4',
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        creado_en TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
    );
    CREATE TABLE IF NOT EXISTS registro_habitos (
        id SERIAL PRIMARY KEY,
        habito_id INTEGER NOT NULL REFERENCES habitos(id) ON DELETE CASCADE,
        fecha TEXT NOT NULL,
        completado BOOLEAN NOT NULL DEFAULT TRUE,
        UNIQUE (habito_id, fecha)
    );
    CREATE TABLE IF NOT EXISTS bloques_rutina (
        id SERIAL PRIMARY KEY,
        dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
        hora_inicio TEXT NOT NULL,
        hora_fin TEXT NOT NULL,
        titulo TEXT NOT NULL,
        descripcion TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT '#5d8ae8',
        icono TEXT NOT NULL DEFAULT '⏰',
        activo BOOLEAN NOT NULL DEFAULT TRUE
    );
    CREATE TABLE IF NOT EXISTS fechas_especiales (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        fecha TEXT NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('cumpleanos', 'aniversario', 'evento', 'otro')),
        icono TEXT NOT NULL DEFAULT '🎂',
        color TEXT NOT NULL DEFAULT '#e85d8a',
        recordar_dias_antes INTEGER NOT NULL DEFAULT 1 CHECK (recordar_dias_antes >= 0),
        nota TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS recordatorios (
        id SERIAL PRIMARY KEY,
        titulo TEXT NOT NULL,
        descripcion TEXT NOT NULL DEFAULT '',
        tipo TEXT NOT NULL CHECK (tipo IN ('puntual', 'recurrente', 'fecha_especial', 'relacionado')),
        fecha_disparo TEXT NOT NULL,
        regla_recurrencia TEXT,
        anticipacion_minutos INTEGER NOT NULL DEFAULT 0 CHECK (anticipacion_minutos >= 0),
        canal TEXT NOT NULL DEFAULT 'todos' CHECK (canal IN ('push', 'in_app', 'todos')),
        modulo_origen TEXT,
        referencia_id INTEGER,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        disparado BOOLEAN NOT NULL DEFAULT FALSE
    );
"""

SQLITE_SCHEMA = """
    CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE,
        icono TEXT NOT NULL DEFAULT '🏷️',
        color TEXT NOT NULL DEFAULT '#333333',
        activa INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS medios_pago (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE,
        tipo TEXT NOT NULL CHECK (tipo IN ('efectivo_billetes', 'efectivo_monedas', 'cuenta_bancaria', 'billetera_digital', 'tarjeta', 'otro')),
        icono TEXT NOT NULL DEFAULT '💵',
        color TEXT NOT NULL DEFAULT '#5de87a',
        saldo_inicial REAL NOT NULL DEFAULT 0.0 CHECK (saldo_inicial >= 0),
        activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS transferencias_medios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        origen_id INTEGER NOT NULL REFERENCES medios_pago(id),
        destino_id INTEGER NOT NULL REFERENCES medios_pago(id),
        monto REAL NOT NULL CHECK (monto > 0),
        nota TEXT NOT NULL DEFAULT '',
        CHECK (origen_id <> destino_id)
    );
    CREATE TABLE IF NOT EXISTS ingresos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        fuente TEXT NOT NULL,
        monto REAL NOT NULL CHECK (monto >= 0),
        medio_pago_id INTEGER REFERENCES medios_pago(id),
        nota TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS gastos_fijos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        monto REAL NOT NULL CHECK (monto >= 0),
        tipo TEXT NOT NULL CHECK (tipo IN ('mensual', 'por_kilometraje')),
        activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS gastos_variables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        categoria_id INTEGER NOT NULL REFERENCES categorias(id),
        monto REAL NOT NULL CHECK (monto >= 0),
        medio_pago_id INTEGER REFERENCES medios_pago(id),
        nota TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS kilometraje (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        km_actuales INTEGER NOT NULL CHECK (km_actuales >= 0),
        nota TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS moto_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        km_ultimo_cambio INTEGER NOT NULL DEFAULT 0 CHECK (km_ultimo_cambio >= 0),
        intervalo_km INTEGER NOT NULL DEFAULT 2000 CHECK (intervalo_km >= 1),
        alerta_km_antes INTEGER NOT NULL DEFAULT 200 CHECK (alerta_km_antes >= 0)
    );
    CREATE TABLE IF NOT EXISTS habitos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE,
        icono TEXT NOT NULL DEFAULT '✅',
        color TEXT NOT NULL DEFAULT '#5de8c4',
        activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
        creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS registro_habitos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        habito_id INTEGER NOT NULL REFERENCES habitos(id) ON DELETE CASCADE,
        fecha TEXT NOT NULL,
        completado INTEGER NOT NULL DEFAULT 1 CHECK (completado IN (0, 1)),
        UNIQUE (habito_id, fecha)
    );
    CREATE TABLE IF NOT EXISTS bloques_rutina (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
        hora_inicio TEXT NOT NULL,
        hora_fin TEXT NOT NULL,
        titulo TEXT NOT NULL,
        descripcion TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT '#5d8ae8',
        icono TEXT NOT NULL DEFAULT '⏰',
        activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS fechas_especiales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        fecha TEXT NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('cumpleanos', 'aniversario', 'evento', 'otro')),
        icono TEXT NOT NULL DEFAULT '🎂',
        color TEXT NOT NULL DEFAULT '#e85d8a',
        recordar_dias_antes INTEGER NOT NULL DEFAULT 1 CHECK (recordar_dias_antes >= 0),
        nota TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS recordatorios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT NOT NULL,
        descripcion TEXT NOT NULL DEFAULT '',
        tipo TEXT NOT NULL CHECK (tipo IN ('puntual', 'recurrente', 'fecha_especial', 'relacionado')),
        fecha_disparo TEXT NOT NULL,
        regla_recurrencia TEXT,
        anticipacion_minutos INTEGER NOT NULL DEFAULT 0 CHECK (anticipacion_minutos >= 0),
        canal TEXT NOT NULL DEFAULT 'todos' CHECK (canal IN ('push', 'in_app', 'todos')),
        modulo_origen TEXT,
        referencia_id INTEGER,
        activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
        disparado INTEGER NOT NULL DEFAULT 0 CHECK (disparado IN (0, 1))
    );
"""


def init_db() -> None:
    with closing(get_connection()) as connection:
        connection.executescript(POSTGRES_SCHEMA if _is_postgres() else SQLITE_SCHEMA)
        categoria_count = connection.execute(
            "SELECT COUNT(*) FROM categorias"
        ).fetchone()[0]
        if categoria_count == 0:
            connection.executemany(
                """
                INSERT INTO categorias (nombre, icono, color, activa)
                VALUES (%s, %s, %s, TRUE)
                """,
                DEFAULT_CATEGORIAS,
            )
        medio_count = connection.execute(
            "SELECT COUNT(*) FROM medios_pago"
        ).fetchone()[0]
        if medio_count == 0:
            connection.executemany(
                """
                INSERT INTO medios_pago (nombre, tipo, icono, color, saldo_inicial, activo)
                VALUES (%s, %s, %s, %s, %s, TRUE)
                """,
                DEFAULT_MEDIOS_PAGO,
            )
        if _is_postgres():
            try:
                connection.execute("ALTER TABLE ingresos DROP CONSTRAINT IF EXISTS ingresos_fuente_check")
            except Exception:
                pass
        else:
            # Migraciones de columnas si no existen
            ing_cols = [row["name"] for row in connection.execute("PRAGMA table_info(ingresos)").fetchall()]
            if "medio_pago_id" not in ing_cols:
                try:
                    connection.execute("ALTER TABLE ingresos ADD COLUMN medio_pago_id INTEGER REFERENCES medios_pago(id)")
                except Exception:
                    pass
            gv_cols = [row["name"] for row in connection.execute("PRAGMA table_info(gastos_variables)").fetchall()]
            if "medio_pago_id" not in gv_cols:
                try:
                    connection.execute("ALTER TABLE gastos_variables ADD COLUMN medio_pago_id INTEGER REFERENCES medios_pago(id)")
                except Exception:
                    pass
        moto = connection.execute(
            "SELECT 1 FROM moto_config WHERE id = 1"
        ).fetchone()
        if moto is None:
            connection.execute(
                """
                INSERT INTO moto_config (id, km_ultimo_cambio, intervalo_km, alerta_km_antes)
                VALUES (1, %s, %s, %s)
                """,
                (0, 2000, 200),
            )
        connection.commit()


def _norm_bool(value: Any) -> Any:
    if _is_postgres():
        return bool(value)
    return int(value)


def row_to_dict(row: Any) -> dict[str, Any]:
    if isinstance(row, _Row):
        return dict(row._mapping)
    return dict(row)


def require_row(connection: Any, table: str, item_id: int) -> Any:
    allowed_tables = {
        "ingresos",
        "gastos_fijos",
        "gastos_variables",
        "kilometraje",
        "categorias",
        "habitos",
        "registro_habitos",
        "bloques_rutina",
        "medios_pago",
        "transferencias_medios",
        "fechas_especiales",
        "recordatorios",
    }
    if table not in allowed_tables:
        raise ValueError("Tabla no permitida")
    row = connection.execute(
        f"SELECT * FROM {table} WHERE id = %s",  # table is selected from a fixed allowlist
        (item_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Recurso no encontrado")
    return row


def require_categoria(connection: Any, categoria_id: int) -> None:
    exists = connection.execute(
        "SELECT 1 FROM categorias WHERE id = %s", (categoria_id,)
    ).fetchone()
    if exists is None:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")


def create_item(table: str, fields: dict[str, Any]) -> dict[str, Any]:
    columns = list(fields)
    values = [fields[column] for column in columns]
    placeholders = ", ".join("%s" for _ in columns)
    with closing(get_connection()) as connection:
        cursor = connection.execute(
            f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders})"
            + (" RETURNING id" if _is_postgres() else ""),
            values,
        )
        if _is_postgres():
            row = cursor.fetchone()
            new_id = int(row[0])
        else:
            new_id = cursor.lastrowid
        connection.commit()
        return row_to_dict(require_row(connection, table, new_id))


def update_item(table: str, item_id: int, fields: dict[str, Any]) -> dict[str, Any]:
    if not fields:
        with closing(get_connection()) as connection:
            return row_to_dict(require_row(connection, table, item_id))
    columns = list(fields)
    assignments = ", ".join(f"{column} = %s" for column in columns)
    values = [fields[column] for column in columns]
    with closing(get_connection()) as connection:
        require_row(connection, table, item_id)
        connection.execute(
            f"UPDATE {table} SET {assignments} WHERE id = %s",
            [*values, item_id],
        )
        connection.commit()
        return row_to_dict(require_row(connection, table, item_id))


def delete_item(table: str, item_id: int) -> None:
    with closing(get_connection()) as connection:
        require_row(connection, table, item_id)
        connection.execute(f"DELETE FROM {table} WHERE id = %s", (item_id,))
        connection.commit()


def get_moto_config(connection: Any) -> Any:
    row = connection.execute("SELECT * FROM moto_config WHERE id = 1").fetchone()
    if row is None:
        connection.execute(
            "INSERT INTO moto_config (id, km_ultimo_cambio, intervalo_km, alerta_km_antes)"
            " VALUES (1, 0, 2000, 200)"
        )
        connection.commit()
        row = connection.execute("SELECT * FROM moto_config WHERE id = 1").fetchone()
    return row


def build_estado_aceite() -> dict[str, Any]:
    with closing(get_connection()) as connection:
        config = get_moto_config(connection)
        km_row = connection.execute(
            "SELECT km_actuales FROM kilometraje ORDER BY fecha DESC, id DESC LIMIT 1"
        ).fetchone()
        km_actuales = int(km_row["km_actuales"]) if km_row else 0
        km_ultimo_cambio = int(config["km_ultimo_cambio"])
        intervalo_km = int(config["intervalo_km"])
        alerta_km_antes = int(config["alerta_km_antes"])
        km_proximo_cambio = km_ultimo_cambio + intervalo_km
        km_restantes = km_proximo_cambio - km_actuales
        alerta = km_restantes <= alerta_km_antes
        if intervalo_km:
            vida = max(0.0, min(100.0, (km_restantes / intervalo_km) * 100))
            porcentaje_vida_aceite = round(vida, 1)
        else:
            porcentaje_vida_aceite = 0.0
    return {
        "km_actuales": km_actuales,
        "km_ultimo_cambio": km_ultimo_cambio,
        "km_proximo_cambio": km_proximo_cambio,
        "km_restantes": km_restantes,
        "alerta": alerta,
        "porcentaje_vida_aceite": porcentaje_vida_aceite,
        "intervalo_km": intervalo_km,
        "alerta_km_antes": alerta_km_antes,
    }


def ensure_km_no_regression(connection: Any, km: int) -> None:
    last = connection.execute(
        "SELECT km_actuales FROM kilometraje ORDER BY fecha DESC, id DESC LIMIT 1"
    ).fetchone()
    if last is not None and km < int(last["km_actuales"]):
        raise HTTPException(
            status_code=400,
            detail=(
                "El odómetro no puede retroceder: el último registro fue "
                f"{int(last['km_actuales'])} km"
            ),
        )


def previous_kilometraje(
    connection: Any, item_id: int, fecha: str
) -> Any:
    return connection.execute(
        """
        SELECT km_actuales FROM kilometraje
        WHERE fecha < %s OR (fecha = %s AND id < %s)
        ORDER BY fecha DESC, id DESC
        LIMIT 1
        """,
        (fecha, fecha, item_id),
    ).fetchone()


def next_kilometraje(
    connection: Any, item_id: int, fecha: str
) -> Any:
    return connection.execute(
        """
        SELECT km_actuales FROM kilometraje
        WHERE fecha > %s OR (fecha = %s AND id > %s)
        ORDER BY fecha ASC, id ASC
        LIMIT 1
        """,
        (fecha, fecha, item_id),
    ).fetchone()


def calcular_racha(
    connection: Any, habito_id: int, dia: date | None = None
) -> int:
    if dia is None:
        dia = date.today()
    racha = 0
    while True:
        hecho = connection.execute(
            """
            SELECT 1 FROM registro_habitos
            WHERE habito_id = %s AND fecha = %s AND completado = TRUE
            """,
            (habito_id, dia.isoformat()),
        ).fetchone()
        if hecho is None:
            break
        racha += 1
        dia -= timedelta(days=1)
    return racha


app = FastAPI(
    title="Jarvis API",
    description="API de gestiÃ³n financiera personal de Jarvis.",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/api/healthz")
@app.get("/api/health")
def healthz() -> dict[str, Any]:
    engine = "postgresql" if _is_postgres() else "sqlite"
    return {
        "status": "ok",
        "engine": engine,
        "is_postgres": _is_postgres(),
        "has_database_url": bool(os.environ.get("DATABASE_URL")),
    }


@app.get("/api/ingresos", response_model=list[Ingreso])
def list_ingresos() -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        rows = connection.execute("SELECT * FROM ingresos ORDER BY fecha DESC, id DESC").fetchall()
        return [row_to_dict(row) for row in rows]


@app.post("/api/ingresos", response_model=Ingreso, status_code=201)
def create_ingreso(payload: IngresoInput) -> dict[str, Any]:
    return create_item("ingresos", {**payload.model_dump(), "fecha": payload.fecha.isoformat()})


@app.get("/api/ingresos/{item_id}", response_model=Ingreso)
def get_ingreso(item_id: int) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        return row_to_dict(require_row(connection, "ingresos", item_id))


@app.patch("/api/ingresos/{item_id}", response_model=Ingreso)
def update_ingreso(item_id: int, payload: IngresoUpdate) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    if "fecha" in fields and fields["fecha"] is not None:
        fields["fecha"] = fields["fecha"].isoformat()
    return update_item("ingresos", item_id, fields)


@app.delete("/api/ingresos/{item_id}", status_code=204)
def delete_ingreso(item_id: int) -> Response:
    delete_item("ingresos", item_id)
    return Response(status_code=204)


@app.get("/api/gastos-fijos", response_model=list[GastoFijo])
def list_gastos_fijos() -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        rows = connection.execute("SELECT * FROM gastos_fijos ORDER BY activo DESC, id").fetchall()
        return [{**row_to_dict(row), "activo": bool(row["activo"])} for row in rows]


@app.post("/api/gastos-fijos", response_model=GastoFijo, status_code=201)
def create_gasto_fijo(payload: GastoFijoInput) -> dict[str, Any]:
    result = create_item("gastos_fijos", {**payload.model_dump(), "activo": _norm_bool(payload.activo)})
    result["activo"] = bool(result["activo"])
    return result


@app.get("/api/gastos-fijos/{item_id}", response_model=GastoFijo)
def get_gasto_fijo(item_id: int) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        row = require_row(connection, "gastos_fijos", item_id)
        return {**row_to_dict(row), "activo": bool(row["activo"])}


@app.patch("/api/gastos-fijos/{item_id}", response_model=GastoFijo)
def update_gasto_fijo(item_id: int, payload: GastoFijoUpdate) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    if "activo" in fields and fields["activo"] is not None:
        fields["activo"] = _norm_bool(fields["activo"])
    result = update_item("gastos_fijos", item_id, fields)
    result["activo"] = bool(result["activo"])
    return result


@app.delete("/api/gastos-fijos/{item_id}", status_code=204)
def delete_gasto_fijo(item_id: int) -> Response:
    delete_item("gastos_fijos", item_id)
    return Response(status_code=204)


@app.get("/api/categorias", response_model=list[Categoria])
def list_categorias() -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        rows = connection.execute(
            "SELECT * FROM categorias ORDER BY activa DESC, id"
        ).fetchall()
        return [{**row_to_dict(row), "activa": bool(row["activa"])} for row in rows]


@app.post("/api/categorias", response_model=Categoria, status_code=201)
def create_categoria(payload: CategoriaInput) -> dict[str, Any]:
    try:
        result = create_item(
            "categorias", {**payload.model_dump(), "activa": _norm_bool(payload.activa)}
        )
    except _INTEGRITY_ERRORS:
        raise HTTPException(status_code=400, detail="Ya existe una categorÃ­a con ese nombre")
    result["activa"] = bool(result["activa"])
    return result


@app.get("/api/categorias/{item_id}", response_model=Categoria)
def get_categoria(item_id: int) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        row = require_row(connection, "categorias", item_id)
        return {**row_to_dict(row), "activa": bool(row["activa"])}


@app.patch("/api/categorias/{item_id}", response_model=Categoria)
def update_categoria(item_id: int, payload: CategoriaUpdate) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    if "activa" in fields and fields["activa"] is not None:
        fields["activa"] = _norm_bool(fields["activa"])
    try:
        result = update_item("categorias", item_id, fields)
    except _INTEGRITY_ERRORS:
        raise HTTPException(status_code=400, detail="Ya existe una categorÃ­a con ese nombre")
    result["activa"] = bool(result["activa"])
    return result


@app.delete("/api/categorias/{item_id}", status_code=204)
def delete_categoria(item_id: int) -> Response:
    try:
        delete_item("categorias", item_id)
    except _INTEGRITY_ERRORS:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar la categorÃ­a: tiene gastos asociados",
        )
    return Response(status_code=204)


@app.get("/api/gastos-variables", response_model=list[GastoVariable])
def list_gastos_variables() -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        rows = connection.execute(
            "SELECT * FROM gastos_variables ORDER BY fecha DESC, id DESC"
        ).fetchall()
        return [row_to_dict(row) for row in rows]


@app.post("/api/gastos-variables", response_model=GastoVariable, status_code=201)
def create_gasto_variable(payload: GastoVariableInput) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        require_categoria(connection, payload.categoria_id)
    return create_item(
        "gastos_variables",
        {**payload.model_dump(), "fecha": payload.fecha.isoformat()},
    )


@app.get("/api/gastos-variables/{item_id}", response_model=GastoVariable)
def get_gasto_variable(item_id: int) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        return row_to_dict(require_row(connection, "gastos_variables", item_id))


@app.patch("/api/gastos-variables/{item_id}", response_model=GastoVariable)
def update_gasto_variable(item_id: int, payload: GastoVariableUpdate) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    if "fecha" in fields and fields["fecha"] is not None:
        fields["fecha"] = fields["fecha"].isoformat()
    if "categoria_id" in fields and fields["categoria_id"] is not None:
        with closing(get_connection()) as connection:
            require_categoria(connection, fields["categoria_id"])
    return update_item("gastos_variables", item_id, fields)


@app.delete("/api/gastos-variables/{item_id}", status_code=204)
def delete_gasto_variable(item_id: int) -> Response:
    delete_item("gastos_variables", item_id)
    return Response(status_code=204)


@app.get("/api/kilometraje", response_model=list[Kilometraje])
def list_kilometrajes() -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        rows = connection.execute(
            "SELECT * FROM kilometraje ORDER BY fecha DESC, id DESC"
        ).fetchall()
        return [row_to_dict(row) for row in rows]


@app.post("/api/kilometraje", response_model=Kilometraje, status_code=201)
def create_kilometraje(payload: KilometrajeInput) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        ensure_km_no_regression(connection, payload.km_actuales)
    return create_item(
        "kilometraje",
        {**payload.model_dump(), "fecha": payload.fecha.isoformat()},
    )


@app.get("/api/kilometraje/resumen", response_model=KilometrajeResumen)
def resumen_kilometraje() -> dict[str, Any]:
    with closing(get_connection()) as connection:
        last = connection.execute(
            "SELECT km_actuales FROM kilometraje ORDER BY fecha DESC, id DESC LIMIT 1"
        ).fetchone()
        registros = connection.execute("SELECT COUNT(*) FROM kilometraje").fetchone()[0]
    return {
        "km_actuales": int(last["km_actuales"]) if last else 0,
        "registros": registros,
    }


@app.get("/api/kilometraje/{item_id}", response_model=Kilometraje)
def get_kilometraje(item_id: int) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        return row_to_dict(require_row(connection, "kilometraje", item_id))


@app.patch("/api/kilometraje/{item_id}", response_model=Kilometraje)
def update_kilometraje(item_id: int, payload: KilometrajeUpdate) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    if "km_actuales" in fields and fields["km_actuales"] is not None:
        with closing(get_connection()) as connection:
            current = require_row(connection, "kilometraje", item_id)
            fecha = str(fields.get("fecha", current["fecha"]))
            new_km = int(fields["km_actuales"])
            prev = previous_kilometraje(connection, item_id, fecha)
            if prev is not None and new_km < int(prev["km_actuales"]):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "El odÃ³metro no puede retroceder: el registro anterior fue "
                        f"{int(prev['km_actuales'])} km"
                    ),
                )
            nxt = next_kilometraje(connection, item_id, fecha)
            if nxt is not None and new_km > int(nxt["km_actuales"]):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Este valor supera al siguiente registro "
                        f"({int(nxt['km_actuales'])} km)"
                    ),
                )
    if "fecha" in fields and fields["fecha"] is not None:
        fields["fecha"] = fields["fecha"].isoformat()
    return update_item("kilometraje", item_id, fields)


@app.delete("/api/kilometraje/{item_id}", status_code=204)
def delete_kilometraje(item_id: int) -> Response:
    delete_item("kilometraje", item_id)
    return Response(status_code=204)


@app.get("/api/moto/estado-aceite", response_model=EstadoAceite)
def moto_estado_aceite() -> dict[str, Any]:
    return build_estado_aceite()


@app.post("/api/moto/cambio-aceite", response_model=EstadoAceite)
def moto_cambio_aceite(payload: CambioAceiteInput | None = None) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        km_row = connection.execute(
            "SELECT km_actuales FROM kilometraje ORDER BY fecha DESC, id DESC LIMIT 1"
        ).fetchone()
        km_actuales = int(km_row["km_actuales"]) if km_row else 0
        connection.execute(
            "UPDATE moto_config SET km_ultimo_cambio = %s WHERE id = 1",
            (km_actuales,),
        )
        if payload and payload.crear_gasto and payload.costo and payload.costo > 0:
            # Buscar categoría 'Transporte' o la primera disponible
            cat_row = connection.execute(
                "SELECT id FROM categorias WHERE lower(nombre) IN ('transporte', 'moto', 'gasolina') LIMIT 1"
            ).fetchone()
            cat_id = cat_row["id"] if cat_row else 1
            today_str = date.today().isoformat()
            nota_gasto = payload.nota or f"Cambio de aceite ({km_actuales} km)"
            if payload.medio_pago_id:
                connection.execute(
                    """
                    INSERT INTO gastos_variables (fecha, categoria_id, monto, medio_pago_id, nota)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (today_str, cat_id, payload.costo, payload.medio_pago_id, nota_gasto),
                )
            else:
                connection.execute(
                    """
                    INSERT INTO gastos_variables (fecha, categoria_id, monto, nota)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (today_str, cat_id, payload.costo, nota_gasto),
                )
        connection.commit()
    return build_estado_aceite()


@app.put("/api/moto/config", response_model=EstadoAceite)
def moto_update_config(payload: MotoConfigUpdate) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        return build_estado_aceite()
    sets = ", ".join(f"{column} = %s" for column in fields)
    values = [fields[column] for column in fields]
    with closing(get_connection()) as connection:
        get_moto_config(connection)
        connection.execute(f"UPDATE moto_config SET {sets} WHERE id = 1", values)
        connection.commit()
    return build_estado_aceite()


@app.get("/api/habitos", response_model=list[Habito])
def list_habitos() -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        rows = connection.execute(
            "SELECT * FROM habitos ORDER BY activo DESC, id"
        ).fetchall()
        return [
            {**row_to_dict(row), "activo": bool(row["activo"])} for row in rows
        ]


@app.post("/api/habitos", response_model=Habito, status_code=201)
def create_habito(payload: HabitoInput) -> dict[str, Any]:
    try:
        result = create_item("habitos", payload.model_dump())
    except _INTEGRITY_ERRORS:
        raise HTTPException(status_code=400, detail="Ya existe un hábito con ese nombre")
    result["activo"] = bool(result["activo"])
    return result


@app.get("/api/habitos/resumen/{fecha}", response_model=list[HabitoResumenItem])
def resumen_habitos(fecha: date) -> list[dict[str, Any]]:
    fecha_iso = fecha.isoformat()
    with closing(get_connection()) as connection:
        estado_rows = {
            row["habito_id"]: bool(row["completado"])
            for row in connection.execute(
                "SELECT habito_id, completado FROM registro_habitos WHERE fecha = %s",
                (fecha_iso,),
            ).fetchall()
        }
        habits = connection.execute(
            "SELECT * FROM habitos WHERE activo = TRUE ORDER BY id"
        ).fetchall()
        return [
            {
                "id": row["id"],
                "nombre": row["nombre"],
                "icono": row["icono"],
                "color": row["color"],
                "racha": calcular_racha(connection, row["id"], fecha),
                "completado": bool(estado_rows.get(row["id"], False)),
            }
            for row in habits
        ]


@app.get("/api/habitos/{item_id}/racha", response_model=Racha)
def racha_habito(item_id: int) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        require_row(connection, "habitos", item_id)
        racha = calcular_racha(connection, item_id)
    return {"id": item_id, "racha": racha}


@app.get("/api/habitos/{item_id}", response_model=Habito)
def get_habito(item_id: int) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        row = require_row(connection, "habitos", item_id)
        return {**row_to_dict(row), "activo": bool(row["activo"])}


@app.patch("/api/habitos/{item_id}", response_model=Habito)
def update_habito(item_id: int, payload: HabitoUpdate) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        with closing(get_connection()) as connection:
            row = require_row(connection, "habitos", item_id)
        return {**row_to_dict(row), "activo": bool(row["activo"])}
    try:
        result = update_item("habitos", item_id, fields)
    except _INTEGRITY_ERRORS:
        raise HTTPException(status_code=400, detail="Ya existe un hábito con ese nombre")
    result["activo"] = bool(result["activo"])
    return result


@app.delete("/api/habitos/{item_id}", status_code=204)
def delete_habito(item_id: int) -> Response:
    delete_item("habitos", item_id)
    return Response(status_code=204)


@app.post("/api/habitos/{item_id}/check/{fecha}", response_model=CheckHabitoResult)
def toggle_habito(item_id: int, fecha: date) -> dict[str, Any]:
    fecha_iso = fecha.isoformat()
    with closing(get_connection()) as connection:
        require_row(connection, "habitos", item_id)
        existing = connection.execute(
            "SELECT id FROM registro_habitos WHERE habito_id = %s AND fecha = %s",
            (item_id, fecha_iso),
        ).fetchone()
        if existing is not None:
            connection.execute("DELETE FROM registro_habitos WHERE id = %s", (existing["id"],))
            completado = False
        else:
            connection.execute(
                "INSERT INTO registro_habitos (habito_id, fecha, completado) VALUES (%s, %s, TRUE)",
                (item_id, fecha_iso),
            )
            completado = True
        connection.commit()
    return {"habito_id": item_id, "fecha": fecha_iso, "completado": completado}


def bloque_dict(row: Any) -> dict[str, Any]:
    return {**row_to_dict(row), "activo": bool(row["activo"])}


def validar_horas(inicio: str, fin: str) -> None:
    t1 = datetime.strptime(inicio, "%H:%M").time()
    t2 = datetime.strptime(fin, "%H:%M").time()
    if t2 <= t1:
        raise HTTPException(
            status_code=400, detail="hora_fin debe ser posterior a hora_inicio"
        )


@app.get("/api/rutina/bloques", response_model=list[BloqueRutina])
def list_bloques_rutina() -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        rows = connection.execute(
            "SELECT * FROM bloques_rutina ORDER BY dia_semana, hora_inicio, id"
        ).fetchall()
        return [bloque_dict(row) for row in rows]


@app.post("/api/rutina/bloques", response_model=BloqueRutina, status_code=201)
def create_bloque_rutina(payload: BloqueRutinaInput) -> dict[str, Any]:
    validar_horas(payload.hora_inicio, payload.hora_fin)
    result = create_item("bloques_rutina", payload.model_dump())
    result["activo"] = bool(result["activo"])
    return result


@app.get("/api/rutina/semana", response_model=list[DiaRutina])
def rutina_semana() -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        rows = connection.execute(
            "SELECT * FROM bloques_rutina WHERE activo = TRUE"
            " ORDER BY dia_semana, hora_inicio, id"
        ).fetchall()
    dias: dict[int, list[dict[str, Any]]] = {i: [] for i in range(7)}
    for row in rows:
        dias[row["dia_semana"]].append(bloque_dict(row))
    return [{"dia_semana": i, "bloques": dias[i]} for i in range(7)]


@app.get("/api/rutina/dia/{dia_semana}", response_model=list[BloqueRutina])
def bloques_dia(dia_semana: int) -> list[dict[str, Any]]:
    if not 0 <= dia_semana <= 6:
        raise HTTPException(
            status_code=400,
            detail="dia_semana debe estar entre 0 (lunes) y 6 (domingo)",
        )
    with closing(get_connection()) as connection:
        rows = connection.execute(
            "SELECT * FROM bloques_rutina"
            " WHERE dia_semana = %s AND activo = TRUE ORDER BY hora_inicio, id",
            (dia_semana,),
        ).fetchall()
        return [bloque_dict(row) for row in rows]


@app.get("/api/rutina/bloques/{item_id}", response_model=BloqueRutina)
def get_bloque_rutina(item_id: int) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        row = require_row(connection, "bloques_rutina", item_id)
        return {**row_to_dict(row), "activo": bool(row["activo"])}


@app.patch("/api/rutina/bloques/{item_id}", response_model=BloqueRutina)
def update_bloque_rutina(item_id: int, payload: BloqueRutinaUpdate) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    if "hora_inicio" in fields or "hora_fin" in fields:
        with closing(get_connection()) as connection:
            row = require_row(connection, "bloques_rutina", item_id)
        inicio = fields.get("hora_inicio", row["hora_inicio"])
        fin = fields.get("hora_fin", row["hora_fin"])
        validar_horas(inicio, fin)
    if not fields:
        with closing(get_connection()) as connection:
            row = require_row(connection, "bloques_rutina", item_id)
        return {**row_to_dict(row), "activo": bool(row["activo"])}
    result = update_item("bloques_rutina", item_id, fields)
    result["activo"] = bool(result["activo"])
    return result


@app.delete("/api/rutina/bloques/{item_id}", status_code=204)
def delete_bloque_rutina(item_id: int) -> Response:
    delete_item("bloques_rutina", item_id)
    return Response(status_code=204)


@app.get("/api/medios-pago", response_model=list[MedioPagoSaldo])
def list_medios_pago() -> list[dict[str, Any]]:
    return build_saldos_medios()


@app.post("/api/medios-pago", response_model=MedioPago, status_code=201)
def create_medio_pago(payload: MedioPagoInput) -> dict[str, Any]:
    try:
        result = create_item(
            "medios_pago",
            {**payload.model_dump(), "activo": _norm_bool(payload.activo)},
        )
    except _INTEGRITY_ERRORS:
        raise HTTPException(status_code=400, detail="Ya existe un medio de pago con ese nombre")
    result["activo"] = bool(result["activo"])
    return result


@app.get("/api/medios-pago/{item_id}", response_model=MedioPago)
def get_medio_pago(item_id: int) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        row = require_row(connection, "medios_pago", item_id)
        return {**row_to_dict(row), "activo": bool(row["activo"])}


@app.patch("/api/medios-pago/{item_id}", response_model=MedioPago)
def update_medio_pago(item_id: int, payload: MedioPagoUpdate) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    if "activo" in fields and fields["activo"] is not None:
        fields["activo"] = _norm_bool(fields["activo"])
    try:
        result = update_item("medios_pago", item_id, fields)
    except _INTEGRITY_ERRORS:
        raise HTTPException(status_code=400, detail="Ya existe un medio de pago con ese nombre")
    result["activo"] = bool(result["activo"])
    return result


@app.delete("/api/medios-pago/{item_id}", status_code=204)
def delete_medio_pago(item_id: int) -> Response:
    try:
        delete_item("medios_pago", item_id)
    except _INTEGRITY_ERRORS:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar el medio de pago: tiene movimientos o transferencias asociadas",
        )
    return Response(status_code=204)


@app.get("/api/transferencias", response_model=list[TransferenciaMedio])
def list_transferencias() -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        rows = connection.execute(
            "SELECT * FROM transferencias_medios ORDER BY fecha DESC, id DESC"
        ).fetchall()
        return [row_to_dict(row) for row in rows]


@app.post("/api/transferencias", response_model=TransferenciaMedio, status_code=201)
def create_transferencia(payload: TransferenciaMedioInput) -> dict[str, Any]:
    if payload.origen_id == payload.destino_id:
        raise HTTPException(status_code=400, detail="El medio de origen y destino deben ser diferentes")
    with closing(get_connection()) as connection:
        require_row(connection, "medios_pago", payload.origen_id)
        require_row(connection, "medios_pago", payload.destino_id)
    return create_item(
        "transferencias_medios",
        {**payload.model_dump(), "fecha": payload.fecha.isoformat()},
    )


@app.delete("/api/transferencias/{item_id}", status_code=204)
def delete_transferencia(item_id: int) -> Response:
    delete_item("transferencias_medios", item_id)
    return Response(status_code=204)


def build_saldos_medios() -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        medios = connection.execute(
            "SELECT * FROM medios_pago ORDER BY activo DESC, id"
        ).fetchall()
        
        # Totales por medio
        ingresos_rows = connection.execute(
            "SELECT medio_pago_id, SUM(monto) as total FROM ingresos WHERE medio_pago_id IS NOT NULL GROUP BY medio_pago_id"
        ).fetchall()
        ing_map = {row["medio_pago_id"]: float(row["total"] or 0) for row in ingresos_rows}

        gastos_rows = connection.execute(
            "SELECT medio_pago_id, SUM(monto) as total FROM gastos_variables WHERE medio_pago_id IS NOT NULL GROUP BY medio_pago_id"
        ).fetchall()
        gastos_map = {row["medio_pago_id"]: float(row["total"] or 0) for row in gastos_rows}

        trans_in = connection.execute(
            "SELECT destino_id, SUM(monto) as total FROM transferencias_medios GROUP BY destino_id"
        ).fetchall()
        in_map = {row["destino_id"]: float(row["total"] or 0) for row in trans_in}

        trans_out = connection.execute(
            "SELECT origen_id, SUM(monto) as total FROM transferencias_medios GROUP BY origen_id"
        ).fetchall()
        out_map = {row["origen_id"]: float(row["total"] or 0) for row in trans_out}

        result = []
        for m in medios:
            m_id = m["id"]
            ini = float(m["saldo_inicial"] or 0)
            tot_ing = ing_map.get(m_id, 0.0)
            tot_gas = gastos_map.get(m_id, 0.0)
            t_in = in_map.get(m_id, 0.0)
            t_out = out_map.get(m_id, 0.0)
            saldo_act = ini + tot_ing - tot_gas + t_in - t_out
            result.append(
                {
                    **row_to_dict(m),
                    "activo": bool(m["activo"]),
                    "saldo_inicial": ini,
                    "saldo_actual": saldo_act,
                    "total_ingresos": tot_ing,
                    "total_gastos": tot_gas,
                    "total_transferencias_recibidas": t_in,
                    "total_transferencias_enviadas": t_out,
                }
            )
        return result


@app.get("/api/resumen/mes-actual", response_model=ResumenMensual)
def resumen_mes_actual() -> dict[str, Any]:
    current_month = datetime.now().strftime("%Y-%m")
    with closing(get_connection()) as connection:
        ingresos = connection.execute(
            "SELECT COALESCE(SUM(monto), 0) FROM ingresos WHERE substr(fecha, 1, 7) = %s",
            (current_month,),
        ).fetchone()[0]
        variables = connection.execute(
            """
            SELECT COALESCE(SUM(monto), 0)
            FROM gastos_variables
            WHERE substr(fecha, 1, 7) = %s
            """,
            (current_month,),
        ).fetchone()[0]
        fijos = connection.execute(
            """
            SELECT COALESCE(SUM(monto), 0)
            FROM gastos_fijos
            WHERE activo = TRUE AND tipo = 'mensual'
            """
        ).fetchone()[0]
    
    saldos_medios = build_saldos_medios()
    saldo_total_medios = sum(m["saldo_actual"] for m in saldos_medios if m["activo"])

    return {
        "mes": current_month,
        "total_ingresos": float(ingresos),
        "total_gastos_fijos": float(fijos),
        "total_gastos_variables": float(variables),
        "saldo": float(ingresos - fijos - variables),
        "saldo_total_medios": float(saldo_total_medios),
        "saldos_medios": saldos_medios,
    }


@app.get(
    "/api/resumen/mes-actual/por-categoria",
    response_model=list[ResumenCategoria],
)
def resumen_mes_actual_por_categoria() -> list[dict[str, Any]]:
    current_month = datetime.now().strftime("%Y-%m")
    with closing(get_connection()) as connection:
        rows = connection.execute(
            """
            SELECT c.id,
                   c.nombre,
                   c.icono,
                   c.color,
                   COUNT(gv.id) AS cantidad,
                   SUM(gv.monto) AS total
            FROM gastos_variables gv
            JOIN categorias c ON c.id = gv.categoria_id
            WHERE substr(gv.fecha, 1, 7) = %s
            GROUP BY c.id, c.nombre, c.icono, c.color
            ORDER BY total DESC
            """,
            (current_month,),
        ).fetchall()
    grand_total = sum((row["total"] or 0) for row in rows)
    result = []
    for row in rows:
        total = float(row["total"] or 0)
        result.append(
            {
                "id": row["id"],
                "nombre": row["nombre"],
                "icono": row["icono"],
                "color": row["color"],
                "cantidad": row["cantidad"],
                "total": total,
                "porcentaje": round((total / grand_total * 100) if grand_total else 0, 1),
            }
        )
    return result


def _calcular_fechas_especiales(rows: list[Any]) -> list[dict[str, Any]]:
    today = date.today()
    result = []
    for r in rows:
        d = row_to_dict(r)
        fecha_str = d["fecha"]
        try:
            f_orig = datetime.strptime(fecha_str, "%Y-%m-%d").date()
            # Próximo cumpleaños / aniversario este año o el siguiente
            f_next = date(today.year, f_orig.month, f_orig.day)
            if f_next < today:
                f_next = date(today.year + 1, f_orig.month, f_orig.day)
            dias_restantes = (f_next - today).days
            edad = f_next.year - f_orig.year if f_orig.year < today.year else None
        except Exception:
            dias_restantes = 0
            edad = None

        result.append({
            **d,
            "dias_restantes": dias_restantes,
            "edad_o_aniversario": edad,
        })
    # Ordenar por proximidad
    result.sort(key=lambda x: x["dias_restantes"])
    return result


@app.get("/api/fechas-especiales", response_model=list[FechaEspecial])
def list_fechas_especiales() -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        rows = connection.execute("SELECT * FROM fechas_especiales ORDER BY id ASC").fetchall()
        return _calcular_fechas_especiales(rows)


@app.post("/api/fechas-especiales", response_model=FechaEspecial, status_code=201)
def create_fecha_especial(payload: FechaEspecialInput) -> dict[str, Any]:
    created = create_item("fechas_especiales", payload.model_dump())
    with closing(get_connection()) as connection:
        rows = [require_row(connection, "fechas_especiales", created["id"])]
        return _calcular_fechas_especiales(rows)[0]


@app.get("/api/fechas-especiales/{item_id}", response_model=FechaEspecial)
def get_fecha_especial(item_id: int) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        row = require_row(connection, "fechas_especiales", item_id)
        return _calcular_fechas_especiales([row])[0]


@app.patch("/api/fechas-especiales/{item_id}", response_model=FechaEspecial)
def update_fecha_especial(item_id: int, payload: FechaEspecialUpdate) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    update_item("fechas_especiales", item_id, fields)
    with closing(get_connection()) as connection:
        row = require_row(connection, "fechas_especiales", item_id)
        return _calcular_fechas_especiales([row])[0]


@app.delete("/api/fechas-especiales/{item_id}", status_code=204)
def delete_fecha_especial(item_id: int) -> Response:
    delete_item("fechas_especiales", item_id)
    return Response(status_code=204)


@app.get("/api/recordatorios", response_model=list[Recordatorio])
def list_recordatorios() -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        rows = connection.execute("SELECT * FROM recordatorios ORDER BY activo DESC, fecha_disparo ASC, id ASC").fetchall()
        return [{**row_to_dict(r), "activo": bool(r["activo"]), "disparado": bool(r["disparado"])} for r in rows]


@app.post("/api/recordatorios", response_model=Recordatorio, status_code=201)
def create_recordatorio(payload: RecordatorioInput) -> dict[str, Any]:
    created = create_item("recordatorios", {**payload.model_dump(), "activo": _norm_bool(payload.activo), "disparado": _norm_bool(False)})
    return {**created, "activo": bool(created["activo"]), "disparado": bool(created["disparado"])}


@app.get("/api/recordatorios/{item_id}", response_model=Recordatorio)
def get_recordatorio(item_id: int) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        row = require_row(connection, "recordatorios", item_id)
        return {**row_to_dict(row), "activo": bool(row["activo"]), "disparado": bool(row["disparado"])}


@app.patch("/api/recordatorios/{item_id}", response_model=Recordatorio)
def update_recordatorio(item_id: int, payload: RecordatorioUpdate) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    if "activo" in fields and fields["activo"] is not None:
        fields["activo"] = _norm_bool(fields["activo"])
    updated = update_item("recordatorios", item_id, fields)
    return {**updated, "activo": bool(updated["activo"]), "disparado": bool(updated["disparado"])}


@app.delete("/api/recordatorios/{item_id}", status_code=204)
def delete_recordatorio(item_id: int) -> Response:
    delete_item("recordatorios", item_id)
    return Response(status_code=204)

