"""Proveedores del cerebro del asistente.

* ``MockProvider``: parser determinista en español, sin red ni API key.  Sirve
  para desarrollo, demos y tests.
* ``XAIProvider``: xAI Grok con *function calling* (API compatible con OpenAI
  en ``https://api.x.ai/v1/chat/completions``).

Ambos devuelven ``Turn`` con texto y/o llamadas a herramientas, de modo que el
servicio de conversación es idéntico para los dos.
"""

from __future__ import annotations

import json
import os
import re
import time
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx

from .registry import ToolSpec
from .summaries import resumir_accion


class ProviderError(RuntimeError):
    """Error de comunicación con el proveedor del modelo."""


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class Turn:
    text: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    raw_message: dict[str, Any] | None = None


class AssistantProvider(Protocol):
    name: str

    def run(self, messages: list[dict[str, Any]], tools: dict[str, ToolSpec]) -> Turn: ...


# ---------------------------------------------------------------------------
# Mock determinista
# ---------------------------------------------------------------------------
def _plano(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", str(text or "").lower())
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def _extraer_monto(text: str) -> float | None:
    match = re.search(r"(\d[\d.,]*)\s*(mil|k|millon(?:es)?)?\b", text)
    if not match:
        return None
    raw = match.group(1).strip(".,")
    try:
        if re.fullmatch(r"\d{1,3}(\.\d{3})+", raw):
            value = float(raw.replace(".", ""))
        elif re.fullmatch(r"\d{1,3}(,\d{3})+", raw):
            value = float(raw.replace(",", ""))
        else:
            value = float(raw.replace(".", "").replace(",", "."))
    except ValueError:
        return None
    sufijo = (match.group(2) or "").lower()
    if sufijo in ("mil", "k"):
        value *= 1_000
    elif sufijo.startswith("millon"):
        value *= 1_000_000
    return value


def _recortar(texto: str, markers: tuple[str, ...] = (" con ", " usando ", " desde ", " nota ")) -> str:
    resultado = texto
    for marker in markers:
        if marker in resultado:
            resultado = resultado.split(marker, 1)[0]
    return resultado.strip(" ,.;")


def _entidad_para_borrar(text: str) -> str:
    if "gasto fijo" in text:
        return "gasto_fijo"
    if "gasto" in text:
        return "gasto_variable"
    if "ingreso" in text:
        return "ingreso"
    if "ahorro" in text or "meta" in text:
        return "ahorro"
    if "habito" in text:
        return "habito"
    if "recordatorio" in text:
        return "recordatorio"
    if "transferencia" in text:
        return "transferencia"
    if "bloque" in text or "rutina" in text:
        return "bloque_rutina"
    if "fecha" in text or "cumple" in text:
        return "fecha_especial"
    if "medio" in text or "cuenta" in text:
        return "medio_pago"
    return "gasto_variable"


class MockProvider:
    """Interpreta comandos de voz con reglas simples y resultados estables."""

    name = "mock"

    def run(self, messages: list[dict[str, Any]], tools: dict[str, ToolSpec]) -> Turn:
        resultados = self._resultados_pendientes(messages)
        if resultados:
            frases = [resumir_accion(nombre, data) for nombre, data in resultados]
            return Turn(text=" ".join(frases))

        texto = self._ultimo_mensaje_usuario(messages)
        return self._interpretar(texto, tools)

    @staticmethod
    def _ultimo_mensaje_usuario(messages: list[dict[str, Any]]) -> str:
        for message in reversed(messages):
            if message.get("role") == "user":
                return str(message.get("content") or "")
        return ""

    @staticmethod
    def _resultados_pendientes(messages: list[dict[str, Any]]) -> list[tuple[str, Any]]:
        resultados: list[tuple[str, Any]] = []
        for message in reversed(messages):
            if message.get("role") == "user":
                break
            if message.get("role") != "tool":
                continue
            try:
                data = json.loads(message.get("content") or "{}")
            except json.JSONDecodeError:
                data = {"error": "respuesta ilegible"}
            resultados.append((str(message.get("name") or "accion"), data))
        resultados.reverse()
        return resultados

    def _interpretar(self, mensaje: str, tools: dict[str, ToolSpec]) -> Turn:
        texto = _plano(mensaje)

        def llamar(herramienta: str, **argumentos: Any) -> Turn:
            if herramienta not in tools:
                return Turn(text="Esa acción no está disponible.")
            return Turn(tool_calls=[ToolCall(id=f"mock_{herramienta}", name=herramienta, arguments=argumentos)])

        # Eliminar (destructivo, siempre pasa por confirmación)
        if re.search(r"\b(borra|borrar|elimina|eliminar|quita|quitar)\b", texto):
            numero = re.search(r"\b(?:id|numero)\s*(\d+)", texto)
            if not numero:
                return Turn(text="Necesito el id del registro. Primero puedo listarte los últimos.")
            return llamar("eliminar_registro", entidad=_entidad_para_borrar(texto), id=int(numero.group(1)))

        # Transferencias
        if re.search(r"\b(transfiere|transferir|transfiere|pasa|pasar)\b", texto) and "entre" not in texto:
            monto = _extraer_monto(texto)
            par = re.search(r"\bde\s+([a-z0-9\s]+?)\s+a\s+([a-z0-9\s]+?)(?:\s+con|\s*$)", texto)
            if monto and par:
                return llamar(
                    "transferir_entre_medios",
                    origen=par.group(1).strip(),
                    destino=par.group(2).strip(),
                    monto=monto,
                )
            return Turn(text="Dime cuánto, desde qué medio y hacia cuál quieres transferir.")

        # Retiros / aportes de ahorro
        if re.search(r"\b(retira|retirar|saca|sacar)\b", texto) or texto.startswith("retira"):
            monto = _extraer_monto(texto)
            meta = re.search(r"\b(?:de|desde)\s+(?:la meta\s+)?([a-z0-9\s]+?)(?:\s+por|\s*$)", texto)
            if monto and meta:
                return llamar("retirar_ahorro", meta=meta.group(1).strip(), monto=monto)
            return Turn(text="Dime de qué meta y cuánto quieres retirar.")
        if re.search(r"\b(aporta|aportar|abona|abonar|ahorra|ahorrar)\b", texto):
            monto = _extraer_monto(texto)
            meta = re.search(r"\ba\s+(?:la meta\s+)?([a-z0-9\s]+?)(?:\s+por|\s*$)", texto)
            if monto and meta:
                return llamar("aportar_ahorro", meta=meta.group(1).strip(), monto=monto)
            return Turn(text="Dime cuánto quieres aportar y a qué meta.")

        # Gasto fijo
        if "gasto fijo" in texto or "gastos fijos" in texto:
            monto = _extraer_monto(texto)
            if re.search(r"\b(crea|crear|agrega|agregar|nuevo|nueva|registra)\b", texto) and monto:
                nombre = re.search(r"gastos? fijos?\s+(?:de\s+)?([a-z0-9\s]+?)(?:\s+de\s+\d|\s+por\s+\d|$)", texto)
                return llamar(
                    "crear_gasto_fijo",
                    nombre=(nombre.group(1).strip() if nombre else "Gasto fijo"),
                    monto=monto,
                )
            return llamar("listar_gastos_fijos")

        # Gasto variable
        if re.search(r"\b(gaste|gasto|gastar|compre|compre|pague|pagar|registra|registrar|agrega|agregar|anota|anotar)\b", texto) and "ingreso" not in texto:
            monto = _extraer_monto(texto)
            if monto is not None:
                categoria = re.search(r"\ben\s+([a-z0-9\s]+)", texto)
                if not categoria:
                    return Turn(text="¿En qué categoría registro el gasto? Por ejemplo comida, transporte o salud.")
                medio = re.search(r"\b(?:con|usando|desde)\s+([a-z0-9\s]+)", texto)
                return llamar(
                    "crear_gasto_variable",
                    monto=monto,
                    categoria=_recortar(categoria.group(1), (" con ", " usando ", " desde ")),
                    medio_pago=_recortar(medio.group(1)) if medio else None,
                )
            if "gasto" in texto and "gaste" not in texto:
                return llamar("listar_gastos_variables")

        # Ingreso
        if re.search(r"\b(recibi|recibir|ingreso|ingresa|me pagaron|entro|entraron)\b", texto):
            monto = _extraer_monto(texto)
            if monto is not None:
                fuente = re.search(r"\bpor\s+([a-z0-9\s]+?)(?:\s+en\s+|\s*$)", texto)
                medio = re.search(r"\b(?:en|a)\s+([a-z0-9\s]+?)(?:\s+por|\s*$)", texto)
                return llamar(
                    "crear_ingreso",
                    monto=monto,
                    fuente=(_recortar(fuente.group(1)) if fuente else "Otro"),
                    medio_pago=(_recortar(medio.group(1)) if medio else None),
                )
            return llamar("listar_ingresos")

        # Hábitos
        if re.search(r"\b(marca|marcar|marque|complete|completar|complete|desmarca|desmarcar)\b", texto) and "habito" in texto:
            nombre = re.sub(r"^.*?habitos?\s+", "", texto).strip(" ,.")
            if not nombre:
                return Turn(text="¿Cuál hábito quieres marcar?")
            desmarcar = "desmarca" in texto
            return llamar("marcar_habito", nombre=nombre, completado=not desmarcar)

        # Rutina
        if re.search(r"\b(rutina|agenda|horario)\b", texto):
            dia = "semana" if "semana" in texto else "hoy"
            for nombre_dia in ("lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"):
                if nombre_dia in texto:
                    dia = nombre_dia
            return llamar("consultar_rutina", dia=dia)

        # Kilometraje / aceite
        if re.search(r"\b(aceite|moto)\b", texto) and not re.search(r"\bkilometraje|kilometros|km\b", texto):
            return llamar("estado_aceite_moto")
        if re.search(r"\b(kilometraje|kilometros|odometro|km)\b", texto):
            monto = _extraer_monto(texto)
            if monto is not None:
                return llamar("registrar_kilometraje", km_actuales=int(monto))
            return llamar("estado_aceite_moto")

        # Recordatorios
        if "recuerdame" in texto or "recordatorio" in texto:
            if "recuerdame" in texto:
                fecha = re.search(r"(hoy|manana|ayer|\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2})(?:\s+a\s+las\s+(\d{1,2}:?\d{2}))?", texto)
                titulo = texto.split("recuerdame", 1)[1]
                if fecha:
                    titulo = titulo[: fecha.start()]
                titulo = titulo.strip(" ,.")
                if titulo:
                    cuando = fecha.group(1) if fecha else "hoy"
                    hora = fecha.group(2) if fecha and fecha.group(2) else "09:00"
                    if ":" not in hora:
                        hora = f"{hora[:2]}:{hora[2:]}"
                    return llamar("crear_recordatorio", titulo=titulo, fecha_disparo=f"{cuando} {hora}")
            return llamar("listar_recordatorios")

        # Consultas de finanzas
        if re.search(r"\b(por categoria|en que se me va|desglose)\b", texto):
            return llamar("gastos_por_categoria")
        if re.search(r"\b(resumen|balance|como voy|cuanto tengo|cuanto gaste|cuanto llevo)\b", texto):
            return llamar("resumen_mes_actual")
        if "gastos fijos" in texto:
            return llamar("listar_gastos_fijos")
        if re.search(r"\bgastos\b", texto):
            return llamar("listar_gastos_variables")
        if re.search(r"\bingresos\b", texto):
            return llamar("listar_ingresos")
        if re.search(r"\b(categorias)\b", texto):
            return llamar("listar_categorias")
        if re.search(r"\b(medios|cuentas|saldos)\b", texto):
            return llamar("listar_medios_pago")
        if re.search(r"\b(ahorros|metas)\b", texto):
            return llamar("listar_ahorros")
        if re.search(r"\btransferencias\b", texto):
            return llamar("listar_transferencias")
        if re.search(r"\bhabitos\b", texto):
            return llamar("resumen_habitos")
        if re.search(r"\bfechas especiales\b", texto):
            return llamar("listar_fechas_especiales")

        return Turn(
            text=(
                "Puedo registrar gastos e ingresos, consultar tu resumen, ahorrar, "
                "marcar hábitos, revisar la rutina, los recordatorios y la moto. "
                "¿Qué quieres hacer?"
            )
        )


# ---------------------------------------------------------------------------
# Proveedores compatibles con OpenAI (xAI Grok y Groq)
# ---------------------------------------------------------------------------
DEFAULT_MODELS = {
    "xai": "grok-4.7",
    "groq": "openai/gpt-oss-120b",
}
DEFAULT_BASE_URLS = {
    "xai": "https://api.x.ai/v1",
    "groq": "https://api.groq.com/openai/v1",
}


class OpenAICompatibleProvider:
    """Cliente de /chat/completions con tool calling."""

    name = "openai-compatible"

    def __init__(
        self,
        api_key: str,
        *,
        name: str,
        model: str,
        base_url: str,
        timeout: float = 45.0,
    ) -> None:
        if not api_key:
            raise ProviderError(f"Falta la API key para usar el proveedor {name}.")
        self.api_key = api_key
        self.name = name
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def run(self, messages: list[dict[str, Any]], tools: dict[str, ToolSpec]) -> Turn:
        payload = {
            "model": self.model,
            "messages": messages,
            "tools": [spec.function_schema() for spec in tools.values()],
            "tool_choice": "auto",
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        last_error: Exception | None = None
        for intento in range(2):
            try:
                with httpx.Client(timeout=self.timeout) as client:
                    response = client.post(
                        f"{self.base_url}/chat/completions",
                        headers=headers,
                        json=payload,
                    )
                if response.status_code in (429, 500, 502, 503, 504) and intento == 0:
                    time.sleep(0.8)
                    continue
                if response.status_code >= 400:
                    detalle = response.text[:400]
                    raise ProviderError(f"{self.name} respondió {response.status_code}: {detalle}")
                data = response.json()
                return self._parsear(data)
            except httpx.HTTPError as exc:
                last_error = exc
                if intento == 0:
                    time.sleep(0.8)
                    continue
                break
        raise ProviderError(f"No pude conectar con {self.name}: {last_error}")

    @staticmethod
    def _parsear(data: dict[str, Any]) -> Turn:
        choices = data.get("choices") or []
        if not choices:
            return Turn(text="No recibí respuesta del modelo.")
        message = choices[0].get("message") or {}
        llamadas: list[ToolCall] = []
        for call in message.get("tool_calls") or []:
            function = call.get("function") or {}
            try:
                argumentos = json.loads(function.get("arguments") or "{}")
            except json.JSONDecodeError:
                argumentos = {}
            llamadas.append(
                ToolCall(
                    id=str(call.get("id") or f"call_{len(llamadas)}"),
                    name=str(function.get("name") or ""),
                    arguments=argumentos if isinstance(argumentos, dict) else {},
                )
            )
        return Turn(
            text=str(message.get("content") or ""),
            tool_calls=llamadas,
            raw_message=message,
        )


class XAIProvider(OpenAICompatibleProvider):
    """xAI Grok (claves que empiezan por ``xai-``)."""

    def __init__(
        self,
        api_key: str,
        model: str | None = None,
        base_url: str | None = None,
        timeout: float = 45.0,
    ) -> None:
        super().__init__(
            api_key,
            name="xai",
            model=model or os.environ.get("XAI_MODEL", DEFAULT_MODELS["xai"]),
            base_url=base_url or os.environ.get("XAI_BASE_URL", DEFAULT_BASE_URLS["xai"]),
            timeout=timeout,
        )


class GroqProvider(OpenAICompatibleProvider):
    """Groq (claves que empiezan por ``gsk_``), compatible con OpenAI."""

    def __init__(
        self,
        api_key: str,
        model: str | None = None,
        base_url: str | None = None,
        timeout: float = 45.0,
    ) -> None:
        super().__init__(
            api_key,
            name="groq",
            model=model or os.environ.get("GROQ_MODEL", DEFAULT_MODELS["groq"]),
            base_url=base_url or os.environ.get("GROQ_BASE_URL", DEFAULT_BASE_URLS["groq"]),
            timeout=timeout,
        )


def build_provider() -> AssistantProvider:
    """Elige el proveedor según ``ASSISTANT_PROVIDER`` y las claves presentes.

    Prioridad si no se fuerza nada: xAI → Groq → mock.
    """
    modo = os.environ.get("ASSISTANT_PROVIDER", "").strip().lower()
    xai_key = os.environ.get("XAI_API_KEY", "").strip()
    groq_key = os.environ.get("GROQ_API_KEY", "").strip()

    if modo == "mock":
        return MockProvider()

    if modo == "groq":
        try:
            return GroqProvider(groq_key)
        except ProviderError as exc:
            print(f"[assistant] {exc} Se usará el proveedor mock.")
            return MockProvider()

    if modo == "xai":
        try:
            return XAIProvider(xai_key)
        except ProviderError as exc:
            print(f"[assistant] {exc} Se usará el proveedor mock.")
            return MockProvider()

    if modo and modo not in ("xai", "groq", "mock"):
        print(f"[assistant] ASSISTANT_PROVIDER='{modo}' no es válido; se detectará automáticamente.")

    if xai_key:
        return XAIProvider(xai_key)
    if groq_key:
        return GroqProvider(groq_key)
    return MockProvider()
