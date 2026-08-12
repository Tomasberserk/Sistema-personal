from __future__ import annotations

import sqlite3
from contextlib import closing
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field


ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "jarvis.sqlite3"

Fuente = Literal["Didi", "papa", "amigo", "otro"]
TipoGastoFijo = Literal["mensual", "por_kilometraje"]

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

DIAS_SEMANA = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]

DEFAULT_BLOQUES = [
    *[
        (d, "05:00", "06:00", "Paseo y carrera", "", "#5d8ae8", "🐕")
        for d in range(7)
    ],
    *[
        (d, "07:00", "07:30", "Desayuno", "", "#e8a85d", "🍳")
        for d in range(7)
    ],
    *[
        (d, "08:30", "11:00", "Gym", "", "#e85d4a", "💪")
        for d in (0, 1, 3, 4)
    ],
    *[
        (d, "11:00", "12:00", "SENA/Didi", "", "#a85de8", "📚")
        for d in range(5)
    ],
    *[
        (d, "12:00", "13:00", "Almuerzo", "", "#5de87a", "🍽️")
        for d in range(7)
    ],
    *[
        (d, "13:30", "17:00", "Tiempo libre", "", "#e8d95d", "🕐")
        for d in range(5)
    ],
    *[
        (d, "17:00", "17:30", "Preparación SENA", "", "#5dc4e8", "🛁")
        for d in range(5)
    ],
    *[
        (d, "18:00", "23:30", "SENA", "", "#e85d8a", "🏫")
        for d in range(5)
    ],
]


class IngresoInput(BaseModel):
    fecha: date
    fuente: Fuente
    monto: float = Field(ge=0)
    nota: str = ""


class IngresoUpdate(BaseModel):
    fecha: date | None = None
    fuente: Fuente | None = None
    monto: float | None = Field(default=None, ge=0)
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
    nota: str = ""


class GastoVariableUpdate(BaseModel):
    fecha: date | None = None
    categoria_id: int | None = Field(default=None, ge=1)
    monto: float | None = Field(default=None, ge=0)
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
    icono: str = "⏰"
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


