from .anthropic import Anthropic
from .bedrock import Bedrock
from .func import Func
from .grok import Grok
from .ollama import Ollama
from .openai import OpenAI
from .vertexai import VertexAI

__all__ = [
    "Anthropic",
    "Bedrock",
    "Func",
    "Grok",
    "Ollama",
    "OpenAI",
    "VertexAI",
]


def model_from(model_name, model_id, **kwargs):
    """Create a model instance from a model name and model ID."""
    model_name = model_name.lower()
    if model_name == "anthropic":
        return Anthropic(model_id=model_id, **kwargs)
    if model_name == "bedrock":
        return Bedrock(model_id=model_id, **kwargs)
    if model_name == "func":
        return Func(model_id=model_id, **kwargs)
    if model_name == "grok":
        return Grok(model_id=model_id, **kwargs)
    if model_name == "ollama":
        return Ollama(model_id=model_id, **kwargs)
    if model_name == "openai":
        return OpenAI(model_id=model_id, **kwargs)
    if model_name == "vertexai":
        return VertexAI(model_id=model_id, **kwargs)

    raise ValueError(f"Unknown model name: {model_name}")
