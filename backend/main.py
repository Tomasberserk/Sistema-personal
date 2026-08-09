from __future__ import annotations

import sqlite3
from contextlib import closing
from datetime import date, datetime
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
    return create_item(
        "kilometraje",
        {**payload.model_dump(), "fecha": payload.fecha.isoformat()},
    )


@app.get("/api/kilometraje/{item_id}", response_model=Kilometraje)
def get_kilometraje(item_id: int) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        return row_to_dict(require_row(connection, "kilometraje", item_id))


@app.patch("/api/kilometraje/{item_id}", response_model=Kilometraje)
def update_kilometraje(item_id: int, payload: KilometrajeUpdate) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    if "fecha" in fields and fields["fecha"] is not None:
        fields["fecha"] = fields["fecha"].isoformat()
    return update_item("kilometraje", item_id, fields)


@app.delete("/api/kilometraje/{item_id}", status_code=204)
def delete_kilometraje(item_id: int) -> Response:
    delete_item("kilometraje", item_id)
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