class ResumenCategoria(BaseModel):
    id: int
    nombre: str
    icono: str
    color: str
    cantidad: int
    total: float
    porcentaje: float


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


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db() -> None:
    with closing(get_connection()) as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS categorias (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL UNIQUE,
                icono TEXT NOT NULL DEFAULT '🏷️',
                color TEXT NOT NULL DEFAULT '#333333',
                activa INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1))
            );
            CREATE TABLE IF NOT EXISTS ingresos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fecha TEXT NOT NULL,
                fuente TEXT NOT NULL CHECK (fuente IN ('Didi', 'papa', 'amigo', 'otro')),
                monto REAL NOT NULL CHECK (monto >= 0),
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
            """
        )
        connection.executemany(
            """
            INSERT OR IGNORE INTO categorias (nombre, icono, color, activa)
            VALUES (?, ?, ?, 1)
            """,
            DEFAULT_CATEGORIAS,
        )
        columns = [
            row["name"]
            for row in connection.execute("PRAGMA table_info(gastos_variables)").fetchall()
        ]
        if "categoria" in columns and "categoria_id" not in columns:
            connection.execute("ALTER TABLE gastos_variables RENAME TO gastos_variables_old")
            connection.execute(
                """
                CREATE TABLE gastos_variables (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    fecha TEXT NOT NULL,
                    categoria_id INTEGER NOT NULL REFERENCES categorias(id),
                    monto REAL NOT NULL CHECK (monto >= 0),
                    nota TEXT NOT NULL DEFAULT ''
                )
                """
            )
            connection.execute(
                """
                INSERT INTO categorias (nombre, icono, color, activa)
                SELECT DISTINCT o.categoria, '🏷️', '#dddddd', 1
                FROM gastos_variables_old o
                WHERE trim(o.categoria) <> ''
                AND NOT EXISTS (
                    SELECT 1 FROM categorias c WHERE lower(c.nombre) = lower(trim(o.categoria))
                )
                """
            )
            connection.execute(
                """
                INSERT INTO gastos_variables (id, fecha, categoria_id, monto, nota)
                SELECT o.id,
                       o.fecha,
                       COALESCE(
                           (SELECT c.id FROM categorias c
                            WHERE lower(c.nombre) = lower(trim(o.categoria))),
                           (SELECT MIN(id) FROM categorias)
                       ),
                       o.monto,
                       COALESCE(o.nota, '')
                FROM gastos_variables_old o
                """
            )
            connection.execute("DROP TABLE gastos_variables_old")
        existing = connection.execute("SELECT COUNT(*) FROM gastos_fijos").fetchone()[0]
        if existing == 0:
            connection.executemany(
                """
                INSERT INTO gastos_fijos (nombre, monto, tipo, activo)
                VALUES (?, ?, ?, ?)
                """,
                [
                    ("Cuota moto", 390000, "mensual", 1),
                    ("Aceite moto", 60000, "por_kilometraje", 1),
                    ("Plan Claro", 45000, "mensual", 1),
                ],
            )
        connection.execute(
            """
            INSERT OR IGNORE INTO moto_config (id, km_ultimo_cambio, intervalo_km, alerta_km_antes)
            VALUES (1, 0, 2000, 200)
            """
        )
        bloque_count = connection.execute(
            "SELECT COUNT(*) AS n FROM bloques_rutina"
        ).fetchone()["n"]
        if bloque_count == 0:
            connection.executemany(
                """
                INSERT INTO bloques_rutina
                    (dia_semana, hora_inicio, hora_fin, titulo, descripcion, color, icono, activo)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
                """,
                DEFAULT_BLOQUES,
            )
        connection.commit()


def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


def require_row(connection: sqlite3.Connection, table: str, item_id: int) -> sqlite3.Row:
    allowed_tables = {
        "ingresos",
        "gastos_fijos",
        "gastos_variables",
        "kilometraje",
        "categorias",
        "habitos",
        "registro_habitos",
        "bloques_rutina",
    }
    if table not in allowed_tables:
        raise ValueError("Tabla no permitida")
    row = connection.execute(
        f"SELECT * FROM {table} WHERE id = ?",  # table is selected from a fixed allowlist
        (item_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Recurso no encontrado")
    return row


def require_categoria(connection: sqlite3.Connection, categoria_id: int) -> None:
    exists = connection.execute(
        "SELECT 1 FROM categorias WHERE id = ?", (categoria_id,)
    ).fetchone()
    if exists is None:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")


def create_item(table: str, fields: dict[str, Any]) -> dict[str, Any]:
    columns = list(fields)
    values = [fields[column] for column in columns]
    placeholders = ", ".join("?" for _ in columns)
    with closing(get_connection()) as connection:
        cursor = connection.execute(
            f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders})",
            values,
        )
        connection.commit()
        return row_to_dict(require_row(connection, table, cursor.lastrowid))


def update_item(table: str, item_id: int, fields: dict[str, Any]) -> dict[str, Any]:
    if not fields:
        with closing(get_connection()) as connection:
            return row_to_dict(require_row(connection, table, item_id))
    columns = list(fields)
    assignments = ", ".join(f"{column} = ?" for column in columns)
    values = [fields[column] for column in columns]
    with closing(get_connection()) as connection:
        require_row(connection, table, item_id)
        connection.execute(
            f"UPDATE {table} SET {assignments} WHERE id = ?",
            [*values, item_id],
        )
        connection.commit()
        return row_to_dict(require_row(connection, table, item_id))


def delete_item(table: str, item_id: int) -> None:
    with closing(get_connection()) as connection:
        require_row(connection, table, item_id)
        connection.execute(f"DELETE FROM {table} WHERE id = ?", (item_id,))
        connection.commit()


def get_moto_config(connection: sqlite3.Connection) -> sqlite3.Row:
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


def ensure_km_no_regression(connection: sqlite3.Connection, km: int) -> None:
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
    connection: sqlite3.Connection, item_id: int, fecha: str
) -> sqlite3.Row | None:
    return connection.execute(
        """
        SELECT km_actuales FROM kilometraje
        WHERE fecha < ? OR (fecha = ? AND id < ?)
        ORDER BY fecha DESC, id DESC
        LIMIT 1
        """,
        (fecha, fecha, item_id),
    ).fetchone()


def next_kilometraje(
    connection: sqlite3.Connection, item_id: int, fecha: str
) -> sqlite3.Row | None:
    return connection.execute(
        """
        SELECT km_actuales FROM kilometraje
        WHERE fecha > ? OR (fecha = ? AND id > ?)
        ORDER BY fecha ASC, id ASC
        LIMIT 1
        """,
        (fecha, fecha, item_id),
    ).fetchone()


def calcular_racha(
    connection: sqlite3.Connection, habito_id: int, dia: date | None = None
) -> int:
    if dia is None:
        dia = date.today()
    racha = 0
    while True:
        hecho = connection.execute(
            """
            SELECT 1 FROM registro_habitos
            WHERE habito_id = ? AND fecha = ? AND completado = 1
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
    description="API de gestión financiera personal de Jarvis.",
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
def healthz() -> dict[str, str]:
    return {"status": "ok"}


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
    result = create_item("gastos_fijos", {**payload.model_dump(), "activo": int(payload.activo)})
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
        fields["activo"] = int(fields["activo"])
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
            "categorias", {**payload.model_dump(), "activa": int(payload.activa)}
        )
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Ya existe una categoría con ese nombre")
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
        fields["activa"] = int(fields["activa"])
    try:
        result = update_item("categorias", item_id, fields)
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Ya existe una categoría con ese nombre")
    result["activa"] = bool(result["activa"])
    return result


