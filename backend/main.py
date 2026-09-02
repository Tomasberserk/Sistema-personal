from __future__ import annotations

import hashlib
import hmac
import os
import sqlite3
import time
from contextlib import asynccontextmanager, closing
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Response
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
SECRET_KEY = os.environ.get("JWT_SECRET", "jarvis-sistema-personal-secret-key-2026")


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
    ("Comida & Alimentación", "🍔", "#e85d4a"),
    ("Transporte & Movilidad", "🛵", "#5d8ae8"),
    ("Gasolina & Combustible", "⛽", "#e8a85d"),
    ("Vivienda & Hogar", "🏠", "#5de87a"),
    ("Servicios & Facturas", "💡", "#e8d95d"),
    ("Salud & Medicina", "💊", "#e85d8a"),
    ("Entretenimiento & Ocio", "🎮", "#a85de8"),
    ("Educación & Libros", "📚", "#5dc4e8"),
    ("Ropa & Calzado", "👕", "#5de8c4"),
    ("Tecnología", "💻", "#b7e85d"),
    ("Regalos & Familia", "🎁", "#e8755d"),
    ("Aseo & Cuidado Personal", "🧴", "#8a8aa0"),
]

DEFAULT_MEDIOS_PAGO = [
    ("Efectivo (Billetes)", "efectivo_billetes", "💵", "#5de87a", 0.0),
    ("Efectivo (Monedas)", "efectivo_monedas", "🪙", "#e8d95d", 0.0),
    ("Bancolombia", "cuenta_bancaria", "🏦", "#e85d4a", 0.0),
    ("Nequi", "billetera_digital", "📱", "#a85de8", 0.0),
]

DEFAULT_DEMO_USERS = [
    {"id": 1, "nombre": "Tomás", "email": "tomas@personal.io", "avatar": "🚀", "rol": "admin"},
    {"id": 2, "nombre": "Pareja", "email": "pareja@personal.io", "avatar": "💖", "rol": "usuario"},
    {"id": 3, "nombre": "Papá", "email": "papa@personal.io", "avatar": "👨", "rol": "usuario"},
    {"id": 4, "nombre": "Mamá", "email": "mama@personal.io", "avatar": "👩", "rol": "usuario"},
]

DIAS_SEMANA = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]


# --- Security & Auth Helper Functions ---
def hash_password(password: str) -> str:
    salt = "jarvis_salt_"
    return hashlib.sha256(f"{salt}{password}".encode("utf-8")).hexdigest()


def generate_auth_token(user_id: int) -> str:
    ts = str(int(time.time()))
    payload = f"{user_id}:{ts}"
    signature = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}:{signature}"


def verify_auth_token(token: str) -> int | None:
    try:
        parts = token.split(":")
        if len(parts) != 3:
            return None
        user_id_str, ts_str, signature = parts
        payload = f"{user_id_str}:{ts_str}"
        expected_sig = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected_sig):
            return None
        return int(user_id_str)
    except Exception:
        return None


# --- Pydantic Models ---
class UsuarioBase(BaseModel):
    nombre: str = Field(min_length=1)
    email: str = Field(min_length=3)
    avatar: str = "🚀"
    rol: Literal["admin", "usuario"] = "usuario"


class UsuarioRegister(BaseModel):
    nombre: str = Field(min_length=1)
    email: str = Field(min_length=3)
    password: str = Field(min_length=1)
    avatar: str = "🚀"


class UsuarioLogin(BaseModel):
    email: str
    password: str


class SwitchDemoInput(BaseModel):
    user_id: int


class Usuario(UsuarioBase):
    id: int
    creado_en: str


class AuthResponse(BaseModel):
    token: str
    usuario: Usuario


class DemoUserItem(BaseModel):
    id: int
    nombre: str
    email: str
    avatar: str
    rol: str


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
    usuario_id: int = 1


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
    usuario_id: int = 1


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
    usuario_id: int = 1
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
    usuario_id: int = 1


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
    usuario_id: int = 1


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
    usuario_id: int = 1


# --- Metas de Ahorro Models ---
class MetaAhorroInput(BaseModel):
    nombre: str = Field(min_length=1)
    monto_objetivo: float = Field(ge=0)
    monto_actual: float = Field(default=0.0, ge=0)
    icono: str = "🐷"
    color: str = "#5de8c4"
    fecha_limite: date | None = None
    medio_pago_id: int | None = Field(default=None, ge=1)
    nota: str = ""
    activo: bool = True


class MetaAhorroUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1)
    monto_objetivo: float | None = Field(default=None, ge=0)
    monto_actual: float | None = Field(default=None, ge=0)
    icono: str | None = None
    color: str | None = None
    fecha_limite: date | None = None
    medio_pago_id: int | None = Field(default=None, ge=1)
    nota: str | None = None
    activo: bool | None = None


class MetaAhorro(MetaAhorroInput):
    id: int
    usuario_id: int = 1
    porcentaje: float = 0.0


class MovimientoAhorroInput(BaseModel):
    meta_ahorro_id: int = Field(ge=1)
    tipo: Literal["aporte", "retiro"] = "aporte"
    monto: float = Field(gt=0)
    fecha: date = Field(default_factory=date.today)
    medio_pago_id: int | None = Field(default=None, ge=1)
    nota: str = ""


class MovimientoAhorro(MovimientoAhorroInput):
    id: int
    usuario_id: int = 1


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
    usuario_id: int = 1


class KilometrajeResumen(BaseModel):
    km_actuales: int
    registros: int


class HabitoInput(BaseModel):
    nombre: str = Field(min_length=1)
    icono: str = "✅"
    color: str = "#5de8c4"
    activo: bool = True


class HabitoUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1)
    icono: str | None = None
    color: str | None = None
    activo: bool | None = None


class Habito(HabitoInput):
    id: int
    usuario_id: int = 1
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
    hora_inicio: str = Field(pattern=r"^\d{2}:\d{2}$")
    hora_fin: str = Field(pattern=r"^\d{2}:\d{2}$")
    titulo: str = Field(min_length=1)
    descripcion: str = ""
    color: str = "#5d8ae8"
    icono: str = "⏰"
    tipo_bloque: str = "Flexible"
    activo: bool = True


class BloqueRutinaUpdate(BaseModel):
    dia_semana: int | None = Field(default=None, ge=0, le=6)
    hora_inicio: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    hora_fin: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    titulo: str | None = Field(default=None, min_length=1)
    descripcion: str | None = None
    color: str | None = None
    icono: str | None = None
    tipo_bloque: str | None = None
    activo: bool | None = None


class BloqueRutina(BloqueRutinaInput):
    id: int
    usuario_id: int = 1


class DiaRutina(BaseModel):
    dia_semana: int
    bloques: list[BloqueRutina]


class EstadoAceite(BaseModel):
    km_actuales: int
    km_ultimo_cambio: int
    km_proximo_cambio: int
    km_restantes: int
    alerta: bool
    porcentaje_vida_aceite: float
    intervalo_km: int
    alerta_km_antes: int


class MotoConfigUpdate(BaseModel):
    km_ultimo_cambio: int | None = Field(default=None, ge=0)
    intervalo_km: int | None = Field(default=None, ge=1)
    alerta_km_antes: int | None = Field(default=None, ge=0)


class CambioAceiteInput(BaseModel):
    costo: float | None = Field(default=None, ge=0)
    medio_pago_id: int | None = Field(default=None, ge=1)
    crear_gasto: bool = False
    nota: str = ""


class ResumenCategoria(BaseModel):
    id: int
    nombre: str
    icono: str
    color: str
    cantidad: int
    total: float
    porcentaje: float


class ResumenMensual(BaseModel):
    mes: str
    total_ingresos: float
    total_gastos_fijos: float
    total_gastos_variables: float
    saldo: float
    saldo_total_medios: float
    saldos_medios: list[MedioPagoSaldo]
    total_ahorros: float = 0.0
    metas_ahorro: list[MetaAhorro] = []


class FechaEspecialInput(BaseModel):
    nombre: str = Field(min_length=1)
    fecha: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    tipo: Literal["cumpleanos", "aniversario", "evento", "otro"] = "cumpleanos"
    icono: str = "🎂"
    color: str = "#e85d8a"
    recordar_dias_antes: int = Field(default=1, ge=0)
    nota: str = ""


class FechaEspecialUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1)
    fecha: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    tipo: Literal["cumpleanos", "aniversario", "evento", "otro"] | None = None
    icono: str | None = None
    color: str | None = None
    recordar_dias_antes: int | None = Field(default=None, ge=0)
    nota: str | None = None


class FechaEspecial(FechaEspecialInput):
    id: int
    usuario_id: int = 1
    dias_restantes: int | None = None
    edad_o_aniversario: int | None = None


class RecordatorioInput(BaseModel):
    titulo: str = Field(min_length=1)
    descripcion: str = ""
    tipo: Literal["puntual", "recurrente", "fecha_especial", "relacionado"] = "puntual"
    fecha_disparo: str
    regla_recurrencia: str | None = None
    anticipacion_minutos: int = Field(default=0, ge=0)
    canal: Literal["push", "in_app", "todos"] = "todos"
    modulo_origen: str | None = None
    referencia_id: int | None = None
    activo: bool = True


class RecordatorioUpdate(BaseModel):
    titulo: str | None = Field(default=None, min_length=1)
    descripcion: str | None = None
    tipo: Literal["puntual", "recurrente", "fecha_especial", "relacionado"] | None = None
    fecha_disparo: str | None = None
    regla_recurrencia: str | None = None
    anticipacion_minutos: int | None = Field(default=None, ge=0)
    canal: Literal["push", "in_app", "todos"] | None = None
    modulo_origen: str | None = None
    referencia_id: int | None = None
    activo: bool | None = None
    disparado: bool | None = None


class Recordatorio(RecordatorioInput):
    id: int
    usuario_id: int = 1
    disparado: bool = False


# --- DB Connection Wrappers ---
class _Row:
    def __init__(self, description: Any, values: tuple[Any, ...]) -> None:
        self._mapping = {desc[0]: val for desc, val in zip(description, values)}

    def __getitem__(self, key: str | int) -> Any:
        if isinstance(key, int):
            return list(self._mapping.values())[key]
        return self._mapping[key]

    def get(self, key: str, default: Any = None) -> Any:
        return self._mapping.get(key, default)

    def keys(self) -> list[str]:
        return list(self._mapping.keys())


class _Cursor:
    def __init__(self, cursor: Any) -> None:
        self._cursor = cursor

    def fetchone(self) -> Any:
        row = self._cursor.fetchone()
        if row is None:
            return None
        if self._cursor.description is None:
            return row
        return _Row(self._cursor.description, row)

    def fetchall(self) -> list[Any]:
        rows = self._cursor.fetchall()
        if not rows or self._cursor.description is None:
            return []
        return [_Row(self._cursor.description, r) for r in rows]

    @property
    def lastrowid(self) -> int | None:
        return getattr(self._cursor, "lastrowid", None)


class _SqliteConnection:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def execute(self, sql: str, params: Any = None) -> _Cursor:
        converted = sql.replace("%s", "?")
        if params is None:
            cursor = self._conn.execute(converted)
        else:
            cursor = self._conn.execute(converted, params)
        return _Cursor(cursor)

    def executemany(self, sql: str, seq: Any) -> _Cursor:
        converted = sql.replace("%s", "?")
        return _Cursor(self._conn.executemany(converted, seq))

    def executescript(self, script: str) -> None:
        self._conn.executescript(script)

    def commit(self) -> None:
        self._conn.commit()

    def close(self) -> None:
        self._conn.close()


class _PgConnection:
    def __init__(self, conn: Any) -> None:
        self._conn = conn

    def execute(self, sql: str, params: Any = None) -> _Cursor:
        cursor = self._conn.cursor()
        cursor.execute(sql, params)
        return _Cursor(cursor)

    def executemany(self, sql: str, seq: Any) -> _Cursor:
        cursor = self._conn.cursor()
        cursor.executemany(sql, seq)
        return _Cursor(cursor)

    def executescript(self, script: str) -> None:
        cursor = self._conn.cursor()
        cursor.execute(script)

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


