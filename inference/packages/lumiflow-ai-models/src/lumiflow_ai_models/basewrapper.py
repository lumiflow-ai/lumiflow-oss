"""Base wrapper for AI models."""

from functools import wraps
from typing import Union

from lumiflow_ai_models.basemodel import BaseModel as LLMBaseModel

ModelOrWrappedModel = Union[LLMBaseModel, "BaseWrapper"]


class BaseWrapper:
    """Abstract base class for model wrappers."""

    def __init__(self, model: ModelOrWrappedModel):
        self.model = model

    # noinspection PyMethodMayBeStatic
    def _wrap(self, func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            return func(*args, **kwargs)

        return wrapper

    def __getattr__(self, name):
        attr = getattr(self.model, name)
        if callable(attr):
            return self._wrap(attr)  # Wrap only methods
        return attr

    def __setattr__(self, name, value):
        if name == "cost_tracker":
            setattr(self.model, name, value)
        else:
            super().__setattr__(name, value)
