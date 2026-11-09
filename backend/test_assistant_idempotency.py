"""Tests del Tool Executor BFF y de idempotencia transaccional (Fase 21.1)."""

import os
import sys
import tempfile
import uuid
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


def _headers(client: TestClient, idempotency_key: str | None = None) -> dict[str, str]:
    login = client.post(
        "/api/auth/login",
        json={"email": "tomas@personal.io", "password": "demo"},
    )
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['token']}"}
    if idempotency_key:
        headers["X-Idempotency-Key"] = idempotency_key
    return headers


def test_execute_tool_idempotency_flow(client: TestClient):
    key = str(uuid.uuid4())
    headers = _headers(client, key)

    payload = {
        "tool_name": "crear_gasto_variable",
        "parameters": {
            "monto": 35000.0,
            "categoria": "Comida & Alimentación",
            "nota": "Almuerzo con Nequi",
            "medio_pago": "Nequi",
        },
    }

    # 1. Primer envío: debe ejecutarse y retornar COMMITTED
    resp1 = client.post("/api/v1/assistant/tools/execute", json=payload, headers=headers)
    assert resp1.status_code == 200, resp1.text
    data1 = resp1.json()
    assert data1["status"] == "COMMITTED"
    assert data1["tool_name"] == "crear_gasto_variable"
    assert data1["idempotency_key"] == key
    assert data1["cached"] is False
    assert data1["result"]["monto"] == 35000.0

    # Verificar que solo hay 1 gasto en la base de datos
    gastos = client.get("/api/gastos-variables", headers=headers).json()
    assert len(gastos) == 1
    assert gastos[0]["monto"] == 35000.0

    # 2. Reintento con la misma clave y mismos parámetros: debe devolver en caché (200 OK)
    resp2 = client.post("/api/v1/assistant/tools/execute", json=payload, headers=headers)
    assert resp2.status_code == 200, resp2.text
    data2 = resp2.json()
    assert data2["status"] == "COMMITTED"
    assert data2["cached"] is True
    assert data2["idempotency_key"] == key
    assert data2["result"]["id"] == data1["result"]["id"]

    # Verificar que NO se duplicó el gasto en la base
    gastos_despues = client.get("/api/gastos-variables", headers=headers).json()
    assert len(gastos_despues) == 1

    # 3. Reintento con la misma clave pero parámetros diferentes: debe retornar 409 Conflict
    payload_diferente = {
        "tool_name": "crear_gasto_variable",
        "parameters": {
            "monto": 99000.0,
            "categoria": "Comida & Alimentación",
            "nota": "Intento colisionado",
        },
    }
    resp3 = client.post("/api/v1/assistant/tools/execute", json=payload_diferente, headers=headers)
    assert resp3.status_code == 409
    assert "IDEMPOTENCY_KEY_COLLISION" in resp3.text


def test_flexible_aliases_valor_descripcion(client: TestClient):
    key = str(uuid.uuid4())
    headers = _headers(client, key)

    payload = {
        "tool_name": "crear_gasto_variable",
        "parameters": {
            "valor": 12000.0,  # alias de monto
            "categoria": "Transporte & Movilidad",
            "descripcion": "Gasolina moto",  # alias de nota
            "medio_pago": "Nequi",
        },
    }

    resp = client.post("/api/v1/assistant/tools/execute", json=payload, headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "COMMITTED"
    assert data["result"]["monto"] == 12000.0


def test_record_learning_tool(client: TestClient):
    key = str(uuid.uuid4())
    headers = _headers(client, key)

    payload = {
        "tool_name": "record_learning",
        "parameters": {
            "categoria": "preferencias",
            "contenido": "El usuario prefiere pagar la gasolina siempre con Nequi",
        },
    }

    resp = client.post("/api/v1/assistant/tools/execute", json=payload, headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "COMMITTED"
    assert "preferencias" in data["result"]["categoria"]
    assert data["result"]["id"] is not None


def test_live_session_provisioning(client: TestClient):
    headers = _headers(client)

    resp = client.get("/api/v1/live/session", headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "ephemeral_token" in data
    assert data["model"] == "models/gemini-3.8-live"
    assert data["session_resumption_allowed"] is True
    assert "generativelanguage.googleapis.com" in data["ws_url"]
