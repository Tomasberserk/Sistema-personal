import hashlib
import hmac
import os
import sys
import tempfile
import time
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch):
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    monkeypatch.setenv("DATABASE_URL", "")
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import main

    main.DB_PATH = Path(db_path)
    main.ALLOW_DEMO_SWITCH = False
    main.init_db()

    try:
        with TestClient(main.app) as test_client:
            yield test_client, main
    finally:
        if os.path.exists(db_path):
            try:
                os.remove(db_path)
            except Exception:
                pass


def _auth_headers(client, email="tomas@personal.io", password="demo"):
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def test_secret_key_has_no_insecure_default(client):
    _, main = client
    assert main.SECRET_KEY
    assert main.SECRET_KEY != "jarvis-sistema-personal-secret-key-2026"


def test_token_ttl_and_expiry(client):
    test_client, main = client
    headers = _auth_headers(test_client)
    assert test_client.get("/api/auth/me", headers=headers).status_code == 200

    old_payload = f"1:{int(time.time()) - main.TOKEN_TTL_SECONDS - 10}"
    old_signature = hmac.new(
        main.SECRET_KEY.encode(), old_payload.encode(), hashlib.sha256
    ).hexdigest()
    old_token = f"{old_payload}:{old_signature}"
    expired = test_client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {old_token}"}
    )
    assert expired.status_code == 401

    future_payload = f"1:{int(time.time()) + 120}"
    future_signature = hmac.new(
        main.SECRET_KEY.encode(), future_payload.encode(), hashlib.sha256
    ).hexdigest()
    future_token = f"{future_payload}:{future_signature}"
    future = test_client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {future_token}"}
    )
    assert future.status_code == 401


def test_login_demo_bypass_removed(client):
    test_client, _ = client
    email = f"bypass-{uuid.uuid4().hex[:8]}@test.local"

    registered = test_client.post(
        "/api/auth/register",
        json={
            "nombre": "Bypass Test",
            "email": email,
            "password": "real-pass-123",
            "avatar": "🚀",
        },
    )
    assert registered.status_code == 200, registered.text

    bypass = test_client.post(
        "/api/auth/login", json={"email": email, "password": "demo"}
    )
    assert bypass.status_code == 400

    real = test_client.post(
        "/api/auth/login", json={"email": email, "password": "real-pass-123"}
    )
    assert real.status_code == 200


def test_demo_switch_disabled_by_default(client):
    test_client, main = client

    assert test_client.get("/api/auth/demo-users").status_code == 403
    assert (
        test_client.post("/api/auth/switch-demo", json={"user_id": 1}).status_code
        == 403
    )

    main.ALLOW_DEMO_SWITCH = True
    try:
        assert test_client.get("/api/auth/demo-users").status_code == 200
        assert (
            test_client.post("/api/auth/switch-demo", json={"user_id": 1}).status_code
            == 200
        )
    finally:
        main.ALLOW_DEMO_SWITCH = False


def test_cors_rejects_unknown_origin(client):
    test_client, _ = client

    allowed = test_client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:5173"

    denied = test_client.options(
        "/api/health",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert denied.headers.get("access-control-allow-origin") is None


def test_global_exception_handler_hides_details(client):
    _, main = client

    @main.app.get("/__test__/boom")
    def _boom():
        raise RuntimeError("super-secret-internal-detail")

    with TestClient(main.app, raise_server_exceptions=False) as raw_client:
        response = raw_client.get("/__test__/boom")

    assert response.status_code == 500
    assert response.json() == {"detail": "Error interno del servidor"}
    assert "super-secret-internal-detail" not in response.text
