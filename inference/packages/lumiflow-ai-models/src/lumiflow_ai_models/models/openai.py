"""OpenAI model."""

import openai

from lumiflow_ai_models import cost
from lumiflow_ai_models.baseopenai import BaseOpenAI
from lumiflow_ai_models.settings import settings


class OpenAI(BaseOpenAI):
    """A model using OpenAI to access a pre-trained model."""

    @classmethod
    def list(
        cls,
        api_key: str = None,
    ) -> list[str]:
        """List all available models."""
        client = OpenAI.make_client(api_key)
        return [model.id for model in client.models.list()]

    def __init__(
        self,
        model_id: str,
        label: str = None,
        print_response: bool = False,
        cost_tracker: cost.Tracker = None,
        api_key: str = None,
    ):
        super().__init__(model_id, label, print_response, cost_tracker)
        self._client = OpenAI.make_client(api_key)

    # noinspection PyUnusedLocal
    @staticmethod
    def make_client(api_key) -> openai.OpenAI:
        api_key = api_key or OpenAI.api_key or settings.openai_api_key
        return openai.OpenAI(api_key=api_key)

    def completions_create(
        self, messages, max_completion_tokens, temperature, top_p, stream=False, stream_options=None, **kwargs
    ):
        # Build parameters dict, filtering out None values for certain models
        params = {
            "messages": messages,
            "model": self.model_id,
            "stream": stream,
        }

        # Add parameters only if they're not None
        if max_completion_tokens is not None:
            params["max_completion_tokens"] = max_completion_tokens
        if temperature is not None:
            params["temperature"] = temperature
        if top_p is not None:
            params["top_p"] = top_p
        if stream_options is not None:
            params["stream_options"] = stream_options

        # Add any additional kwargs
        params.update(kwargs)

        response = self._client.chat.completions.create(**params)
        return response
