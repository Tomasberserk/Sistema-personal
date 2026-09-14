import os
import sys
import tempfile
import sqlite3
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

@pytest.fixture(scope="module")
def client_fixture():
    # 1. Crear una base de datos temporal con el schema ANTIGUO de SQLite
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    con = sqlite3.connect(db_path)
    con.execute("""
        CREATE TABLE usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            avatar TEXT NOT NULL DEFAULT '🚀',
            rol TEXT NOT NULL DEFAULT 'usuario',
            creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );
    """)
    con.execute("""
        CREATE TABLE recordatorios (
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
    """)
    # Insertar un registro histórico antiguo
    con.execute("""
        INSERT INTO recordatorios (id, usuario_id, titulo, descripcion, tipo, fecha_disparo, canal, activo, disparado)
        VALUES (1, 1, 'Recordatorio Histórico Antiguo', 'Creado antes de la migración', 'puntual', '2026-09-20T10:00', 'todos', 1, 0);
    """)
    con.commit()
    con.close()

    # 2. Configurar la app para usar esta base de datos y ejecutar migración init_db()
    os.environ["DATABASE_URL"] = ""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import main
    main.DB_PATH = Path(db_path)
    main.init_db()

    with TestClient(main.app) as client:
        # Autenticación como usuario Tomás (generado automáticamente por init_db)
        login_resp = client.post("/api/auth/login", json={"email": "tomas@personal.io", "password": "demo"})
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        yield client, headers, db_path

    if os.path.exists(db_path):
        try:
            os.remove(db_path)
        except Exception:
            pass


def test_01_migration_preserves_schema_and_legacy_data(client_fixture):
    _, _, db_path = client_fixture
    con = sqlite3.connect(db_path)
    sql_schema = con.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='recordatorios'").fetchone()[0]
    assert "suave" in sql_schema, "El schema migrado debe contener 'suave'"
    hist_row = con.execute("SELECT titulo, canal FROM recordatorios WHERE id=1").fetchone()
    assert hist_row is not None, "El registro histórico debe persistir"
    assert hist_row[0] == "Recordatorio Histórico Antiguo"
    assert hist_row[1] == "todos"
    con.close()


def test_02_crear_canal_suave(client_fixture):
    client, headers, _ = client_fixture
    resp = client.post("/api/recordatorios", json={
        "titulo": "Alarma Suave",
        "fecha_disparo": "2026-09-15T08:00",
        "canal": "suave"
    }, headers=headers)
    assert resp.status_code == 201, f"Error caso suave: {resp.text}"
    assert resp.json()["canal"] == "suave"


def test_03_crear_canal_notificacion(client_fixture):
    client, headers, _ = client_fixture
    resp = client.post("/api/recordatorios", json={
        "titulo": "Aviso Estándar",
        "fecha_disparo": "2026-09-15T09:00",
        "canal": "notificacion"
    }, headers=headers)
    assert resp.status_code == 201, f"Error caso notificacion: {resp.text}"
    assert resp.json()["canal"] == "notificacion"


def test_04_crear_canal_persistente(client_fixture):
    client, headers, _ = client_fixture
    resp = client.post("/api/recordatorios", json={
        "titulo": "Alarma Persistente",
        "fecha_disparo": "2026-09-15T10:00",
        "canal": "persistente"
    }, headers=headers)
    assert resp.status_code == 201, f"Error caso persistente: {resp.text}"
    assert resp.json()["canal"] == "persistente"


def test_05_crear_canal_retro_todos(client_fixture):
    client, headers, _ = client_fixture
    resp = client.post("/api/recordatorios", json={
        "titulo": "Aviso Retro Todos",
        "fecha_disparo": "2026-09-15T11:00",
        "canal": "todos"
    }, headers=headers)
    assert resp.status_code == 201, f"Error caso todos: {resp.text}"
    assert resp.json()["canal"] == "todos"


