from datetime import date
from fastapi.testclient import TestClient
import pytest
from backend.main import app, generate_auth_token, get_connection, closing

client = TestClient(app)


def auth_header(user_id: int = 1) -> dict[str, str]:
    token = generate_auth_token(user_id)
    return {"Authorization": f"Bearer {token}"}


def test_widget_finanzas_authenticated():
    res = client.get("/api/widgets/finanzas", headers=auth_header(1))
    assert res.status_code == 200
    data = res.json()
    assert "saldo_total" in data
    assert "gastos_hoy" in data
    assert "ingresos_hoy" in data
    assert "balance_hoy" in data
    assert "medios_principales" in data
    assert isinstance(data["medios_principales"], list)


def test_widget_finanzas_requires_auth():
    res = client.get("/api/widgets/finanzas")
    assert res.status_code == 401


def test_widget_habitos_authenticated():
    today = date.today().isoformat()
    res = client.get(f"/api/widgets/habitos?fecha={today}&limite=4", headers=auth_header(1))
    assert res.status_code == 200
    data = res.json()
    assert data["fecha"] == today
    assert "total" in data
    assert "completados" in data
    assert "pendientes" in data
    assert "porcentaje" in data
    assert "habitos" in data
    assert isinstance(data["habitos"], list)


def test_widget_moto_authenticated():
    res = client.get("/api/widgets/moto", headers=auth_header(1))
    assert res.status_code == 200
    data = res.json()
    assert "km_actuales" in data
    assert "km_ultimo_cambio" in data
    assert "km_restantes" in data
    assert "porcentaje_vida_aceite" in data
    assert "alerta" in data
    assert "actualizado_en" in data
