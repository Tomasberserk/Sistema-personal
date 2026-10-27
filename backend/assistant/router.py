"""Endpoints HTTP del asistente de voz."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

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


def create_router(main_module: Any) -> APIRouter:
    """Construye el router con el módulo ``main`` inyectado.

    La inyección evita imports circulares y permite que ``main`` se cargue como
    ``main`` o como ``backend.main`` sin duplicar módulos.
    """
    router = APIRouter(prefix="/api/assistant", tags=["Asistente"])
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

    return router
