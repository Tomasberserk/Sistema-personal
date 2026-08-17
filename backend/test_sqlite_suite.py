import os
import tempfile
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

def test_full_system_sqlite_suite():
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
            # 1. Health check
            h_resp = client.get("/api/health")
            assert h_resp.status_code == 200
            assert h_resp.json()["status"] == "ok"

            # 2. Categorias (seeds iniciales deben existir)
            cat_resp = client.get("/api/categorias")
            assert cat_resp.status_code == 200
            categorias = cat_resp.json()
            assert len(categorias) > 0
            cat_id = categorias[0]["id"]

            # 3. Ingresos
            ingreso_payload = {
                "fecha": "2026-08-14",
                "fuente": "Didi",
                "monto": 150000.0,
                "nota": "Turno mañana"
            }
            ing_resp = client.post("/api/ingresos", json=ingreso_payload)
            assert ing_resp.status_code == 201
            ing_data = ing_resp.json()
            assert ing_data["monto"] == 150000.0

            # 4. Gastos Variables
            gv_payload = {
                "fecha": "2026-08-14",
                "categoria_id": cat_id,
                "monto": 25000.0,
                "nota": "Almuerzo"
            }
            gv_resp = client.post("/api/gastos-variables", json=gv_payload)
            assert gv_resp.status_code == 201
            gv_data = gv_resp.json()
            assert gv_data["monto"] == 25000.0

            # 5. Gastos Fijos (limpio por defecto sin hardcodeo)
            gf_resp = client.get("/api/gastos-fijos")
            assert gf_resp.status_code == 200
            assert gf_resp.json() == []

            # Crear un gasto fijo manual
            gf_create = client.post("/api/gastos-fijos", json={
                "nombre": "Servicio de Nube",
                "monto": 20000.0,
                "tipo": "mensual",
                "activo": True
            })
            assert gf_create.status_code == 201

            # 6. Medios de Pago y Transferencias
            medios_resp = client.get("/api/medios-pago")
            assert medios_resp.status_code == 200
            medios = medios_resp.json()
            assert len(medios) >= 4
            efectivo_id = next(m["id"] for m in medios if "Efectivo" in m["nombre"])
            nequi_id = next(m["id"] for m in medios if "Nequi" in m["nombre"])

            # Transferir de Efectivo a Nequi
            trans_resp = client.post("/api/transferencias", json={
                "fecha": "2026-08-14",
                "origen_id": efectivo_id,
                "destino_id": nequi_id,
                "monto": 50000.0,
                "nota": "Consignación"
            })
            assert trans_resp.status_code == 201

            # 7. Moto, Kilometraje y Cambio de aceite con gasto
            km_resp = client.post("/api/kilometraje", json={"fecha": "2026-08-14", "km_actuales": 1500, "nota": "Inicio"})
            assert km_resp.status_code == 201

            # Odómetro no puede retroceder
            km_invalid = client.post("/api/kilometraje", json={"fecha": "2026-08-14", "km_actuales": 1200, "nota": "Error"})
            assert km_invalid.status_code == 400

            # Cambio de aceite registrando gasto
            aceite_cambio_resp = client.post("/api/moto/cambio-aceite", json={
                "costo": 60000.0,
                "medio_pago_id": nequi_id,
                "crear_gasto": True,
                "nota": "Aceite Motul"
            })
            assert aceite_cambio_resp.status_code == 200
            assert aceite_cambio_resp.json()["km_ultimo_cambio"] == 1500

            aceite_resp = client.get("/api/moto/estado-aceite")
            assert aceite_resp.status_code == 200
            aceite_data = aceite_resp.json()
            assert aceite_data["km_actuales"] == 1500

            # 8. Habitos
            hab_resp = client.post("/api/habitos", json={"nombre": "Estudiar Código", "icono": "💻", "color": "#5dc4e8", "activo": True})
            assert hab_resp.status_code == 201
            hab_id = hab_resp.json()["id"]

            check_resp = client.post(f"/api/habitos/{hab_id}/check/2026-08-14")
            assert check_resp.status_code == 200
            assert check_resp.json()["completado"] is True

            # 9. Rutina limpia y sin hardcodeo
            rutina_resp = client.get("/api/rutina/bloques")
            assert rutina_resp.status_code == 200
            assert rutina_resp.json() == []

            # 10. Fechas Especiales
            fechas_resp = client.post("/api/fechas-especiales", json={
                "nombre": "Cumpleaños Mamá",
                "fecha": "1975-09-24",
                "tipo": "cumpleanos",
                "icono": "🎂",
                "color": "#e85d8a",
                "recordar_dias_antes": 3,
                "nota": "Le gustan las flores"
            })
            assert fechas_resp.status_code == 201
            fechas_data = fechas_resp.json()
            assert "dias_restantes" in fechas_data
            assert fechas_data["nombre"] == "Cumpleaños Mamá"

            list_fechas = client.get("/api/fechas-especiales")
            assert list_fechas.status_code == 200
            assert len(list_fechas.json()) >= 1

            # 11. Recordatorios Universales
            rec_resp = client.post("/api/recordatorios", json={
                "titulo": "Tomar agua cada 2 horas",
                "tipo": "recurrente",
                "fecha_disparo": "2026-08-17T09:00:00",
                "regla_recurrencia": "INTERVAL_HOURS:2",
                "canal": "todos",
                "anticipacion_minutos": 0,
                "activo": True
            })
            assert rec_resp.status_code == 201
            rec_data = rec_resp.json()
            assert rec_data["activo"] is True
            assert rec_data["tipo"] == "recurrente"

            list_rec = client.get("/api/recordatorios")
            assert list_rec.status_code == 200
            assert len(list_rec.json()) >= 1

            # 12. Resumen Financiero y Saldos
            fin_resp = client.get("/api/resumen/mes-actual")
            assert fin_resp.status_code == 200
            fin_data = fin_resp.json()
            assert fin_data["total_ingresos"] == 150000.0
            # 25000 (gasto variable anterior) + 60000 (cambio de aceite) = 85000
            assert fin_data["total_gastos_variables"] == 85000.0
            assert "saldo_total_medios" in fin_data
            assert len(fin_data["saldos_medios"]) >= 4
    finally:
        if os.path.exists(db_path):
            try:
                os.remove(db_path)
            except Exception:
                pass
