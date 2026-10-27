"""Selección del proveedor del asistente (sin llamadas de red)."""

import pytest

from backend.assistant.providers import (
    GroqProvider,
    MockProvider,
    XAIProvider,
    build_provider,
)

VARIABLES = (
    "ASSISTANT_PROVIDER",
    "XAI_API_KEY",
    "GROQ_API_KEY",
    "XAI_MODEL",
    "GROQ_MODEL",
    "XAI_BASE_URL",
    "GROQ_BASE_URL",
)


@pytest.fixture(autouse=True)
def entorno_limpio(monkeypatch):
    for variable in VARIABLES:
        monkeypatch.delenv(variable, raising=False)


def test_sin_claves_usa_mock():
    assert isinstance(build_provider(), MockProvider)


def test_groq_se_detecta_automaticamente(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_prueba")
    provider = build_provider()
    assert isinstance(provider, GroqProvider)
    assert provider.name == "groq"
    assert provider.base_url == "https://api.groq.com/openai/v1"
    assert provider.model == "openai/gpt-oss-120b"


def test_xai_tiene_prioridad_si_hay_dos_claves(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_prueba")
    monkeypatch.setenv("XAI_API_KEY", "xai-prueba")
    provider = build_provider()
    assert isinstance(provider, XAIProvider)
    assert provider.name == "xai"


def test_proveedor_forzado_a_groq(monkeypatch):
    monkeypatch.setenv("ASSISTANT_PROVIDER", "groq")
    monkeypatch.setenv("GROQ_API_KEY", "gsk_prueba")
    monkeypatch.setenv("XAI_API_KEY", "xai-prueba")
    provider = build_provider()
    assert isinstance(provider, GroqProvider)


def test_forzado_sin_clave_cae_en_mock(monkeypatch):
    monkeypatch.setenv("ASSISTANT_PROVIDER", "groq")
    assert isinstance(build_provider(), MockProvider)


def test_modelo_personalizado(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_prueba")
    monkeypatch.setenv("GROQ_MODEL", "openai/gpt-oss-20b")
    assert build_provider().model == "openai/gpt-oss-20b"


def test_base_url_personalizada(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_prueba")
    monkeypatch.setenv("GROQ_BASE_URL", "https://proxy.local/v1/")
    assert build_provider().base_url == "https://proxy.local/v1"
