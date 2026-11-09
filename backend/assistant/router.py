"""Endpoints HTTP del asistente de voz e invocación de herramientas BFF."""

from __future__ import annotations

import hashlib
import json
import os
import secrets
import time
from contextlib import closing
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, ValidationError

from .providers import ProviderError
from .service import AssistantService


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    session_id: str | None = Field(default=None, max_length=64)


class ConfirmRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=64)
    confirmation_id: str = Field(min_length=1, max_length=64)
    accept: bool = True


class ExecutedAction(BaseModel):
    tool: str
    argumentos: dict[str, Any] = Field(default_factory=dict)
    estado: str
    resumen: str
    datos: Any = None


class PendingConfirmation(BaseModel):
    id: str
    tool: str
    resumen: str
    prompt: str


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    provider: str
    executed: list[ExecutedAction] = Field(default_factory=list)
    pending_confirmation: PendingConfirmation | None = None


class ToolInfo(BaseModel):
    name: str
    description: str
    destructive: bool
    parameters: dict[str, Any]


class ToolsResponse(BaseModel):
    provider: str
    tools: list[ToolInfo]


class ToolExecuteRequest(BaseModel):
    tool_name: str = Field(min_length=1, max_length=64)
    parameters: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str | None = Field(default=None, max_length=64)
    occurred_at_client: str | None = None


class ToolExecuteResponse(BaseModel):
    status: str
    tool_name: str
    idempotency_key: str
    result: Any
    state_version: int
    cached: bool = False
    server_received_at: str
    committed_at: str


class LiveSessionResponse(BaseModel):
    ephemeral_token: str
    model: str
    expires_at: str
    new_session_expire_time: str
    session_resumption_allowed: bool
    ws_url: str


