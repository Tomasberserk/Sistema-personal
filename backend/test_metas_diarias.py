import os
import sys
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    os.environ["DATABASE_URL"] = ""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import main

    main.DB_PATH = Path(db_path)
    main.init_db()

    try:
        with TestClient(main.app) as test_client:
            yield test_client
    finally:
        if os.path.exists(db_path):
            try:
                os.remove(db_path)
            except Exception:
                pass


def _auth_headers(client, email="tomas@personal.io"):
    response = client.post("/api/auth/login", json={"email": email, "password": "demo"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['token']}"}


def test_metas_diarias_requiere_autenticacion(client):
    assert client.get("/api/metas-diarias").status_code == 401
    assert client.get("/api/metas-diarias/widget").status_code == 401


def test_metas_diarias_crud_y_orden(client):
    headers = _auth_headers(client)
    fecha = "2026-10-20"

    assert client.get(f"/api/metas-diarias?fecha={fecha}", headers=headers).json() == []

    base = {"fecha": fecha, "descripcion": "detalle"}
    media = client.post("/api/metas-diarias", json={**base, "titulo": "Media", "prioridad": "media"}, headers=headers)
    alta = client.post("/api/metas-diarias", json={**base, "titulo": "Alta", "prioridad": "alta"}, headers=headers)
    baja = client.post("/api/metas-diarias", json={**base, "titulo": "Baja", "prioridad": "baja"}, headers=headers)

    assert media.status_code == 201
    assert alta.status_code == 201
    assert baja.status_code == 201
    assert media.json()["completada"] is False

    listado = client.get(f"/api/metas-diarias?fecha={fecha}", headers=headers).json()
    assert [m["titulo"] for m in listado] == ["Alta", "Media", "Baja"]

    # Toggle y orden: las completadas van al final
    toggled = client.post(f"/api/metas-diarias/{alta.json()['id']}/toggle", headers=headers)
    assert toggled.status_code == 200
    assert toggled.json()["completada"] is True
    assert toggled.json()["completado_en"] is not None

    listado = client.get(f"/api/metas-diarias?fecha={fecha}", headers=headers).json()
    assert [m["titulo"] for m in listado] == ["Media", "Baja", "Alta"]

    # Edición
    editada = client.patch(
        f"/api/metas-diarias/{baja.json()['id']}",
        json={"titulo": "Baja editada", "hora": "18:30", "prioridad": "alta"},
        headers=headers,
    )
    assert editada.status_code == 200
    assert editada.json()["titulo"] == "Baja editada"
    assert editada.json()["hora"] == "18:30"

    # Limpiar hora con null
    sin_hora = client.patch(f"/api/metas-diarias/{baja.json()['id']}", json={"hora": None}, headers=headers)
    assert sin_hora.status_code == 200
    assert sin_hora.json()["hora"] is None

    # Eliminación
    assert client.delete(f"/api/metas-diarias/{baja.json()['id']}", headers=headers).status_code == 204
    restantes = client.get(f"/api/metas-diarias?fecha={fecha}", headers=headers).json()
    assert len(restantes) == 2


def test_metas_diarias_widget(client):
    headers = _auth_headers(client)
    fecha = "2026-10-21"

    for titulo in ["Uno", "Dos", "Tres"]:
        assert client.post(
            "/api/metas-diarias",
            json={"titulo": titulo, "fecha": fecha, "prioridad": "media"},
            headers=headers,
        ).status_code == 201

    primera = client.get(f"/api/metas-diarias?fecha={fecha}", headers=headers).json()[0]
    client.post(f"/api/metas-diarias/{primera['id']}/toggle", headers=headers)

    resumen = client.get(f"/api/metas-diarias/widget?fecha={fecha}&limite=2", headers=headers)
    assert resumen.status_code == 200
    data = resumen.json()
    assert data["fecha"] == fecha
    assert data["total"] == 3
    assert data["completadas"] == 1
    assert data["pendientes"] == 2
    assert data["porcentaje"] == 33
    assert len(data["metas"]) == 2
    assert set(data["metas"][0]) == {"id", "titulo", "prioridad", "hora", "completada"}


def test_metas_diarias_validaciones_y_filtro_por_fecha(client):
    headers = _auth_headers(client)

    vacia = client.post("/api/metas-diarias", json={"titulo": "   ", "fecha": "2026-10-20"}, headers=headers)
    assert vacia.status_code == 422

    invalida = client.post(
        "/api/metas-diarias",
        json={"titulo": "Prueba", "fecha": "2026-10-20", "prioridad": "urgente"},
        headers=headers,
    )
    assert invalida.status_code == 422

    hora_invalida = client.post(
        "/api/metas-diarias",
        json={"titulo": "Prueba", "fecha": "2026-10-20", "hora": "25:99"},
        headers=headers,
    )
    assert hora_invalida.status_code == 422

    assert client.post("/api/metas-diarias", json={"titulo": "Hoy", "fecha": "2026-10-20"}, headers=headers).status_code == 201
    assert client.post("/api/metas-diarias", json={"titulo": "Mañana", "fecha": "2026-10-21"}, headers=headers).status_code == 201

    hoy = client.get("/api/metas-diarias?fecha=2026-10-20", headers=headers).json()
    manana = client.get("/api/metas-diarias?fecha=2026-10-21", headers=headers).json()
    assert [m["titulo"] for m in hoy] == ["Hoy"]
    assert [m["titulo"] for m in manana] == ["Mañana"]


def test_metas_diarias_aislamiento_por_usuario(client):
    tomas = _auth_headers(client)
    pareja = _auth_headers(client, "pareja@personal.io")
    fecha = "2026-10-20"

    creada = client.post(
        "/api/metas-diarias",
        json={"titulo": "Privada de Tomás", "fecha": fecha},
        headers=tomas,
    )
    assert creada.status_code == 201

    assert client.get(f"/api/metas-diarias?fecha={fecha}", headers=pareja).json() == []
    assert client.patch(
        f"/api/metas-diarias/{creada.json()['id']}",
        json={"titulo": "Intento ajeno"},
        headers=pareja,
    ).status_code == 404
    assert client.delete(f"/api/metas-diarias/{creada.json()['id']}", headers=pareja).status_code == 404
