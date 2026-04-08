"""Ollama model."""

import json
from itertools import tee
from typing import Any, Iterator

from ollama import Client

from lumiflow_ai_models import cost
from lumiflow_ai_models.basemodel import BaseModel
from lumiflow_ai_models.settings import settings

OLLAMA_HOST = "http://localhost:11434"
OLLAMA_TIMEOUT = 300


class Ollama(BaseModel):
    """A model using Ollama to access a pre-trained model."""

    host = OLLAMA_HOST
    api_key = None

    @classmethod
    def list(
        cls,
        host=None,
        api_key: str = None,
    ) -> list[Any]:
        """List all available models."""
        client = cls.make_client(Client, host, api_key)
        return [model.model for model in client.list().models]

    def __init__(
        self,
        model_id: str,
        label: str = None,
        print_response: bool = False,
        cost_tracker: cost.Tracker = None,
        host: str = None,
        api_key: str = None,
    ):
        super().__init__(model_id, label, print_response, cost_tracker)
        self._client = self.make_client(Client, host, api_key)

    # noinspection PyUnusedLocal
    @staticmethod
    def make_client(cls, host, api_key):
        api_key = api_key or Ollama.api_key or settings.ollama_api_key
        host = host or Ollama.host or settings.ollama_host
        return Client(
            host=host,
            headers={"API-Key": api_key} if api_key else {},
            timeout=OLLAMA_TIMEOUT,
        )

    def generate(
        self,
        message: str,
        stream: bool = False,
        max_new_tokens=None,
        temperature=None,
        top_p=None,
        cost_context: cost.Tracker.Context = None,
        cost_extra_data: dict = None,
        **kwargs,
    ) -> str | Iterator[str]:
        cost_context = self.cost_tracker and self.cost_tracker.generate_start(
            cost_type=cost.CostType.TIME,
            model_id="ollama/" + self.model_id,
            model_class=self.__class__.__name__.lower(),
            context=cost_context,
        )
        messages = [
            {
                "role": "user",
                "content": message,
            }
        ]

        # This very rough back of the napkin estimation.  To get an accurate number, we would need to modify
        # Ollama code.
        size_bytes = len(json.dumps(messages).encode("utf-8"))

        options = {
            "temperature": temperature,
            "top_p": top_p,
            **kwargs,
        }
        try:
            if stream:
                streaming_response = self._client.chat(
                    model=self.model_id,
                    messages=messages,
                    options=options,
                    stream=True,
                )

                def stream_generator(streaming_response):
                    input_tokens = 0
                    output_tokens = 0
                    for chunk in streaming_response:
                        response_text = chunk.message.content
                        input_tokens = chunk.prompt_eval_count
                        output_tokens = chunk.eval_count
                        yield response_text
                    self.cost_tracker and self.cost_tracker.generate_end(
                        cost_context,
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        message_size_bytes=size_bytes,
                        status=cost.Status.SUCCESS,
                        extra_data=cost_extra_data,
                    )

                if self.print_response:
                    output_generator, print_generator = tee(stream_generator(streaming_response), 2)
                    for chunk in print_generator:
                        print(chunk)
                else:
                    output_generator = stream_generator(streaming_response)
                return output_generator

            else:  # non-streaming
                response = self._client.chat(
                    model=self.model_id,
                    messages=messages,
                    options=options,
                )
                input_tokens = response.prompt_eval_count
                output_tokens = response.eval_count
                self.cost_tracker and self.cost_tracker.generate_end(
                    cost_context,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    message_size_bytes=size_bytes,
                    status=cost.Status.SUCCESS,
                    extra_data=cost_extra_data,
                )
                response_text = response.message.content
                if self.print_response:
                    print(response_text)
                return response_text
        except Exception as e:
            self.cost_tracker and self.cost_tracker.generate_end(
                cost_context,
                message_size_bytes=size_bytes,
                extra_data=cost_extra_data,
                status=cost.Status.FAIL,
                error=f"{type(e).__name__}: {e}",
            )
            print(f"ERROR: Can't invoke '{self.model_id}'. Reason: {e}")
            raise e
