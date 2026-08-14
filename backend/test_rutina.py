import os
import tempfile
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

def test_rutina_empty_by_default():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    try:
        os.environ["DATABASE_URL"] = ""
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import main
        main.DB_PATH = Path(db_path)
        main.init_db()

        with TestClient(main.app) as client:
            resp = client.get("/api/rutina/bloques")
            assert resp.status_code == 200
            assert resp.json() == []

            resp_semana = client.get("/api/rutina/semana")
            assert resp_semana.status_code == 200
            semana = resp_semana.json()
            assert len(semana) == 7
            for dia in semana:
                assert dia["bloques"] == []

            nuevo_bloque = {
                "dia_semana": 0,
                "hora_inicio": "06:00",
                "hora_fin": "07:00",
                "titulo": "Lectura y café",
                "descripcion": "Momento personal",
                "color": "#5d8ae8",
                "icono": "☕",
                "activo": True
            }
            create_resp = client.post("/api/rutina/bloques", json=nuevo_bloque)
            assert create_resp.status_code == 201
            created = create_resp.json()
            assert created["id"] is not None
            assert created["titulo"] == "Lectura y café"

            resp_despues = client.get("/api/rutina/bloques")
            assert len(resp_despues.json()) == 1

            dia0_resp = client.get("/api/rutina/dia/0")
            assert len(dia0_resp.json()) == 1

            del_resp = client.delete(f"/api/rutina/bloques/{created['id']}")
            assert del_resp.status_code in (200, 204)
            assert client.get("/api/rutina/bloques").json() == []
    finally:
        if os.path.exists(db_path):
            try:
                os.remove(db_path)
            except Exception:
                pass