@app.delete("/api/categorias/{item_id}", status_code=204)
def delete_categoria(item_id: int) -> Response:
    try:
        delete_item("categorias", item_id)
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar la categoría: tiene gastos asociados",
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
                        "El odómetro no puede retroceder: el registro anterior fue "
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
def moto_cambio_aceite() -> dict[str, Any]:
    with closing(get_connection()) as connection:
        km_row = connection.execute(
            "SELECT km_actuales FROM kilometraje ORDER BY fecha DESC, id DESC LIMIT 1"
        ).fetchone()
        km_actuales = int(km_row["km_actuales"]) if km_row else 0
        connection.execute(
            "UPDATE moto_config SET km_ultimo_cambio = ? WHERE id = 1",
            (km_actuales,),
        )
        connection.commit()
    return build_estado_aceite()


@app.put("/api/moto/config", response_model=EstadoAceite)
def moto_update_config(payload: MotoConfigUpdate) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        return build_estado_aceite()
    sets = ", ".join(f"{column} = ?" for column in fields)
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
        result = create_item(
            "habitos",
            {**payload.model_dump(), "activo": int(payload.activo)},
        )
    except sqlite3.IntegrityError:
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
                "SELECT habito_id, completado FROM registro_habitos WHERE fecha = ?",
                (fecha_iso,),
            ).fetchall()
        }
        habits = connection.execute(
            "SELECT * FROM habitos WHERE activo = 1 ORDER BY id"
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
    if fields.get("activo") is not None:
        fields["activo"] = int(fields["activo"])
    if not fields:
        with closing(get_connection()) as connection:
            row = require_row(connection, "habitos", item_id)
        return {**row_to_dict(row), "activo": bool(row["activo"])}
    try:
        result = update_item("habitos", item_id, fields)
    except sqlite3.IntegrityError:
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
            "SELECT id FROM registro_habitos WHERE habito_id = ? AND fecha = ?",
            (item_id, fecha_iso),
        ).fetchone()
        if existing is not None:
            connection.execute("DELETE FROM registro_habitos WHERE id = ?", (existing["id"],))
            completado = False
        else:
            connection.execute(
                "INSERT INTO registro_habitos (habito_id, fecha, completado) VALUES (?, ?, 1)",
                (item_id, fecha_iso),
            )
            completado = True
        connection.commit()
    return {"habito_id": item_id, "fecha": fecha_iso, "completado": completado}


def bloque_dict(row: sqlite3.Row) -> dict[str, Any]:
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
    result = create_item(
        "bloques_rutina",
        {**payload.model_dump(), "activo": int(payload.activo)},
    )
    result["activo"] = bool(result["activo"])
    return result


@app.get("/api/rutina/semana", response_model=list[DiaRutina])
def rutina_semana() -> list[dict[str, Any]]:
    with closing(get_connection()) as connection:
        rows = connection.execute(
            "SELECT * FROM bloques_rutina WHERE activo = 1"
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
            " WHERE dia_semana = ? AND activo = 1 ORDER BY hora_inicio, id",
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
    if fields.get("activo") is not None:
        fields["activo"] = int(fields["activo"])
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


@app.get("/api/resumen/mes-actual", response_model=ResumenMensual)
def resumen_mes_actual() -> dict[str, Any]:
    current_month = datetime.now().strftime("%Y-%m")
    with closing(get_connection()) as connection:
        ingresos = connection.execute(
            "SELECT COALESCE(SUM(monto), 0) FROM ingresos WHERE substr(fecha, 1, 7) = ?",
            (current_month,),
        ).fetchone()[0]
        variables = connection.execute(
            """
            SELECT COALESCE(SUM(monto), 0)
            FROM gastos_variables
            WHERE substr(fecha, 1, 7) = ?
            """,
            (current_month,),
        ).fetchone()[0]
        fijos = connection.execute(
            """
            SELECT COALESCE(SUM(monto), 0)
            FROM gastos_fijos
            WHERE activo = 1 AND tipo = 'mensual'
            """
        ).fetchone()[0]
    return {
        "mes": current_month,
        "total_ingresos": float(ingresos),
        "total_gastos_fijos": float(fijos),
        "total_gastos_variables": float(variables),
        "saldo": float(ingresos - fijos - variables),
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
            WHERE substr(gv.fecha, 1, 7) = ?
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