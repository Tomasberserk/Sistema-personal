"""Tests del asistente de voz con el proveedor mock (sin red ni API key)."""

import os
import sys
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch):
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("ASSISTANT_PROVIDER", "mock")
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    import main

    main.DB_PATH = Path(db_path)
    main.init_db()

    with TestClient(main.app) as test_client:
        yield test_client

    try:
        os.unlink(db_path)
    except OSError:
        pass


def _headers(client: TestClient) -> dict[str, str]:
    login = client.post(
        "/api/auth/login",
        json={"email": "tomas@personal.io", "password": "demo"},
    )
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['token']}"}


def _chat(client: TestClient, headers: dict[str, str], message: str, session_id: str | None = None):
    payload = {"message": message}
    if session_id:
        payload["session_id"] = session_id
    response = client.post("/api/assistant/chat", json=payload, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def test_catalogo_de_acciones(client):
    headers = _headers(client)
    response = client.get("/api/assistant/tools", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["provider"] == "mock"
    nombres = {tool["name"] for tool in data["tools"]}
    assert {
        "crear_gasto_variable",
        "crear_ingreso",
        "crear_ahorro",
        "marcar_habito",
        "consultar_rutina",
        "registrar_kilometraje",
        "eliminar_registro",
    } <= nombres
    destructivas = {tool["name"] for tool in data["tools"] if tool["destructive"]}
    assert {"eliminar_registro", "transferir_entre_medios", "retirar_ahorro"} <= destructivas


def test_registro_por_voz_y_resumen(client):
    headers = _headers(client)

    creado = _chat(client, headers, "gasté 25.000 en comida con nequi")
    assert creado["provider"] == "mock"
    assert creado["pending_confirmation"] is None
    assert creado["executed"][0]["tool"] == "crear_gasto_variable"
    assert creado["executed"][0]["estado"] == "ok"
    assert "Registré un gasto" in creado["reply"]

    gastos = client.get("/api/gastos-variables", headers=headers).json()
    assert len(gastos) == 1
    assert gastos[0]["monto"] == 25000.0

    ingreso = _chat(client, headers, "recibí 100000 por salario en nequi")
    assert ingreso["executed"][0]["tool"] == "crear_ingreso"
    assert ingreso["executed"][0]["estado"] == "ok"
    assert "Registré un ingreso de $100.000" in ingreso["reply"]

    resumen = _chat(client, headers, "¿cómo voy este mes?", creado["session_id"])
    assert resumen["executed"][0]["tool"] == "resumen_mes_actual"
    assert "saldo" in resumen["reply"].lower()
    assert resumen["session_id"] == creado["session_id"]


def test_error_de_categoria_es_explicado(client):
    headers = _headers(client)
    respuesta = _chat(client, headers, "gasté 12000 en una categoria que no existe")
    assert respuesta["executed"][0]["estado"] == "error"
    assert "No encontré" in respuesta["reply"] or "No pude" in respuesta["reply"]

    gastos = client.get("/api/gastos-variables", headers=headers).json()
    assert gastos == []


def test_confirmacion_de_accion_destructiva(client):
    headers = _headers(client)

    creado = _chat(client, headers, "gasté 8000 en transporte con efectivo")
    session_id = creado["session_id"]
    gasto_id = creado["executed"][0]["datos"]["id"]

    intento = _chat(client, headers, f"elimina el gasto id {gasto_id}", session_id)
    assert intento["executed"] == []
    assert intento["pending_confirmation"] is not None
    assert intento["pending_confirmation"]["tool"] == "eliminar_registro"
    assert "¿Confirmas?" in intento["reply"]

    # Mientras no se confirme, el registro sigue existiendo.
    assert len(client.get("/api/gastos-variables", headers=headers).json()) == 1

    cancelado = client.post(
        "/api/assistant/confirm",
        json={
            "session_id": session_id,
            "confirmation_id": intento["pending_confirmation"]["id"],
            "accept": False,
        },
        headers=headers,
    )
    assert cancelado.status_code == 200, cancelado.text
    assert "Cancelado" in cancelado.json()["reply"]
    assert len(client.get("/api/gastos-variables", headers=headers).json()) == 1

    segundo = _chat(client, headers, f"elimina el gasto id {gasto_id}", session_id)
    aceptado = client.post(
        "/api/assistant/confirm",
        json={
            "session_id": session_id,
            "confirmation_id": segundo["pending_confirmation"]["id"],
            "accept": True,
        },
        headers=headers,
    )
    assert aceptado.status_code == 200, aceptado.text
    body = aceptado.json()
    assert body["executed"][0]["tool"] == "eliminar_registro"
    assert body["executed"][0]["estado"] == "ok"
    assert client.get("/api/gastos-variables", headers=headers).json() == []


def test_confirmacion_con_sesion_incorrecta_no_ejecuta(client):
    headers = _headers(client)
    creado = _chat(client, headers, "gasté 5000 en comida")
    gasto_id = creado["executed"][0]["datos"]["id"]
    intento = _chat(client, headers, f"elimina el gasto id {gasto_id}", creado["session_id"])

    respuesta = client.post(
        "/api/assistant/confirm",
        json={
            "session_id": "otra-sesion",
            "confirmation_id": intento["pending_confirmation"]["id"],
            "accept": True,
        },
        headers=headers,
    )
    assert respuesta.status_code == 200, respuesta.text
    assert "No pude validar" in respuesta.json()["reply"]
    assert len(client.get("/api/gastos-variables", headers=headers).json()) == 1


def test_habito_y_rutina_por_voz(client):
    headers = _headers(client)
    habito = client.post(
        "/api/habitos",
        json={"nombre": "Gimnasio", "icono": "🏋️", "color": "#5de8c4", "activo": True},
        headers=headers,
    )
    assert habito.status_code == 201, habito.text

    marcado = _chat(client, headers, "marca el hábito gimnasio")
    assert marcado["executed"][0]["tool"] == "marcar_habito"
    assert "completado" in marcado["reply"].lower()

    resumen = client.get(f"/api/habitos/resumen/{__import__('datetime').date.today().isoformat()}", headers=headers)
    assert resumen.status_code == 200
    assert resumen.json()[0]["completado"] is True

    rutina = _chat(client, headers, "¿cuál es mi rutina de hoy?")
    assert rutina["executed"][0]["tool"] == "consultar_rutina"


def test_autenticacion_requerida(client):
    assert client.post("/api/assistant/chat", json={"message": "hola"}).status_code == 401
