"""Orquestación de la conversación y de las confirmaciones."""

from __future__ import annotations

import json
import threading
import time
import uuid
from datetime import date
from typing import Any

from pydantic import ValidationError

from .providers import AssistantProvider, ToolCall, Turn, build_provider
from .registry import DIAS_SEMANA, ToolSpec, build_tools
from .summaries import describir_accion, resumir_accion

PENDING_TTL_SECONDS = 10 * 60
MAX_PASOS = 6
MAX_HISTORIAL = 16


class AssistantService:
    """Ejecuta el ciclo mensaje → modelo → herramientas → respuesta."""

    def __init__(self, main_module: Any, provider: AssistantProvider | None = None) -> None:
        self.m = main_module
        self.provider = provider or build_provider()
        self.tools: dict[str, ToolSpec] = build_tools(main_module)
        self._pending: dict[str, dict[str, Any]] = {}
        self._history: dict[str, list[dict[str, Any]]] = {}
        self._lock = threading.RLock()

    # -- API pública --------------------------------------------------------
    def chat(self, user: Any, message: str, session_id: str | None = None) -> dict[str, Any]:
        session_id = session_id or uuid.uuid4().hex
        message = (message or "").strip()
        if not message:
            raise ValueError("El mensaje está vacío.")

        clave = self._clave(user, session_id)
        with self._lock:
            historial = list(self._history.get(clave, []))

        messages: list[dict[str, Any]] = [
            {"role": "system", "content": self._prompt_sistema(user)},
            *historial,
            {"role": "user", "content": message},
        ]

        ejecutadas: list[dict[str, Any]] = []
        pendiente: dict[str, Any] | None = None
        respuesta = "No pude completar la solicitud."

        for _ in range(MAX_PASOS):
            turn = self.provider.run(messages, self.tools)
            if not turn.tool_calls:
                respuesta = (turn.text or "").strip() or "Listo."
                break

            messages.append(self._mensaje_asistente(turn))
            detener = False

            for call in turn.tool_calls:
                spec = self.tools.get(call.name)
                if spec is None:
                    resultado = {"error": f"La acción '{call.name}' no existe."}
                    messages.append(self._mensaje_herramienta(call, resultado))
                    continue

                try:
                    argumentos = spec.params_model.model_validate(call.arguments)
                except ValidationError as exc:
                    primer_error = exc.errors()[0] if exc.errors() else {}
                    campo = ".".join(str(part) for part in primer_error.get("loc", ()))
                    resultado = {
                        "error": f"Argumentos inválidos{f' en {campo}' if campo else ''}: "
                        f"{primer_error.get('msg', 'revisa los datos')}"
                    }
                    messages.append(self._mensaje_herramienta(call, resultado))
                    ejecutadas.append(
                        self._accion(call.name, call.arguments, "error", resumir_accion(call.name, resultado), resultado)
                    )
                    continue

                if spec.destructive:
                    pendiente = self._crear_pendiente(user, session_id, spec, argumentos)
                    resultado = {
                        "estado": "pendiente_de_confirmacion",
                        "mensaje": "La acción requiere confirmación explícita del usuario.",
                    }
                    messages.append(self._mensaje_herramienta(call, resultado))
                    detener = True
                    break

                resultado, correcto = self._ejecutar(spec, user, argumentos)
                messages.append(self._mensaje_herramienta(call, resultado))
                ejecutadas.append(
                    self._accion(
                        spec.name,
                        argumentos.model_dump(),
                        "ok" if correcto else "error",
                        resumir_accion(spec.name, resultado),
                        resultado,
                    )
                )

            if pendiente is not None:
                objetivo = self.tools[pendiente["tool"]]
                args = objetivo.params_model.model_validate(pendiente["argumentos"])
                respuesta = (
                    f"Voy a {describir_accion(objetivo.name, args)}. "
                    "¿Confirmas? Responde sí o no."
                )
                break
            if detener:
                break
        else:
            respuesta = "La solicitud requería demasiados pasos. ¿Puedes darme más detalle?"

        self._recordar(clave, message, respuesta)

        return {
            "session_id": session_id,
            "reply": respuesta,
            "provider": self.provider.name,
            "executed": ejecutadas,
            "pending_confirmation": (
                {
                    "id": pendiente["id"],
                    "tool": pendiente["tool"],
                    "resumen": describir_accion(
                        pendiente["tool"],
                        self.tools[pendiente["tool"]].params_model.model_validate(pendiente["argumentos"]),
                    ),
                    "prompt": respuesta,
                }
                if pendiente
                else None
            ),
        }

    def confirm(self, user: Any, session_id: str, confirmation_id: str, accept: bool) -> dict[str, Any]:
        with self._lock:
            self._limpiar_pendientes()
            pendiente = self._pending.pop(confirmation_id, None)

        if pendiente is None:
            return {
                "session_id": session_id,
                "reply": "Esa confirmación ya expiró o no existe. Vuelve a pedir la acción.",
                "provider": self.provider.name,
                "executed": [],
                "pending_confirmation": None,
            }

        if pendiente["user_id"] != getattr(user, "id", None) or pendiente["session_id"] != session_id:
            return {
                "session_id": session_id,
                "reply": "No pude validar la confirmación para este usuario.",
                "provider": self.provider.name,
                "executed": [],
                "pending_confirmation": None,
            }

        spec = self.tools[pendiente["tool"]]
        argumentos = spec.params_model.model_validate(pendiente["argumentos"])

        if not accept:
            respuesta = "Cancelado. No hice ningún cambio."
            ejecutadas: list[dict[str, Any]] = []
        else:
            resultado, correcto = self._ejecutar(spec, user, argumentos)
            respuesta = resumir_accion(spec.name, resultado)
            ejecutadas = [
                self._accion(
                    spec.name,
                    argumentos.model_dump(),
                    "ok" if correcto else "error",
                    respuesta,
                    resultado,
                )
            ]

        self._recordar(self._clave(user, session_id), "Confirmación del usuario: " + ("sí" if accept else "no"), respuesta)

        return {
            "session_id": session_id,
            "reply": respuesta,
            "provider": self.provider.name,
            "executed": ejecutadas,
            "pending_confirmation": None,
        }

    def catalogo(self) -> list[dict[str, Any]]:
        return [
            {
                "name": spec.name,
                "description": spec.description,
                "destructive": spec.destructive,
                "parameters": spec.parameters_schema(),
            }
            for spec in self.tools.values()
        ]

    # -- Internos -----------------------------------------------------------
    @staticmethod
    def _clave(user: Any, session_id: str) -> str:
        return f"{getattr(user, 'id', 'anon')}:{session_id}"

    @staticmethod
    def _prompt_sistema(user: Any) -> str:
        hoy = date.today()
        dia = DIAS_SEMANA[hoy.weekday()]
        nombre = getattr(user, "nombre", "usuario")
        return (
            "Eres Jarvis, el asistente personal de Sistema Personal 2.0. "
            f"Hablas con {nombre}. Hoy es {dia} {hoy.isoformat()}. "
            "Usa siempre las herramientas para consultar o modificar datos; nunca inventes cifras, "
            "ids ni categorías. Si falta un dato imprescindible, pide solo ese dato. "
            "Para borrar, transferir o retirar ahorros debes llamar la herramienta: el sistema "
            "pedirá la confirmación al usuario, así que no la pidas tú ni la simules. "
            "Responde en español de Colombia, en máximo tres frases, con montos en pesos colombianos. "
            "Si una herramienta devuelve error, explica el motivo y propone una alternativa."
        )

    def _crear_pendiente(self, user: Any, session_id: str, spec: ToolSpec, args: Any) -> dict[str, Any]:
        pendiente = {
            "id": uuid.uuid4().hex,
            "user_id": getattr(user, "id", None),
            "session_id": session_id,
            "tool": spec.name,
            "argumentos": args.model_dump(mode="json"),
            "creado_en": time.time(),
        }
        with self._lock:
            self._limpiar_pendientes()
            self._pending[pendiente["id"]] = pendiente
        return pendiente

    def _limpiar_pendientes(self) -> None:
        limite = time.time() - PENDING_TTL_SECONDS
        vencidos = [key for key, value in self._pending.items() if value["creado_en"] < limite]
        for key in vencidos:
            self._pending.pop(key, None)

    def _ejecutar(self, spec: ToolSpec, user: Any, args: Any) -> tuple[Any, bool]:
        try:
            return spec.handler(self.m, user, args), True
        except Exception as exc:  # HTTPException, ValueError, etc.
            detalle = getattr(exc, "detail", None) or str(exc) or "error desconocido"
            return {"error": str(detalle)}, False

    @staticmethod
    def _mensaje_asistente(turn: Turn) -> dict[str, Any]:
        if turn.raw_message is not None:
            return turn.raw_message
        return {
            "role": "assistant",
            "content": turn.text or None,
            "tool_calls": [
                {
                    "id": call.id,
                    "type": "function",
                    "function": {
                        "name": call.name,
                        "arguments": json.dumps(call.arguments, ensure_ascii=False),
                    },
                }
                for call in turn.tool_calls
            ],
        }

    def _mensaje_herramienta(self, call: ToolCall, resultado: Any) -> dict[str, Any]:
        mensaje = {
            "role": "tool",
            "tool_call_id": call.id,
            "content": json.dumps(resultado, ensure_ascii=False, default=str),
        }
        if self.provider.name == "mock":
            mensaje["name"] = call.name
        return mensaje

    @staticmethod
    def _accion(
        tool: str,
        argumentos: dict[str, Any],
        estado: str,
        resumen: str,
        resultado: Any,
    ) -> dict[str, Any]:
        return {
            "tool": tool,
            "argumentos": argumentos,
            "estado": estado,
            "resumen": resumen,
            "datos": resultado,
        }

    def _recordar(self, clave: str, mensaje: str, respuesta: str) -> None:
        with self._lock:
            historial = self._history.setdefault(clave, [])
            historial.append({"role": "user", "content": mensaje})
            historial.append({"role": "assistant", "content": respuesta})
            if len(historial) > MAX_HISTORIAL:
                del historial[: len(historial) - MAX_HISTORIAL]


__all__ = ["AssistantService", "PENDING_TTL_SECONDS"]
