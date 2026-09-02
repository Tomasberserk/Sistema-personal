import datetime
import os
import sys
import tempfile
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

def test_full_system_sqlite_suite():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    try:
        os.environ["DATABASE_URL"] = ""
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import main
        main.DB_PATH = Path(db_path)
        main.init_db()

        with TestClient(main.app) as client:
            today_str = datetime.date.today().isoformat()

            # 1. Health check
            h_resp = client.get("/api/health")
            assert h_resp.status_code == 200
            assert h_resp.json()["status"] == "ok"

            # 2. Demo users list & login
            demo_resp = client.get("/api/auth/demo-users")
            assert demo_resp.status_code == 200
            demo_users = demo_resp.json()
            assert len(demo_users) >= 4
            user_tomas = demo_users[0]
            assert user_tomas["nombre"] == "Tomás"

            # Switch demo / Login
            login_resp = client.post("/api/auth/login", json={"email": "tomas@personal.io", "password": "demo"})
            assert login_resp.status_code == 200
            token = login_resp.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # 3. Categorias (seeds iniciales deben existir)
            cat_resp = client.get("/api/categorias", headers=headers)
            assert cat_resp.status_code == 200
            categorias = cat_resp.json()
            assert len(categorias) > 0
            cat_id = categorias[0]["id"]

            # 4. Ingresos (usar fecha del mes actual para que el resumen financiero cuadre)
            ingreso_payload = {
                "fecha": today_str,
                "fuente": "Sueldo / Nómina",
                "monto": 150000.0,
                "nota": "Pago quincenal"
            }
            ing_resp = client.post("/api/ingresos", json=ingreso_payload, headers=headers)
            assert ing_resp.status_code == 201
            ing_data = ing_resp.json()
            assert ing_data["monto"] == 150000.0

            # 5. Gastos Variables
            gv_payload = {
                "fecha": today_str,
                "categoria_id": cat_id,
                "monto": 25000.0,
                "nota": "Almuerzo"
            }
            gv_resp = client.post("/api/gastos-variables", json=gv_payload, headers=headers)
            assert gv_resp.status_code == 201
            gv_data = gv_resp.json()
            assert gv_data["monto"] == 25000.0

            # 6. Gastos Fijos (limpio por defecto)
            gf_resp = client.get("/api/gastos-fijos", headers=headers)
            assert gf_resp.status_code == 200
            assert gf_resp.json() == []

            # Crear un gasto fijo manual
            gf_create = client.post("/api/gastos-fijos", json={
                "nombre": "Servicio de Nube",
                "monto": 20000.0,
                "tipo": "mensual",
                "activo": True
            }, headers=headers)
            assert gf_create.status_code == 201

            # 7. Medios de Pago y Transferencias
            medios_resp = client.get("/api/medios-pago", headers=headers)
            assert medios_resp.status_code == 200
            medios = medios_resp.json()
            assert len(medios) >= 4
            efectivo_id = next(m["id"] for m in medios if "Efectivo" in m["nombre"])
            nequi_id = next(m["id"] for m in medios if "Nequi" in m["nombre"])

            # Transferir de Efectivo a Nequi
            trans_resp = client.post("/api/transferencias", json={
                "fecha": today_str,
                "origen_id": efectivo_id,
                "destino_id": nequi_id,
                "monto": 50000.0,
                "nota": "Consignación"
            }, headers=headers)
            assert trans_resp.status_code == 201

            # 8. Módulo de Ahorros: Crear Meta y Aportar
            ahorro_resp = client.post("/api/ahorros", json={
                "nombre": "Fondo de Emergencia",
                "monto_objetivo": 1000000.0,
                "monto_actual": 0.0,
                "icono": "🛡️",
                "color": "#5de8c4",
                "nota": "Meta a 6 meses",
                "activo": True
            }, headers=headers)
            assert ahorro_resp.status_code == 201
            ahorro_id = ahorro_resp.json()["id"]

            aporte_resp = client.post(f"/api/ahorros/{ahorro_id}/aportar", json={
                "meta_ahorro_id": ahorro_id,
                "tipo": "aporte",
                "monto": 200000.0,
                "fecha": today_str,
                "medio_pago_id": nequi_id,
                "nota": "Primer aporte"
            }, headers=headers)
            assert aporte_resp.status_code == 200
            assert aporte_resp.json()["monto_actual"] == 200000.0
            assert aporte_resp.json()["porcentaje"] == 20.0

            # Listar movimientos de ahorro
            movs_resp = client.get(f"/api/ahorros/{ahorro_id}/movimientos", headers=headers)
            assert movs_resp.status_code == 200
            assert len(movs_resp.json()) == 1

            # 9. Moto, Kilometraje y Cambio de aceite con gasto
            km_resp = client.post("/api/kilometraje", json={"fecha": today_str, "km_actuales": 1500, "nota": "Inicio"}, headers=headers)
            assert km_resp.status_code == 201

            # Odómetro no puede retroceder
            km_invalid = client.post("/api/kilometraje", json={"fecha": today_str, "km_actuales": 1200, "nota": "Error"}, headers=headers)
            assert km_invalid.status_code == 400

            # Cambio de aceite registrando gasto
            aceite_cambio_resp = client.post("/api/moto/cambio-aceite", json={
                "costo": 60000.0,
                "medio_pago_id": nequi_id,
                "crear_gasto": True,
                "nota": "Aceite Motul"
            }, headers=headers)
            assert aceite_cambio_resp.status_code == 200
            assert aceite_cambio_resp.json()["km_ultimo_cambio"] == 1500

            aceite_resp = client.get("/api/moto/estado-aceite", headers=headers)
            assert aceite_resp.status_code == 200
            aceite_data = aceite_resp.json()
            assert aceite_data["km_actuales"] == 1500

            # 10. Habitos
            hab_resp = client.post("/api/habitos", json={"nombre": "Estudiar Código", "icono": "💻", "color": "#5dc4e8", "activo": True}, headers=headers)
            assert hab_resp.status_code == 201
            hab_id = hab_resp.json()["id"]

            check_resp = client.post(f"/api/habitos/{hab_id}/check/{today_str}", headers=headers)
            assert check_resp.status_code == 200
            assert check_resp.json()["completado"] is True

            # 11. Rutina
            rutina_resp = client.get("/api/rutina/bloques", headers=headers)
            assert rutina_resp.status_code == 200
            assert rutina_resp.json() == []

            # 12. Fechas Especiales
            fechas_resp = client.post("/api/fechas-especiales", json={
                "nombre": "Cumpleaños Mamá",
                "fecha": "1975-09-24",
                "tipo": "cumpleanos",
                "icono": "🎂",
                "color": "#e85d8a",
                "recordar_dias_antes": 3,
                "nota": "Le gustan las flores"
            }, headers=headers)
            assert fechas_resp.status_code == 201
            fechas_data = fechas_resp.json()
            assert "dias_restantes" in fechas_data

            # 13. Recordatorios
            rec_resp = client.post("/api/recordatorios", json={
                "titulo": "Tomar agua cada 2 horas",
                "tipo": "recurrente",
                "fecha_disparo": f"{today_str}T09:00:00",
                "regla_recurrencia": "INTERVAL_HOURS:2",
                "canal": "todos",
                "anticipacion_minutos": 0,
                "activo": True
            }, headers=headers)
            assert rec_resp.status_code == 201
            rec_data = rec_resp.json()
            assert rec_data["activo"] is True

            # 14. Resumen Financiero y Ahorros
            fin_resp = client.get("/api/resumen/mes-actual", headers=headers)
            assert fin_resp.status_code == 200
            fin_data = fin_resp.json()
            assert fin_data["total_ingresos"] == 150000.0
            assert fin_data["total_gastos_fijos"] == 20000.0
            assert fin_data["total_ahorros"] == 200000.0
            assert len(fin_data["metas_ahorro"]) == 1

            # 15. Aislamiento Multi-usuario: Usuario 2 (Pareja) debe ver su propio espacio
            switch_resp = client.post("/api/auth/switch-demo", json={"user_id": 2})
            assert switch_resp.status_code == 200
            token_user2 = switch_resp.json()["token"]
            headers_user2 = {"Authorization": f"Bearer {token_user2}"}

            fin_user2 = client.get("/api/resumen/mes-actual", headers=headers_user2)
            assert fin_user2.status_code == 200
            assert fin_user2.json()["total_ingresos"] == 0.0
            assert fin_user2.json()["total_ahorros"] == 0.0

    finally:
        if os.path.exists(db_path):
            os.remove(db_path)