def create_router(main_module: Any) -> APIRouter:
    """Construye el router con el módulo ``main`` inyectado.

    La inyección evita imports circulares y permite que ``main`` se cargue como
    ``main`` o como ``backend.main`` sin duplicar módulos.
    """
    router = APIRouter(tags=["Asistente"])
    service = AssistantService(main_module)

    @router.post("/chat", response_model=ChatResponse)
    def chat(
        payload: ChatRequest,
        user: main_module.Usuario = Depends(main_module.get_current_user),
    ) -> dict[str, Any]:
        try:
            return service.chat(user, payload.message, payload.session_id)
        except ProviderError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/confirm", response_model=ChatResponse)
    def confirm(
        payload: ConfirmRequest,
        user: main_module.Usuario = Depends(main_module.get_current_user),
    ) -> dict[str, Any]:
        return service.confirm(user, payload.session_id, payload.confirmation_id, payload.accept)

    @router.get("/tools", response_model=ToolsResponse)
    def tools(user: main_module.Usuario = Depends(main_module.get_current_user)) -> dict[str, Any]:
        return {"provider": service.provider.name, "tools": service.catalogo()}

    @router.post("/tools/execute", response_model=ToolExecuteResponse)
    def execute_tool(
        payload: ToolExecuteRequest,
        x_idempotency_key: str | None = Header(default=None, alias="X-Idempotency-Key"),
        user: main_module.Usuario = Depends(main_module.get_current_user),
    ) -> ToolExecuteResponse:
        effective_key = (x_idempotency_key or payload.idempotency_key or "").strip()
        if x_idempotency_key and payload.idempotency_key and x_idempotency_key.strip() != payload.idempotency_key.strip():
            raise HTTPException(
                status_code=400,
                detail="Discrepancia entre header X-Idempotency-Key y payload.idempotency_key",
            )
        if not effective_key:
            raise HTTPException(
                status_code=400,
                detail="X-Idempotency-Key es requerido para ejecutar herramientas con idempotencia.",
            )

        spec = service.tools.get(payload.tool_name)
        if spec is None:
            raise HTTPException(
                status_code=404,
                detail=f"La herramienta '{payload.tool_name}' no existe en el catálogo.",
            )

        try:
            argumentos = spec.params_model.model_validate(payload.parameters)
        except ValidationError as exc:
            primer_error = exc.errors()[0] if exc.errors() else {}
            campo = ".".join(str(part) for part in primer_error.get("loc", ()))
            detalle = f"Argumentos inválidos{f' en {campo}' if campo else ''}: {primer_error.get('msg', 'revisa los datos')}"
            raise HTTPException(status_code=422, detail=detalle) from exc

        canonical_json = json.dumps(payload.parameters, sort_keys=True, ensure_ascii=False)
        payload_hash = hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()
        now_iso = datetime.now().isoformat()

        with closing(main_module.get_connection()) as conn:
            # 1. Comprobar si ya existe registro de idempotencia
            row = conn.execute(
                "SELECT * FROM idempotency_records WHERE user_id = %s AND idempotency_key = %s",
                (user.id, effective_key),
            ).fetchone()

            if row:
                row_dict = main_module.row_to_dict(row) if hasattr(main_module, "row_to_dict") else dict(row)
                saved_hash = str(row_dict.get("payload_hash", "")).strip()
                saved_status = str(row_dict.get("status", "")).strip()

                if saved_status == "COMMITTED":
                    if saved_hash == payload_hash:
                        cached_result = json.loads(row_dict["response_json"]) if row_dict.get("response_json") else {}
                        return ToolExecuteResponse(
                            status="COMMITTED",
                            tool_name=payload.tool_name,
                            idempotency_key=effective_key,
                            result=cached_result,
                            state_version=int(time.time()),
                            cached=True,
                            server_received_at=str(row_dict.get("created_at", now_iso)),
                            committed_at=str(row_dict.get("updated_at", now_iso)),
                        )
                    raise HTTPException(
                        status_code=409,
                        detail="IDEMPOTENCY_KEY_COLLISION: La clave ya fue usada previamente con parámetros distintos.",
                    )
                if saved_status == "PROCESSING":
                    raise HTTPException(
                        status_code=409,
                        detail="IN_PROGRESS: Esta operación se encuentra actualmente en procesamiento.",
                    )

            # 2. Reclamar la clave en estado PROCESSING
            conn.execute(
                "INSERT INTO idempotency_records (user_id, idempotency_key, tool_name, payload_hash, status, created_at, updated_at) "
                "VALUES (%s, %s, %s, %s, 'PROCESSING', %s, %s)",
                (user.id, effective_key, payload.tool_name, payload_hash, now_iso, now_iso),
            )
            conn.commit()

            # 3. Ejecutar la acción
            try:
                result, ok = service._ejecutar(spec, user, argumentos)
                if not ok:
                    conn.execute(
                        "UPDATE idempotency_records SET status = 'REJECTED', response_json = %s, updated_at = %s "
                        "WHERE user_id = %s AND idempotency_key = %s",
                        (json.dumps(result, ensure_ascii=False), datetime.now().isoformat(), user.id, effective_key),
                    )
                    conn.commit()
                    error_msg = result.get("error", "Error ejecutando la herramienta") if isinstance(result, dict) else str(result)
                    raise HTTPException(status_code=400, detail=error_msg)

                committed_at = datetime.now().isoformat()
                tx_id = None
                if isinstance(result, dict):
                    tx_id = result.get("id") or result.get("transaccion_id")
                    if tx_id is not None:
                        try:
                            tx_id = int(tx_id)
                        except (ValueError, TypeError):
                            tx_id = None

                conn.execute(
                    "UPDATE idempotency_records SET status = 'COMMITTED', response_json = %s, transaction_id = %s, updated_at = %s "
                    "WHERE user_id = %s AND idempotency_key = %s",
                    (json.dumps(result, ensure_ascii=False), tx_id, committed_at, user.id, effective_key),
                )
                conn.commit()

                return ToolExecuteResponse(
                    status="COMMITTED",
                    tool_name=payload.tool_name,
                    idempotency_key=effective_key,
                    result=result,
                    state_version=int(time.time()),
                    cached=False,
                    server_received_at=now_iso,
                    committed_at=committed_at,
                )
            except HTTPException:
                raise
            except Exception as exc:
                conn.execute(
                    "UPDATE idempotency_records SET status = 'REJECTED', response_json = %s, updated_at = %s "
                    "WHERE user_id = %s AND idempotency_key = %s",
                    (json.dumps({"error": str(exc)}, ensure_ascii=False), datetime.now().isoformat(), user.id, effective_key),
                )
                conn.commit()
                raise HTTPException(status_code=500, detail=f"Error transaccional en {payload.tool_name}: {exc}") from exc

    @router.post("/live/session", response_model=LiveSessionResponse)
    @router.get("/live/session", response_model=LiveSessionResponse)
    def live_session(
        user: main_module.Usuario = Depends(main_module.get_current_user),
    ) -> dict[str, Any]:
        gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
        expires = (datetime.now() + timedelta(minutes=30)).isoformat()
        new_session_expire = (datetime.now() + timedelta(minutes=2)).isoformat()
        token_val = gemini_key if gemini_key else secrets.token_urlsafe(32)
        return {
            "ephemeral_token": token_val,
            "model": "models/gemini-3.8-live",
            "expires_at": expires,
            "new_session_expire_time": new_session_expire,
            "session_resumption_allowed": True,
            "ws_url": "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent",
        }

    return router