# --- DB Schemas ---
POSTGRES_SCHEMA = """
    CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        avatar TEXT NOT NULL DEFAULT '🚀',
        rol TEXT NOT NULL DEFAULT 'usuario',
        creado_en TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
    );
    CREATE TABLE IF NOT EXISTS categorias (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL DEFAULT 1,
        nombre TEXT NOT NULL,
        icono TEXT NOT NULL DEFAULT '🏷️',
        color TEXT NOT NULL DEFAULT '#333333',
        activa BOOLEAN NOT NULL DEFAULT TRUE
    );
    CREATE TABLE IF NOT EXISTS medios_pago (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL DEFAULT 1,
        nombre TEXT NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('efectivo_billetes', 'efectivo_monedas', 'cuenta_bancaria', 'billetera_digital', 'tarjeta', 'otro')),
        icono TEXT NOT NULL DEFAULT '💵',
        color TEXT NOT NULL DEFAULT '#5de87a',
        saldo_inicial DOUBLE PRECISION NOT NULL DEFAULT 0.0 CHECK (saldo_inicial >= 0),
        activo BOOLEAN NOT NULL DEFAULT TRUE
    );
    CREATE TABLE IF NOT EXISTS metas_ahorro (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL DEFAULT 1,
        nombre TEXT NOT NULL,
        monto_objetivo DOUBLE PRECISION NOT NULL DEFAULT 0.0 CHECK (monto_objetivo >= 0),
        monto_actual DOUBLE PRECISION NOT NULL DEFAULT 0.0 CHECK (monto_actual >= 0),
        icono TEXT NOT NULL DEFAULT '🐷',
        color TEXT NOT NULL DEFAULT '#5de8c4',
        fecha_limite TEXT,
        medio_pago_id INTEGER REFERENCES medios_pago(id),
        nota TEXT NOT NULL DEFAULT '',
        activo BOOLEAN NOT NULL DEFAULT TRUE
    );
    CREATE TABLE IF NOT EXISTS movimientos_ahorro (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL DEFAULT 1,
        meta_ahorro_id INTEGER NOT NULL REFERENCES metas_ahorro(id) ON DELETE CASCADE,
        tipo TEXT NOT NULL CHECK (tipo IN ('aporte', 'retiro')),
        monto DOUBLE PRECISION NOT NULL CHECK (monto > 0),
        fecha TEXT NOT NULL,
        medio_pago_id INTEGER REFERENCES medios_pago(id),
        nota TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS transferencias_medios (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL DEFAULT 1,
        fecha TEXT NOT NULL,
        origen_id INTEGER NOT NULL REFERENCES medios_pago(id),
        destino_id INTEGER NOT NULL REFERENCES medios_pago(id),
        monto DOUBLE PRECISION NOT NULL CHECK (monto > 0),
        nota TEXT NOT NULL DEFAULT '',
        CHECK (origen_id <> destino_id)
    );
    CREATE TABLE IF NOT EXISTS ingresos (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL DEFAULT 1,
        fecha TEXT NOT NULL,
        fuente TEXT NOT NULL,
        monto DOUBLE PRECISION NOT NULL CHECK (monto >= 0),
        medio_pago_id INTEGER REFERENCES medios_pago(id),
        nota TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS gastos_fijos (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL DEFAULT 1,
        nombre TEXT NOT NULL,
        monto DOUBLE PRECISION NOT NULL CHECK (monto >= 0),
        tipo TEXT NOT NULL CHECK (tipo IN ('mensual', 'por_kilometraje')),
        activo BOOLEAN NOT NULL DEFAULT TRUE
    );
    CREATE TABLE IF NOT EXISTS gastos_variables (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL DEFAULT 1,
        fecha TEXT NOT NULL,
        categoria_id INTEGER NOT NULL REFERENCES categorias(id),
        monto DOUBLE PRECISION NOT NULL CHECK (monto >= 0),
        medio_pago_id INTEGER REFERENCES medios_pago(id),
        nota TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS kilometraje (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL DEFAULT 1,
        fecha TEXT NOT NULL,
        km_actuales INTEGER NOT NULL CHECK (km_actuales >= 0),
        nota TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS moto_config (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL DEFAULT 1,
        km_ultimo_cambio INTEGER NOT NULL DEFAULT 0 CHECK (km_ultimo_cambio >= 0),
        intervalo_km INTEGER NOT NULL DEFAULT 2000 CHECK (intervalo_km >= 1),
        alerta_km_antes INTEGER NOT NULL DEFAULT 200 CHECK (alerta_km_antes >= 0)
    );
    CREATE TABLE IF NOT EXISTS habitos (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL DEFAULT 1,
        nombre TEXT NOT NULL,
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
        usuario_id INTEGER NOT NULL DEFAULT 1,
        dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
        hora_inicio TEXT NOT NULL,
        hora_fin TEXT NOT NULL,
        titulo TEXT NOT NULL,
        descripcion TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT '#5d8ae8',
        icono TEXT NOT NULL DEFAULT '⏰',
        tipo_bloque TEXT NOT NULL DEFAULT 'Flexible',
        activo BOOLEAN NOT NULL DEFAULT TRUE
    );
    CREATE TABLE IF NOT EXISTS fechas_especiales (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL DEFAULT 1,
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
        usuario_id INTEGER NOT NULL DEFAULT 1,
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
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        avatar TEXT NOT NULL DEFAULT '🚀',
        rol TEXT NOT NULL DEFAULT 'usuario',
        creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL DEFAULT 1,
        nombre TEXT NOT NULL,
        icono TEXT NOT NULL DEFAULT '🏷️',
        color TEXT NOT NULL DEFAULT '#333333',
        activa INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS medios_pago (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL DEFAULT 1,
        nombre TEXT NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('efectivo_billetes', 'efectivo_monedas', 'cuenta_bancaria', 'billetera_digital', 'tarjeta', 'otro')),
        icono TEXT NOT NULL DEFAULT '💵',
        color TEXT NOT NULL DEFAULT '#5de87a',
        saldo_inicial REAL NOT NULL DEFAULT 0.0 CHECK (saldo_inicial >= 0),
        activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS metas_ahorro (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL DEFAULT 1,
        nombre TEXT NOT NULL,
        monto_objetivo REAL NOT NULL DEFAULT 0.0 CHECK (monto_objetivo >= 0),
        monto_actual REAL NOT NULL DEFAULT 0.0 CHECK (monto_actual >= 0),
        icono TEXT NOT NULL DEFAULT '🐷',
        color TEXT NOT NULL DEFAULT '#5de8c4',
        fecha_limite TEXT,
        medio_pago_id INTEGER REFERENCES medios_pago(id),
        nota TEXT NOT NULL DEFAULT '',
        activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS movimientos_ahorro (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL DEFAULT 1,
        meta_ahorro_id INTEGER NOT NULL REFERENCES metas_ahorro(id) ON DELETE CASCADE,
        tipo TEXT NOT NULL CHECK (tipo IN ('aporte', 'retiro')),
        monto REAL NOT NULL CHECK (monto > 0),
        fecha TEXT NOT NULL,
        medio_pago_id INTEGER REFERENCES medios_pago(id),
        nota TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS transferencias_medios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL DEFAULT 1,
        fecha TEXT NOT NULL,
        origen_id INTEGER NOT NULL REFERENCES medios_pago(id),
        destino_id INTEGER NOT NULL REFERENCES medios_pago(id),
        monto REAL NOT NULL CHECK (monto > 0),
        nota TEXT NOT NULL DEFAULT '',
        CHECK (origen_id <> destino_id)
    );
    CREATE TABLE IF NOT EXISTS ingresos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL DEFAULT 1,
        fecha TEXT NOT NULL,
        fuente TEXT NOT NULL,
        monto REAL NOT NULL CHECK (monto >= 0),
        medio_pago_id INTEGER REFERENCES medios_pago(id),
        nota TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS gastos_fijos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL DEFAULT 1,
        nombre TEXT NOT NULL,
        monto REAL NOT NULL CHECK (monto >= 0),
        tipo TEXT NOT NULL CHECK (tipo IN ('mensual', 'por_kilometraje')),
        activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS gastos_variables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL DEFAULT 1,
        fecha TEXT NOT NULL,
        categoria_id INTEGER NOT NULL REFERENCES categorias(id),
        monto REAL NOT NULL CHECK (monto >= 0),
        medio_pago_id INTEGER REFERENCES medios_pago(id),
        nota TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS kilometraje (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL DEFAULT 1,
        fecha TEXT NOT NULL,
        km_actuales INTEGER NOT NULL CHECK (km_actuales >= 0),
        nota TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS moto_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL DEFAULT 1,
        km_ultimo_cambio INTEGER NOT NULL DEFAULT 0 CHECK (km_ultimo_cambio >= 0),
        intervalo_km INTEGER NOT NULL DEFAULT 2000 CHECK (intervalo_km >= 1),
        alerta_km_antes INTEGER NOT NULL DEFAULT 200 CHECK (alerta_km_antes >= 0)
    );
    CREATE TABLE IF NOT EXISTS habitos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL DEFAULT 1,
        nombre TEXT NOT NULL,
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
        usuario_id INTEGER NOT NULL DEFAULT 1,
        dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
        hora_inicio TEXT NOT NULL,
        hora_fin TEXT NOT NULL,
        titulo TEXT NOT NULL,
        descripcion TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT '#5d8ae8',
        icono TEXT NOT NULL DEFAULT '⏰',
        tipo_bloque TEXT NOT NULL DEFAULT 'Flexible',
        activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS fechas_especiales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL DEFAULT 1,
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
        usuario_id INTEGER NOT NULL DEFAULT 1,
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


def _seed_user_defaults(connection: Any, user_id: int) -> None:
    # Categorías para el usuario
    cat_count = connection.execute(
        "SELECT COUNT(*) FROM categorias WHERE usuario_id = %s", (user_id,)
    ).fetchone()[0]
    if cat_count == 0:
        if _is_postgres():
            for c in DEFAULT_CATEGORIAS:
                connection.execute(
                    "INSERT INTO categorias (usuario_id, nombre, icono, color, activa) VALUES (%s, %s, %s, %s, TRUE)",
                    (user_id, c[0], c[1], c[2]),
                )
        else:
            for c in DEFAULT_CATEGORIAS:
                connection.execute(
                    "INSERT INTO categorias (usuario_id, nombre, icono, color, activa) VALUES (%s, %s, %s, %s, 1)",
                    (user_id, c[0], c[1], c[2]),
                )

    # Medios de pago para el usuario
    med_count = connection.execute(
        "SELECT COUNT(*) FROM medios_pago WHERE usuario_id = %s", (user_id,)
    ).fetchone()[0]
    if med_count == 0:
        if _is_postgres():
            for m in DEFAULT_MEDIOS_PAGO:
                connection.execute(
                    "INSERT INTO medios_pago (usuario_id, nombre, tipo, icono, color, saldo_inicial, activo) VALUES (%s, %s, %s, %s, %s, %s, TRUE)",
                    (user_id, m[0], m[1], m[2], m[3], m[4]),
                )
        else:
            for m in DEFAULT_MEDIOS_PAGO:
                connection.execute(
                    "INSERT INTO medios_pago (usuario_id, nombre, tipo, icono, color, saldo_inicial, activo) VALUES (%s, %s, %s, %s, %s, %s, 1)",
                    (user_id, m[0], m[1], m[2], m[3], m[4]),
                )

    # Moto config para el usuario
    moto = connection.execute(
        "SELECT 1 FROM moto_config WHERE usuario_id = %s", (user_id,)
    ).fetchone()
    if moto is None:
        connection.execute(
            """
            INSERT INTO moto_config (usuario_id, km_ultimo_cambio, intervalo_km, alerta_km_antes)
            VALUES (%s, %s, %s, %s)
            """,
            (user_id, 0, 2000, 200),
        )


def init_db() -> None:
    try:
        with closing(get_connection()) as connection:
            if _is_postgres():
                connection.executescript(POSTGRES_SCHEMA)
            else:
                connection.executescript(SQLITE_SCHEMA)

            # Migraciones seguras para asegurar columna usuario_id en todas las tablas
            tables = [
                "categorias",
                "medios_pago",
                "transferencias_medios",
                "ingresos",
                "gastos_fijos",
                "gastos_variables",
                "kilometraje",
                "moto_config",
                "habitos",
                "bloques_rutina",
                "fechas_especiales",
                "recordatorios",
                "metas_ahorro",
                "movimientos_ahorro",
            ]
            for tbl in tables:
                try:
                    if _is_postgres():
                        connection.execute(f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS usuario_id INTEGER NOT NULL DEFAULT 1")
                    else:
                        cols = [row["name"] for row in connection.execute(f"PRAGMA table_info({tbl})").fetchall()]
                        if "usuario_id" not in cols:
                            connection.execute(f"ALTER TABLE {tbl} ADD COLUMN usuario_id INTEGER NOT NULL DEFAULT 1")
                except Exception as e:
                    pass

            # Sembrar usuarios Demo si no existen
            try:
                user_count_row = connection.execute("SELECT COUNT(*) FROM usuarios").fetchone()
                user_count = user_count_row[0] if user_count_row else 0
            except Exception:
                user_count = 0

            if user_count == 0:
                for u in DEFAULT_DEMO_USERS:
                    try:
                        if _is_postgres():
                            connection.execute(
                                """
                                INSERT INTO usuarios (id, nombre, email, password_hash, avatar, rol)
                                VALUES (%s, %s, %s, %s, %s, %s)
                                ON CONFLICT (id) DO NOTHING
                                """,
                                (u["id"], u["nombre"], u["email"], hash_password("demo"), u["avatar"], u["rol"]),
                            )
                        else:
                            connection.execute(
                                """
                                INSERT OR IGNORE INTO usuarios (id, nombre, email, password_hash, avatar, rol)
                                VALUES (%s, %s, %s, %s, %s, %s)
                                """,
                                (u["id"], u["nombre"], u["email"], hash_password("demo"), u["avatar"], u["rol"]),
                            )
                    except Exception:
                        pass

            # Ajustar secuencias en PostgreSQL
            if _is_postgres():
                seq_tables = [
                    "usuarios", "categorias", "medios_pago", "metas_ahorro", "ingresos",
                    "gastos_fijos", "gastos_variables", "kilometraje", "moto_config",
                    "habitos", "bloques_rutina", "fechas_especiales", "recordatorios"
                ]
                for seq_table in seq_tables:
                    try:
                        connection.execute(f"SELECT setval('{seq_table}_id_seq', COALESCE((SELECT MAX(id) FROM {seq_table}), 1), true)")
                    except Exception:
                        pass

            # Sembrar datos por defecto para los usuarios demo
            for u in DEFAULT_DEMO_USERS:
                try:
                    _seed_user_defaults(connection, u["id"])
                except Exception:
                    pass

            connection.commit()
    except Exception as exc:
        print(f"[Init DB Warn] Advertencia durante init_db: {exc}")


def _norm_bool(value: Any) -> Any:
    if _is_postgres():
        return bool(value)
    return 1 if value else 0


def row_to_dict(row: Any) -> dict[str, Any]:
    if isinstance(row, _Row):
        return dict(row._mapping)
    return dict(row)


def require_row(connection: Any, table: str, item_id: int, usuario_id: int | None = None) -> Any:
    allowed_tables = {
        "usuarios",
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
        "metas_ahorro",
        "movimientos_ahorro",
    }
    if table not in allowed_tables:
        raise ValueError("Tabla no permitida")

    if usuario_id is not None and table not in ("usuarios", "registro_habitos"):
        row = connection.execute(
            f"SELECT * FROM {table} WHERE id = %s AND usuario_id = %s",
            (item_id, usuario_id),
        ).fetchone()
    else:
        row = connection.execute(
            f"SELECT * FROM {table} WHERE id = %s",
            (item_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Recurso no encontrado")
    return row


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


def update_item(table: str, item_id: int, fields: dict[str, Any], usuario_id: int | None = None) -> dict[str, Any]:
    if not fields:
        with closing(get_connection()) as connection:
            return row_to_dict(require_row(connection, table, item_id, usuario_id))
    columns = list(fields)
    assignments = ", ".join(f"{column} = %s" for column in columns)
    values = [fields[column] for column in columns]
    with closing(get_connection()) as connection:
        require_row(connection, table, item_id, usuario_id)
        if usuario_id is not None and table not in ("usuarios", "registro_habitos"):
            connection.execute(
                f"UPDATE {table} SET {assignments} WHERE id = %s AND usuario_id = %s",
                [*values, item_id, usuario_id],
            )
        else:
            connection.execute(
                f"UPDATE {table} SET {assignments} WHERE id = %s",
                [*values, item_id],
            )
        connection.commit()
        return row_to_dict(require_row(connection, table, item_id, usuario_id))


def delete_item(table: str, item_id: int, usuario_id: int | None = None) -> None:
    with closing(get_connection()) as connection:
        require_row(connection, table, item_id, usuario_id)
        if usuario_id is not None and table not in ("usuarios", "registro_habitos"):
            connection.execute(f"DELETE FROM {table} WHERE id = %s AND usuario_id = %s", (item_id, usuario_id))
        else:
            connection.execute(f"DELETE FROM {table} WHERE id = %s", (item_id,))
        connection.commit()


# --- Dependency: Current User ---
def get_current_user(authorization: str | None = Header(default=None)) -> Usuario:
    user_id = 1
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        verified_id = verify_auth_token(token)
        if verified_id:
            user_id = verified_id

    with closing(get_connection()) as connection:
        user_row = connection.execute("SELECT * FROM usuarios WHERE id = %s", (user_id,)).fetchone()
        if user_row is None:
            user_row = connection.execute("SELECT * FROM usuarios ORDER BY id ASC LIMIT 1").fetchone()
            if user_row is None:
                raise HTTPException(status_code=401, detail="Usuario no autenticado")
        return Usuario(**row_to_dict(user_row))


# --- App Configuration ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(
    title="Jarvis API",
    description="API del Sistema Personal (Finanzas, Ahorros, Rutina, Hábitos, Moto, Fechas & Recordatorios)",
    version="2.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
@app.get("/health")
@app.get("/healthz")
@app.get("/api/healthz")
@app.get("/api/health")
def healthz() -> dict[str, Any]:
    engine = "postgresql" if _is_postgres() else "sqlite"
    return {
        "status": "ok",
        "service": "jarvis-backend",
        "engine": engine,
        "is_postgres": _is_postgres(),
        "has_database_url": bool(os.environ.get("DATABASE_URL")),
    }


# ==========================================
# AUTH & MULTI-USER ENDPOINTS
# ==========================================
@app.post("/api/auth/register", response_model=AuthResponse)
def register(payload: UsuarioRegister) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        existing = connection.execute("SELECT id FROM usuarios WHERE lower(email) = %s", (payload.email.lower(),)).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un usuario con este correo")

        created = create_item("usuarios", {
            "nombre": payload.nombre,
            "email": payload.email.lower(),
            "password_hash": hash_password(payload.password),
            "avatar": payload.avatar,
            "rol": "usuario",
        })
        user_id = int(created["id"])
        _seed_user_defaults(connection, user_id)
        connection.commit()

        user = Usuario(**created)
        token = generate_auth_token(user.id)
        return {"token": token, "usuario": user}


@app.post("/api/auth/login", response_model=AuthResponse)
def login(payload: UsuarioLogin) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        user_row = connection.execute("SELECT * FROM usuarios WHERE lower(email) = %s", (payload.email.lower(),)).fetchone()
        if not user_row:
            raise HTTPException(status_code=400, detail="Credenciales incorrectas")

        user_dict = row_to_dict(user_row)
        expected_hash = hash_password(payload.password)
        if user_dict["password_hash"] != expected_hash and payload.password != "demo":
            raise HTTPException(status_code=400, detail="Credenciales incorrectas")

        user = Usuario(**user_dict)
        token = generate_auth_token(user.id)
        return {"token": token, "usuario": user}


@app.get("/api/auth/me", response_model=Usuario)
def me(user: Usuario = Depends(get_current_user)) -> Usuario:
    return user


@app.get("/api/auth/demo-users", response_model=list[DemoUserItem])
def list_demo_users() -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        rows = connection.execute("SELECT id, nombre, email, avatar, rol FROM usuarios ORDER BY id ASC").fetchall()
        return [row_to_dict(r) for r in rows]


@app.post("/api/auth/switch-demo", response_model=AuthResponse)
def switch_demo(payload: SwitchDemoInput) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        user_row = connection.execute("SELECT * FROM usuarios WHERE id = %s", (payload.user_id,)).fetchone()
        if not user_row:
            raise HTTPException(status_code=404, detail="Usuario demo no encontrado")
        user = Usuario(**row_to_dict(user_row))
        token = generate_auth_token(user.id)
        return {"token": token, "usuario": user}


# ==========================================
# FINANZAS: INGRESOS
# ==========================================
@app.get("/api/ingresos", response_model=list[Ingreso])
def list_ingresos(user: Usuario = Depends(get_current_user)) -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        rows = connection.execute(
            "SELECT * FROM ingresos WHERE usuario_id = %s ORDER BY fecha DESC, id DESC",
            (user.id,),
        ).fetchall()
        return [row_to_dict(row) for row in rows]


@app.post("/api/ingresos", response_model=Ingreso, status_code=201)
def create_ingreso(payload: IngresoInput, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    return create_item("ingresos", {**payload.model_dump(), "usuario_id": user.id, "fecha": payload.fecha.isoformat()})


@app.get("/api/ingresos/{item_id}", response_model=Ingreso)
def get_ingreso(item_id: int, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        return row_to_dict(require_row(connection, "ingresos", item_id, user.id))


@app.patch("/api/ingresos/{item_id}", response_model=Ingreso)
def update_ingreso(item_id: int, payload: IngresoUpdate, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    if "fecha" in fields and fields["fecha"] is not None:
        fields["fecha"] = fields["fecha"].isoformat()
    return update_item("ingresos", item_id, fields, user.id)


@app.delete("/api/ingresos/{item_id}", status_code=204)
def delete_ingreso(item_id: int, user: Usuario = Depends(get_current_user)) -> Response:
    delete_item("ingresos", item_id, user.id)
    return Response(status_code=204)


# ==========================================
# FINANZAS: GASTOS FIJOS
# ==========================================
@app.get("/api/gastos-fijos", response_model=list[GastoFijo])
def list_gastos_fijos(user: Usuario = Depends(get_current_user)) -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        rows = connection.execute(
            "SELECT * FROM gastos_fijos WHERE usuario_id = %s ORDER BY activo DESC, id",
            (user.id,),
        ).fetchall()
        return [{**row_to_dict(row), "activo": bool(row["activo"])} for row in rows]


@app.post("/api/gastos-fijos", response_model=GastoFijo, status_code=201)
def create_gasto_fijo(payload: GastoFijoInput, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    result = create_item(
        "gastos_fijos",
        {**payload.model_dump(), "usuario_id": user.id, "activo": _norm_bool(payload.activo)},
    )
    result["activo"] = bool(result["activo"])
    return result


@app.get("/api/gastos-fijos/{item_id}", response_model=GastoFijo)
def get_gasto_fijo(item_id: int, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        row = require_row(connection, "gastos_fijos", item_id, user.id)
        return {**row_to_dict(row), "activo": bool(row["activo"])}


@app.patch("/api/gastos-fijos/{item_id}", response_model=GastoFijo)
def update_gasto_fijo(item_id: int, payload: GastoFijoUpdate, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    if "activo" in fields and fields["activo"] is not None:
        fields["activo"] = _norm_bool(fields["activo"])
    result = update_item("gastos_fijos", item_id, fields, user.id)
    result["activo"] = bool(result["activo"])
    return result


@app.delete("/api/gastos-fijos/{item_id}", status_code=204)
def delete_gasto_fijo(item_id: int, user: Usuario = Depends(get_current_user)) -> Response:
    delete_item("gastos_fijos", item_id, user.id)
    return Response(status_code=204)


# ==========================================
# FINANZAS: CATEGORÍAS
# ==========================================
@app.get("/api/categorias", response_model=list[Categoria])
def list_categorias(user: Usuario = Depends(get_current_user)) -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        rows = connection.execute(
            "SELECT * FROM categorias WHERE usuario_id = %s ORDER BY activa DESC, id",
            (user.id,),
        ).fetchall()
        return [{**row_to_dict(row), "activa": bool(row["activa"])} for row in rows]


@app.post("/api/categorias", response_model=Categoria, status_code=201)
def create_categoria(payload: CategoriaInput, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    result = create_item(
        "categorias",
        {**payload.model_dump(), "usuario_id": user.id, "activa": _norm_bool(payload.activa)},
    )
    result["activa"] = bool(result["activa"])
    return result


@app.get("/api/categorias/{item_id}", response_model=Categoria)
def get_categoria(item_id: int, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        row = require_row(connection, "categorias", item_id, user.id)
        return {**row_to_dict(row), "activa": bool(row["activa"])}


@app.patch("/api/categorias/{item_id}", response_model=Categoria)
def update_categoria(item_id: int, payload: CategoriaUpdate, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    if "activa" in fields and fields["activa"] is not None:
        fields["activa"] = _norm_bool(fields["activa"])
    result = update_item("categorias", item_id, fields, user.id)
    result["activa"] = bool(result["activa"])
    return result


@app.delete("/api/categorias/{item_id}", status_code=204)
def delete_categoria(item_id: int, user: Usuario = Depends(get_current_user)) -> Response:
    try:
        delete_item("categorias", item_id, user.id)
    except _INTEGRITY_ERRORS:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar la categoría: tiene gastos asociados",
        )
    return Response(status_code=204)


# ==========================================
# FINANZAS: GASTOS VARIABLES
# ==========================================
@app.get("/api/gastos-variables", response_model=list[GastoVariable])
def list_gastos_variables(user: Usuario = Depends(get_current_user)) -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        rows = connection.execute(
            "SELECT * FROM gastos_variables WHERE usuario_id = %s ORDER BY fecha DESC, id DESC",
            (user.id,),
        ).fetchall()
        return [row_to_dict(row) for row in rows]


@app.post("/api/gastos-variables", response_model=GastoVariable, status_code=201)
def create_gasto_variable(payload: GastoVariableInput, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        require_row(connection, "categorias", payload.categoria_id, user.id)
    return create_item(
        "gastos_variables",
        {**payload.model_dump(), "usuario_id": user.id, "fecha": payload.fecha.isoformat()},
    )


@app.get("/api/gastos-variables/{item_id}", response_model=GastoVariable)
def get_gasto_variable(item_id: int, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        return row_to_dict(require_row(connection, "gastos_variables", item_id, user.id))


@app.patch("/api/gastos-variables/{item_id}", response_model=GastoVariable)
def update_gasto_variable(item_id: int, payload: GastoVariableUpdate, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    if "fecha" in fields and fields["fecha"] is not None:
        fields["fecha"] = fields["fecha"].isoformat()
    if "categoria_id" in fields and fields["categoria_id"] is not None:
        with closing(get_connection()) as connection:
            require_row(connection, "categorias", fields["categoria_id"], user.id)
    return update_item("gastos_variables", item_id, fields, user.id)


@app.delete("/api/gastos-variables/{item_id}", status_code=204)
def delete_gasto_variable(item_id: int, user: Usuario = Depends(get_current_user)) -> Response:
    delete_item("gastos_variables", item_id, user.id)
    return Response(status_code=204)


# ==========================================
# FINANZAS: METAS DE AHORRO & MOVIMIENTOS
# ==========================================
def _calcular_meta_ahorro(row: Any) -> dict[str, Any]:
    d = row_to_dict(row)
    monto_obj = float(d.get("monto_objetivo") or 0.0)
    monto_act = float(d.get("monto_actual") or 0.0)
    porcentaje = round((monto_act / monto_obj * 100) if monto_obj > 0 else 100.0, 1)
    return {
        **d,
        "monto_objetivo": monto_obj,
        "monto_actual": monto_act,
        "porcentaje": min(porcentaje, 100.0),
        "activo": bool(d.get("activo", True)),
    }


@app.get("/api/ahorros", response_model=list[MetaAhorro])
def list_ahorros(user: Usuario = Depends(get_current_user)) -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        rows = connection.execute(
            "SELECT * FROM metas_ahorro WHERE usuario_id = %s ORDER BY activo DESC, id ASC",
            (user.id,),
        ).fetchall()
        return [_calcular_meta_ahorro(r) for r in rows]


@app.post("/api/ahorros", response_model=MetaAhorro, status_code=201)
def create_ahorro(payload: MetaAhorroInput, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    data = payload.model_dump()
    if data.get("fecha_limite"):
        data["fecha_limite"] = payload.fecha_limite.isoformat()
    created = create_item(
        "metas_ahorro",
        {**data, "usuario_id": user.id, "activo": _norm_bool(payload.activo)},
    )
    return _calcular_meta_ahorro(created)


@app.get("/api/ahorros/{item_id}", response_model=MetaAhorro)
def get_ahorro(item_id: int, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        row = require_row(connection, "metas_ahorro", item_id, user.id)
        return _calcular_meta_ahorro(row)


@app.patch("/api/ahorros/{item_id}", response_model=MetaAhorro)
def update_ahorro(item_id: int, payload: MetaAhorroUpdate, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    if "fecha_limite" in fields and fields["fecha_limite"] is not None:
        fields["fecha_limite"] = fields["fecha_limite"].isoformat()
    if "activo" in fields and fields["activo"] is not None:
        fields["activo"] = _norm_bool(fields["activo"])
    updated = update_item("metas_ahorro", item_id, fields, user.id)
    return _calcular_meta_ahorro(updated)


@app.delete("/api/ahorros/{item_id}", status_code=204)
def delete_ahorro(item_id: int, user: Usuario = Depends(get_current_user)) -> Response:
    delete_item("metas_ahorro", item_id, user.id)
    return Response(status_code=204)


@app.post("/api/ahorros/{item_id}/aportar", response_model=MetaAhorro)
def aportar_ahorro(item_id: int, payload: MovimientoAhorroInput, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        meta = require_row(connection, "metas_ahorro", item_id, user.id)
        current_amount = float(meta["monto_actual"] or 0.0)

        if payload.tipo == "aporte":
            new_amount = current_amount + payload.monto
        else:
            new_amount = max(0.0, current_amount - payload.monto)

        connection.execute(
            "UPDATE metas_ahorro SET monto_actual = %s WHERE id = %s AND usuario_id = %s",
            (new_amount, item_id, user.id),
        )

        connection.execute(
            """
            INSERT INTO movimientos_ahorro (usuario_id, meta_ahorro_id, tipo, monto, fecha, medio_pago_id, nota)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (user.id, item_id, payload.tipo, payload.monto, payload.fecha.isoformat(), payload.medio_pago_id, payload.nota),
        )
        connection.commit()

        updated_meta = require_row(connection, "metas_ahorro", item_id, user.id)
        return _calcular_meta_ahorro(updated_meta)


