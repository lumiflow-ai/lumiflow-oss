"""Grok model."""

import openai

from lumiflow_ai_models import cost
from lumiflow_ai_models.baseopenai import BaseOpenAI
from lumiflow_ai_models.settings import settings


class Grok(BaseOpenAI):
    """A model using Grok to access a pre-trained model."""

    api_key = None

    @classmethod
    def list(
        cls,
        api_key: str = None,
    ) -> list[str]:
        """List all available models."""
        client = Grok.make_client(api_key)
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
        self._client = Grok.make_client(api_key)

    # noinspection PyUnusedLocal
    @staticmethod
    def make_client(api_key) -> openai.OpenAI:
        api_key = api_key or Grok.api_key or settings.grok_api_key
        return openai.OpenAI(
            api_key=api_key,
            base_url="https://api.x.ai/v1",
        )

    def completions_create(
        self, messages, max_completion_tokens, temperature, top_p, stream=False, stream_options=None, **kwargs
    ):
        response = self._client.chat.completions.create(
            messages=messages,
            model=self.model_id,
            max_completion_tokens=max_completion_tokens,
            temperature=temperature,
            top_p=top_p,
            stream=stream,
            stream_options=stream_options,
            **kwargs,
        )
        return response
