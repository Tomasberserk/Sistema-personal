"""Asistente de voz de Sistema Personal 2.0.

El paquete expone las acciones reales del sistema como herramientas tipadas
para un modelo con *function calling*.  No duplica la lógica de negocio: cada
herramienta llama a la función de endpoint ya existente en ``backend.main``.
"""

from .registry import ToolSpec, build_tools
from .service import AssistantService

__all__ = ["ToolSpec", "build_tools", "AssistantService"]