def test_06_crear_canal_retro_push(client_fixture):
    client, headers, _ = client_fixture
    resp = client.post("/api/recordatorios", json={
        "titulo": "Aviso Retro Push",
        "fecha_disparo": "2026-09-15T12:00",
        "canal": "push"
    }, headers=headers)
    assert resp.status_code == 201, f"Error caso push: {resp.text}"
    assert resp.json()["canal"] == "push"


def test_07_crear_canal_retro_in_app(client_fixture):
    client, headers, _ = client_fixture
    resp = client.post("/api/recordatorios", json={
        "titulo": "Aviso Retro In-App",
        "fecha_disparo": "2026-09-15T13:00",
        "canal": "in_app"
    }, headers=headers)
    assert resp.status_code == 201, f"Error caso in_app: {resp.text}"
    assert resp.json()["canal"] == "in_app"


def test_08_crear_canal_default_omitted(client_fixture):
    client, headers, _ = client_fixture
    resp = client.post("/api/recordatorios", json={
        "titulo": "Aviso Sin Canal Explícito",
        "fecha_disparo": "2026-09-15T14:00"
    }, headers=headers)
    assert resp.status_code == 201, f"Error caso default: {resp.text}"
    assert resp.json()["canal"] == "notificacion"


def test_09_rechazo_canal_invalido_422(client_fixture):
    client, headers, _ = client_fixture
    resp = client.post("/api/recordatorios", json={
        "titulo": "Canal Inválido",
        "fecha_disparo": "2026-09-15T15:00",
        "canal": "invalido_xyz"
    }, headers=headers)
    assert resp.status_code == 422, f"Esperaba 422 pero obtuve {resp.status_code}: {resp.text}"
    assert resp.status_code != 500, "JAMÁS debe devolver 500 en canal inválido"


def test_10_listar_recordatorios_canales_mixtos(client_fixture):
    client, headers, _ = client_fixture
    resp = client.get("/api/recordatorios", headers=headers)
    assert resp.status_code == 200
    items = resp.json()
    canales = {item["canal"] for item in items}
    assert "todos" in canales, "Debe incluir registros con canal antiguo todos"
    assert "suave" in canales, "Debe incluir registros con canal nuevo suave"
    assert "notificacion" in canales, "Debe incluir registros con canal notificacion"
    assert "persistente" in canales, "Debe incluir registros con canal persistente"
    assert "push" in canales
    assert "in_app" in canales


def test_11_patch_cambio_canal_y_rechazo_invalido(client_fixture):
    client, headers, _ = client_fixture
    # Crear un recordatorio inicial
    create_resp = client.post("/api/recordatorios", json={
        "titulo": "Recordatorio para patch",
        "fecha_disparo": "2026-09-15T16:00",
        "canal": "suave"
    }, headers=headers)
    rec_id = create_resp.json()["id"]

    # PATCH a persistente -> 200
    patch_resp = client.patch(f"/api/recordatorios/{rec_id}", json={"canal": "persistente"}, headers=headers)
    assert patch_resp.status_code == 200
    assert patch_resp.json()["canal"] == "persistente"

    # PATCH de vuelta a modo antiguo 'todos' -> 200
    patch_retro = client.patch(f"/api/recordatorios/{rec_id}", json={"canal": "todos"}, headers=headers)
    assert patch_retro.status_code == 200
    assert patch_retro.json()["canal"] == "todos"

    # PATCH con canal inválido -> 422 (nunca 500)
    patch_inv = client.patch(f"/api/recordatorios/{rec_id}", json={"canal": "invalido_xyz"}, headers=headers)
    assert patch_inv.status_code == 422
    assert patch_inv.status_code != 500


def test_12_put_endpoint_inexistente_405(client_fixture):
    client, headers, _ = client_fixture
    # Verificar que PUT /api/recordatorios/{id} NO existe y devuelve 405 Method Not Allowed
    put_resp = client.put("/api/recordatorios/1", json={"titulo": "Test PUT"}, headers=headers)
    assert put_resp.status_code == 405, f"Esperaba 405 Method Not Allowed para PUT pero obtuve {put_resp.status_code}"
