import os
import sys
import tempfile
import sqlite3
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

@pytest.fixture(scope="module")
def client_fixture():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    os.environ["DATABASE_URL"] = ""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import main
    main.DB_PATH = Path(db_path)
    main.init_db()

    with TestClient(main.app) as client:
        yield client, db_path

    if os.path.exists(db_path):
        try:
            os.remove(db_path)
        except Exception:
            pass

def test_seed_default_medios_pago_flow(client_fixture):
    client, _ = client_fixture

    # 1. Registrar un usuario nuevo
    email = "nuevo_usuario@prueba.io"
    reg_res = client.post("/api/auth/register", json={
        "email": email,
        "password": "Password123!",
        "nombre": "Usuario Prueba"
    })
    assert reg_res.status_code == 200, reg_res.text
    token = reg_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Verificar que un usuario recién registrado no tiene medios de dinero
    get_res = client.get("/api/medios-pago", headers=headers)
    assert get_res.status_code == 200
    medios_iniciales = get_res.json()
    assert len(medios_iniciales) == 0, f"Se esperaba 0 medios para usuario nuevo, se encontraron: {medios_iniciales}"

    # 3. Llamar al endpoint seed-defaults
    seed_res = client.post("/api/medios-pago/seed-defaults", headers=headers)
    assert seed_res.status_code == 200, f"Error en seed-defaults: {seed_res.status_code} {seed_res.text}"
    seeded_medios = seed_res.json()

    assert len(seeded_medios) == 5, f"Se esperaban 5 medios creados, vinieron {len(seeded_medios)}"
    nombres = [m["nombre"] for m in seeded_medios]
    assert "Efectivo (Billetes)" in nombres
    assert "Efectivo (Monedas)" in nombres
    assert "Bancolombia" in nombres
    assert "Nequi" in nombres
    assert "Daviplata" in nombres

    # 4. Verificar GET /api/medios-pago posterior
    get_after = client.get("/api/medios-pago", headers=headers)
    assert get_after.status_code == 200
    medios_despues = get_after.json()
    assert len(medios_despues) == 5
    for m in medios_despues:
        assert "saldo_actual" in m
        assert m["saldo_actual"] == 0.0

    # 5. Probar idempotencia (llamar de nuevo no debe duplicar ni fallar)
    seed_again = client.post("/api/medios-pago/seed-defaults", headers=headers)
    assert seed_again.status_code == 200
    assert len(seed_again.json()) == 5