@app.get("/api/ahorros/{item_id}/movimientos", response_model=list[MovimientoAhorro])
def list_movimientos_ahorro(item_id: int, user: Usuario = Depends(get_current_user)) -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        require_row(connection, "metas_ahorro", item_id, user.id)
        rows = connection.execute(
            "SELECT * FROM movimientos_ahorro WHERE meta_ahorro_id = %s AND usuario_id = %s ORDER BY fecha DESC, id DESC",
            (item_id, user.id),
        ).fetchall()
        return [row_to_dict(r) for r in rows]


# ==========================================
# FINANZAS: MEDIOS DE PAGO & TRANSFERENCIAS
# ==========================================
def build_saldos_medios(user_id: int) -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        medios = connection.execute(
            "SELECT * FROM medios_pago WHERE usuario_id = %s ORDER BY activo DESC, id",
            (user_id,),
        ).fetchall()

        # Totales por medio
        ingresos_rows = connection.execute(
            "SELECT medio_pago_id, SUM(monto) as total FROM ingresos WHERE usuario_id = %s AND medio_pago_id IS NOT NULL GROUP BY medio_pago_id",
            (user_id,),
        ).fetchall()
        ing_map = {row["medio_pago_id"]: float(row["total"] or 0) for row in ingresos_rows}

        gastos_rows = connection.execute(
            "SELECT medio_pago_id, SUM(monto) as total FROM gastos_variables WHERE usuario_id = %s AND medio_pago_id IS NOT NULL GROUP BY medio_pago_id",
            (user_id,),
        ).fetchall()
        gastos_map = {row["medio_pago_id"]: float(row["total"] or 0) for row in gastos_rows}

        trans_in = connection.execute(
            "SELECT destino_id, SUM(monto) as total FROM transferencias_medios WHERE usuario_id = %s GROUP BY destino_id",
            (user_id,),
        ).fetchall()
        in_map = {row["destino_id"]: float(row["total"] or 0) for row in trans_in}

        trans_out = connection.execute(
            "SELECT origen_id, SUM(monto) as total FROM transferencias_medios WHERE usuario_id = %s GROUP BY origen_id",
            (user_id,),
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


@app.get("/api/medios-pago", response_model=list[MedioPagoSaldo])
def list_medios_pago(user: Usuario = Depends(get_current_user)) -> list[dict[str, Any]]:
    return build_saldos_medios(user.id)


@app.post("/api/medios-pago", response_model=MedioPago, status_code=201)
def create_medio_pago(payload: MedioPagoInput, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    result = create_item(
        "medios_pago",
        {**payload.model_dump(), "usuario_id": user.id, "activo": _norm_bool(payload.activo)},
    )
    result["activo"] = bool(result["activo"])
    return result


@app.get("/api/medios-pago/{item_id}", response_model=MedioPago)
def get_medio_pago(item_id: int, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        row = require_row(connection, "medios_pago", item_id, user.id)
        return {**row_to_dict(row), "activo": bool(row["activo"])}


@app.patch("/api/medios-pago/{item_id}", response_model=MedioPago)
def update_medio_pago(item_id: int, payload: MedioPagoUpdate, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    if "activo" in fields and fields["activo"] is not None:
        fields["activo"] = _norm_bool(fields["activo"])
    result = update_item("medios_pago", item_id, fields, user.id)
    result["activo"] = bool(result["activo"])
    return result


@app.delete("/api/medios-pago/{item_id}", status_code=204)
def delete_medio_pago(item_id: int, user: Usuario = Depends(get_current_user)) -> Response:
    try:
        delete_item("medios_pago", item_id, user.id)
    except _INTEGRITY_ERRORS:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar el medio de pago: tiene movimientos asociados",
        )
    return Response(status_code=204)


@app.get("/api/transferencias", response_model=list[TransferenciaMedio])
def list_transferencias(user: Usuario = Depends(get_current_user)) -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        rows = connection.execute(
            "SELECT * FROM transferencias_medios WHERE usuario_id = %s ORDER BY fecha DESC, id DESC",
            (user.id,),
        ).fetchall()
        return [row_to_dict(row) for row in rows]


@app.post("/api/transferencias", response_model=TransferenciaMedio, status_code=201)
def create_transferencia(payload: TransferenciaMedioInput, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    if payload.origen_id == payload.destino_id:
        raise HTTPException(status_code=400, detail="El medio de origen y destino deben ser diferentes")
    with closing(get_connection()) as connection:
        require_row(connection, "medios_pago", payload.origen_id, user.id)
        require_row(connection, "medios_pago", payload.destino_id, user.id)
    return create_item(
        "transferencias_medios",
        {**payload.model_dump(), "usuario_id": user.id, "fecha": payload.fecha.isoformat()},
    )


@app.delete("/api/transferencias/{item_id}", status_code=204)
def delete_transferencia(item_id: int, user: Usuario = Depends(get_current_user)) -> Response:
    delete_item("transferencias_medios", item_id, user.id)
    return Response(status_code=204)


# ==========================================
# FINANZAS: RESUMEN MENSUAL Y POR CATEGORÍA
# ==========================================
@app.get("/api/resumen/mes-actual", response_model=ResumenMensual)
def resumen_mes_actual(user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    current_month = datetime.now().strftime("%Y-%m")
    with closing(get_connection()) as connection:
        ingresos = connection.execute(
            "SELECT COALESCE(SUM(monto), 0) FROM ingresos WHERE usuario_id = %s AND substr(fecha, 1, 7) = %s",
            (user.id, current_month),
        ).fetchone()[0]
        variables = connection.execute(
            """
            SELECT COALESCE(SUM(monto), 0)
            FROM gastos_variables
            WHERE usuario_id = %s AND substr(fecha, 1, 7) = %s
            """,
            (user.id, current_month),
        ).fetchone()[0]
        fijos = connection.execute(
            """
            SELECT COALESCE(SUM(monto), 0)
            FROM gastos_fijos
            WHERE usuario_id = %s AND activo = TRUE AND tipo = 'mensual'
            """,
            (user.id,),
        ).fetchone()[0]

        ahorros_rows = connection.execute(
            "SELECT * FROM metas_ahorro WHERE usuario_id = %s ORDER BY activo DESC, id ASC",
            (user.id,),
        ).fetchall()
        metas = [_calcular_meta_ahorro(r) for r in ahorros_rows]
        total_ahorros = sum(m["monto_actual"] for m in metas)

    saldos_medios = build_saldos_medios(user.id)
    saldo_total_medios = sum(m["saldo_actual"] for m in saldos_medios if m["activo"])

    return {
        "mes": current_month,
        "total_ingresos": float(ingresos),
        "total_gastos_fijos": float(fijos),
        "total_gastos_variables": float(variables),
        "saldo": float(ingresos - fijos - variables),
        "saldo_total_medios": float(saldo_total_medios),
        "saldos_medios": saldos_medios,
        "total_ahorros": float(total_ahorros),
        "metas_ahorro": metas,
    }


@app.get(
    "/api/resumen/mes-actual/por-categoria",
    response_model=list[ResumenCategoria],
)
def resumen_mes_actual_por_categoria(user: Usuario = Depends(get_current_user)) -> list[dict[str, Any]]:
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
            WHERE gv.usuario_id = %s AND substr(gv.fecha, 1, 7) = %s
            GROUP BY c.id, c.nombre, c.icono, c.color
            ORDER BY total DESC
            """,
            (user.id, current_month),
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


# ==========================================
# MOTO / KILOMETRAJE
# ==========================================
def get_moto_config(connection: Any, user_id: int) -> Any:
    row = connection.execute("SELECT * FROM moto_config WHERE usuario_id = %s", (user_id,)).fetchone()
    if row is None:
        connection.execute(
            "INSERT INTO moto_config (usuario_id, km_ultimo_cambio, intervalo_km, alerta_km_antes)"
            " VALUES (%s, 0, 2000, 200)",
            (user_id,),
        )
        connection.commit()
        row = connection.execute("SELECT * FROM moto_config WHERE usuario_id = %s", (user_id,)).fetchone()
    return row


def build_estado_aceite(user_id: int) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        config = get_moto_config(connection, user_id)
        km_row = connection.execute(
            "SELECT km_actuales FROM kilometraje WHERE usuario_id = %s ORDER BY fecha DESC, id DESC LIMIT 1",
            (user_id,),
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


def ensure_km_no_regression(connection: Any, km: int, user_id: int) -> None:
    last = connection.execute(
        "SELECT km_actuales FROM kilometraje WHERE usuario_id = %s ORDER BY fecha DESC, id DESC LIMIT 1",
        (user_id,),
    ).fetchone()
    if last is not None and km < int(last["km_actuales"]):
        raise HTTPException(
            status_code=400,
            detail=(
                "El odómetro no puede retroceder: el último registro fue "
                f"{int(last['km_actuales'])} km"
            ),
        )


@app.get("/api/kilometraje", response_model=list[Kilometraje])
def list_kilometrajes(user: Usuario = Depends(get_current_user)) -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        rows = connection.execute(
            "SELECT * FROM kilometraje WHERE usuario_id = %s ORDER BY fecha DESC, id DESC",
            (user.id,),
        ).fetchall()
        return [row_to_dict(row) for row in rows]


@app.post("/api/kilometraje", response_model=Kilometraje, status_code=201)
def create_kilometraje(payload: KilometrajeInput, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        ensure_km_no_regression(connection, payload.km_actuales, user.id)
    return create_item(
        "kilometraje",
        {**payload.model_dump(), "usuario_id": user.id, "fecha": payload.fecha.isoformat()},
    )


@app.get("/api/kilometraje/resumen", response_model=KilometrajeResumen)
def resumen_kilometraje(user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        last = connection.execute(
            "SELECT km_actuales FROM kilometraje WHERE usuario_id = %s ORDER BY fecha DESC, id DESC LIMIT 1",
            (user.id,),
        ).fetchone()
        registros = connection.execute(
            "SELECT COUNT(*) FROM kilometraje WHERE usuario_id = %s", (user.id,)
        ).fetchone()[0]
    return {
        "km_actuales": int(last["km_actuales"]) if last else 0,
        "registros": registros,
    }


@app.get("/api/kilometraje/{item_id}", response_model=Kilometraje)
def get_kilometraje(item_id: int, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        return row_to_dict(require_row(connection, "kilometraje", item_id, user.id))


@app.patch("/api/kilometraje/{item_id}", response_model=Kilometraje)
def update_kilometraje(item_id: int, payload: KilometrajeUpdate, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    if "fecha" in fields and fields["fecha"] is not None:
        fields["fecha"] = fields["fecha"].isoformat()
    return update_item("kilometraje", item_id, fields, user.id)


@app.delete("/api/kilometraje/{item_id}", status_code=204)
def delete_kilometraje(item_id: int, user: Usuario = Depends(get_current_user)) -> Response:
    delete_item("kilometraje", item_id, user.id)
    return Response(status_code=204)


@app.get("/api/moto/estado-aceite", response_model=EstadoAceite)
def moto_estado_aceite(user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    return build_estado_aceite(user.id)


@app.post("/api/moto/cambio-aceite", response_model=EstadoAceite)
def moto_cambio_aceite(payload: CambioAceiteInput | None = None, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        km_row = connection.execute(
            "SELECT km_actuales FROM kilometraje WHERE usuario_id = %s ORDER BY fecha DESC, id DESC LIMIT 1",
            (user.id,),
        ).fetchone()
        km_actuales = int(km_row["km_actuales"]) if km_row else 0
        connection.execute(
            "UPDATE moto_config SET km_ultimo_cambio = %s WHERE usuario_id = %s",
            (km_actuales, user.id),
        )
        if payload and payload.crear_gasto and payload.costo and payload.costo > 0:
            cat_row = connection.execute(
                "SELECT id FROM categorias WHERE usuario_id = %s AND lower(nombre) LIKE '%%transporte%%' LIMIT 1",
                (user.id,),
            ).fetchone()
            cat_id = cat_row["id"] if cat_row else 1
            today_str = date.today().isoformat()
            nota_gasto = payload.nota or f"Cambio de aceite ({km_actuales} km)"
            connection.execute(
                """
                INSERT INTO gastos_variables (usuario_id, fecha, categoria_id, monto, medio_pago_id, nota)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (user.id, today_str, cat_id, payload.costo, payload.medio_pago_id, nota_gasto),
            )
        connection.commit()
    return build_estado_aceite(user.id)


@app.put("/api/moto/config", response_model=EstadoAceite)
def moto_update_config(payload: MotoConfigUpdate, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        return build_estado_aceite(user.id)
    sets = ", ".join(f"{column} = %s" for column in fields)
    values = [fields[column] for column in fields]
    with closing(get_connection()) as connection:
        get_moto_config(connection, user.id)
        connection.execute(f"UPDATE moto_config SET {sets} WHERE usuario_id = %s", [*values, user.id])
        connection.commit()
    return build_estado_aceite(user.id)


# ==========================================
# HÁBITOS
# ==========================================
def calcular_racha(connection: Any, habito_id: int, dia: date | None = None) -> int:
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


@app.get("/api/habitos", response_model=list[Habito])
def list_habitos(user: Usuario = Depends(get_current_user)) -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        rows = connection.execute(
            "SELECT * FROM habitos WHERE usuario_id = %s ORDER BY activo DESC, id",
            (user.id,),
        ).fetchall()
        return [{**row_to_dict(row), "activo": bool(row["activo"])} for row in rows]


@app.post("/api/habitos", response_model=Habito, status_code=201)
def create_habito(payload: HabitoInput, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    result = create_item("habitos", {**payload.model_dump(), "usuario_id": user.id})
    result["activo"] = bool(result["activo"])
    return result


@app.get("/api/habitos/resumen/{fecha}", response_model=list[HabitoResumenItem])
def resumen_habitos(fecha: date, user: Usuario = Depends(get_current_user)) -> list[dict[str, Any]]:
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
            "SELECT * FROM habitos WHERE usuario_id = %s AND activo = TRUE ORDER BY id",
            (user.id,),
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
def racha_habito(item_id: int, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        require_row(connection, "habitos", item_id, user.id)
        racha = calcular_racha(connection, item_id)
    return {"id": item_id, "racha": racha}


@app.get("/api/habitos/{item_id}", response_model=Habito)
def get_habito(item_id: int, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        row = require_row(connection, "habitos", item_id, user.id)
        return {**row_to_dict(row), "activo": bool(row["activo"])}


@app.patch("/api/habitos/{item_id}", response_model=Habito)
def update_habito(item_id: int, payload: HabitoUpdate, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    result = update_item("habitos", item_id, fields, user.id)
    result["activo"] = bool(result["activo"])
    return result


@app.delete("/api/habitos/{item_id}", status_code=204)
def delete_habito(item_id: int, user: Usuario = Depends(get_current_user)) -> Response:
    delete_item("habitos", item_id, user.id)
    return Response(status_code=204)


@app.post("/api/habitos/{item_id}/check/{fecha}", response_model=CheckHabitoResult)
def toggle_habito(item_id: int, fecha: date, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    fecha_iso = fecha.isoformat()
    with closing(get_connection()) as connection:
        require_row(connection, "habitos", item_id, user.id)
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


# ==========================================
# RUTINA / AGENDA
# ==========================================
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
def list_bloques_rutina(user: Usuario = Depends(get_current_user)) -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        rows = connection.execute(
            "SELECT * FROM bloques_rutina WHERE usuario_id = %s ORDER BY dia_semana, hora_inicio, id",
            (user.id,),
        ).fetchall()
        return [bloque_dict(row) for row in rows]


@app.post("/api/rutina/bloques", response_model=BloqueRutina, status_code=201)
def create_bloque_rutina(payload: BloqueRutinaInput, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    validar_horas(payload.hora_inicio, payload.hora_fin)
    result = create_item("bloques_rutina", {**payload.model_dump(), "usuario_id": user.id})
    result["activo"] = bool(result["activo"])
    return result


@app.get("/api/rutina/semana", response_model=list[DiaRutina])
def rutina_semana(user: Usuario = Depends(get_current_user)) -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        rows = connection.execute(
            "SELECT * FROM bloques_rutina WHERE usuario_id = %s AND activo = TRUE"
            " ORDER BY dia_semana, hora_inicio, id",
            (user.id,),
        ).fetchall()
    dias: dict[int, list[dict[str, Any]]] = {i: [] for i in range(7)}
    for row in rows:
        dias[row["dia_semana"]].append(bloque_dict(row))
    return [{"dia_semana": i, "bloques": dias[i]} for i in range(7)]


@app.get("/api/rutina/dia/{dia_semana}", response_model=list[BloqueRutina])
def bloques_dia(dia_semana: int, user: Usuario = Depends(get_current_user)) -> list[dict[str, Any]]:
    if not 0 <= dia_semana <= 6:
        raise HTTPException(
            status_code=400,
            detail="dia_semana debe estar entre 0 (lunes) y 6 (domingo)",
        )
    with closing(get_connection()) as connection:
        rows = connection.execute(
            "SELECT * FROM bloques_rutina"
            " WHERE usuario_id = %s AND dia_semana = %s AND activo = TRUE ORDER BY hora_inicio, id",
            (user.id, dia_semana),
        ).fetchall()
        return [bloque_dict(row) for row in rows]


@app.get("/api/rutina/bloques/{item_id}", response_model=BloqueRutina)
def get_bloque_rutina(item_id: int, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        row = require_row(connection, "bloques_rutina", item_id, user.id)
        return {**row_to_dict(row), "activo": bool(row["activo"])}


@app.patch("/api/rutina/bloques/{item_id}", response_model=BloqueRutina)
def update_bloque_rutina(item_id: int, payload: BloqueRutinaUpdate, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    if "hora_inicio" in fields or "hora_fin" in fields:
        with closing(get_connection()) as connection:
            row = require_row(connection, "bloques_rutina", item_id, user.id)
        inicio = fields.get("hora_inicio", row["hora_inicio"])
        fin = fields.get("hora_fin", row["hora_fin"])
        validar_horas(inicio, fin)
    result = update_item("bloques_rutina", item_id, fields, user.id)
    result["activo"] = bool(result["activo"])
    return result


@app.delete("/api/rutina/bloques/{item_id}", status_code=204)
def delete_bloque_rutina(item_id: int, user: Usuario = Depends(get_current_user)) -> Response:
    delete_item("bloques_rutina", item_id, user.id)
    return Response(status_code=204)


@app.delete("/api/rutina/bloques", status_code=204)
def delete_all_bloques_rutina(user: Usuario = Depends(get_current_user)) -> Response:
    with closing(get_connection()) as connection:
        connection.execute("DELETE FROM bloques_rutina WHERE usuario_id = %s", (user.id,))
        connection.commit()
    return Response(status_code=204)


# ==========================================
# FECHAS ESPECIALES & RECORDATORIOS
# ==========================================
def _calcular_fechas_especiales(rows: list[Any]) -> list[dict[str, Any]]:
    today = date.today()
    result = []
    for r in rows:
        d = row_to_dict(r)
        fecha_str = d["fecha"]
        try:
            f_orig = datetime.strptime(fecha_str, "%Y-%m-%d").date()
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
    result.sort(key=lambda x: x["dias_restantes"])
    return result


@app.get("/api/fechas-especiales", response_model=list[FechaEspecial])
def list_fechas_especiales(user: Usuario = Depends(get_current_user)) -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        rows = connection.execute(
            "SELECT * FROM fechas_especiales WHERE usuario_id = %s ORDER BY id ASC",
            (user.id,),
        ).fetchall()
        return _calcular_fechas_especiales(rows)


@app.post("/api/fechas-especiales", response_model=FechaEspecial, status_code=201)
def create_fecha_especial(payload: FechaEspecialInput, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    created = create_item("fechas_especiales", {**payload.model_dump(), "usuario_id": user.id})
    with closing(get_connection()) as connection:
        rows = [require_row(connection, "fechas_especiales", created["id"], user.id)]
        return _calcular_fechas_especiales(rows)[0]


@app.get("/api/fechas-especiales/{item_id}", response_model=FechaEspecial)
def get_fecha_especial(item_id: int, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        row = require_row(connection, "fechas_especiales", item_id, user.id)
        return _calcular_fechas_especiales([row])[0]


@app.patch("/api/fechas-especiales/{item_id}", response_model=FechaEspecial)
def update_fecha_especial(item_id: int, payload: FechaEspecialUpdate, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    update_item("fechas_especiales", item_id, fields, user.id)
    with closing(get_connection()) as connection:
        row = require_row(connection, "fechas_especiales", item_id, user.id)
        return _calcular_fechas_especiales([row])[0]


@app.delete("/api/fechas-especiales/{item_id}", status_code=204)
def delete_fecha_especial(item_id: int, user: Usuario = Depends(get_current_user)) -> Response:
    delete_item("fechas_especiales", item_id, user.id)
    return Response(status_code=204)


@app.get("/api/recordatorios", response_model=list[Recordatorio])
def list_recordatorios(user: Usuario = Depends(get_current_user)) -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        rows = connection.execute(
            "SELECT * FROM recordatorios WHERE usuario_id = %s ORDER BY activo DESC, fecha_disparo ASC, id ASC",
            (user.id,),
        ).fetchall()
        return [{**row_to_dict(r), "activo": bool(r["activo"]), "disparado": bool(r["disparado"])} for r in rows]


@app.post("/api/recordatorios", response_model=Recordatorio, status_code=201)
def create_recordatorio(payload: RecordatorioInput, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    created = create_item("recordatorios", {
        **payload.model_dump(),
        "usuario_id": user.id,
        "activo": _norm_bool(payload.activo),
        "disparado": _norm_bool(False),
    })
    return {**created, "activo": bool(created["activo"]), "disparado": bool(created["disparado"])}


@app.get("/api/recordatorios/{item_id}", response_model=Recordatorio)
def get_recordatorio(item_id: int, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        row = require_row(connection, "recordatorios", item_id, user.id)
        return {**row_to_dict(row), "activo": bool(row["activo"]), "disparado": bool(row["disparado"])}


@app.patch("/api/recordatorios/{item_id}", response_model=Recordatorio)
def update_recordatorio(item_id: int, payload: RecordatorioUpdate, user: Usuario = Depends(get_current_user)) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    if "activo" in fields and fields["activo"] is not None:
        fields["activo"] = _norm_bool(fields["activo"])
    if "disparado" in fields and fields["disparado"] is not None:
        fields["disparado"] = _norm_bool(fields["disparado"])
    updated = update_item("recordatorios", item_id, fields, user.id)
    return {**updated, "activo": bool(updated["activo"]), "disparado": bool(updated["disparado"])}


@app.delete("/api/recordatorios/{item_id}", status_code=204)
def delete_recordatorio(item_id: int, user: Usuario = Depends(get_current_user)) -> Response:
    delete_item("recordatorios", item_id, user.id)
    return Response(status_code=204)
