"""Anthropic model."""

import json
from itertools import tee
from typing import Iterator

import anthropic

from lumiflow_ai_models import cost
from lumiflow_ai_models.basemodel import BaseModel
from lumiflow_ai_models.settings import settings


class Anthropic(BaseModel):
    api_key = None

    @classmethod
    def list(
        cls,
        api_key: str = None,
    ) -> list[str]:
        client = cls.make_client(api_key)
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
        self._client = self.make_client(api_key)

    # noinspection PyUnusedLocal
    @staticmethod
    def make_client(api_key):
        api_key = api_key or Anthropic.api_key or settings.anthropic_api_key
        return anthropic.Anthropic(api_key=api_key)

    def generate(
        self,
        message: str,
        stream: bool = False,
        max_new_tokens: int = 4096,
        temperature: float = None,
        top_p: float = None,
        cost_context: cost.Tracker.Context = None,
        cost_extra_data: dict = None,
        **kwargs,
    ) -> str | Iterator[str]:
        cost_context = self.cost_tracker and self.cost_tracker.generate_start(
            cost_type=cost.CostType.TOKEN,
            model_id=f"{self.__class__.__name__.lower()}/{self.model_id}",
            model_class=self.__class__.__name__.lower(),
            context=cost_context,
        )
        messages = [
            {
                "role": "user",
                "content": message,
            }
        ]
        size_bytes = len(json.dumps(messages).encode("utf-8"))
        try:
            arguments = {
                k: v
                for k, v in {
                    "messages": messages,
                    "max_tokens": max_new_tokens,
                    "temperature": temperature,
                    "top_p": top_p,
                    "model": self.model_id,
                    **kwargs,
                }.items()
                if v is not None
            }

            if stream:
                try:
                    # we need to ensure network connection errors (e.g., 429) are handled here
                    # so we will force the stream manager to be created and entered here
                    # instead of using `with ... as stream`
                    # we don't forget to close the stream below when the generator is done
                    stream_manager = self._client.messages.stream(**arguments)
                    streaming_response = stream_manager.__enter__()
                except Exception as e:
                    print(f"ERROR opening stream: {e}")
                    raise e

                def stream_generator():
                    input_tokens = 0
                    output_tokens = 0
                    nonlocal size_bytes
                    try:
                        with streaming_response as stream:
                            for chunk in stream:
                                if chunk.type == "text":
                                    text = chunk.text
                                    nonlocal size_bytes
                                    size_bytes += len(text.encode("utf-8"))
                                    yield text
                                elif chunk.type == "message_stop":
                                    input_tokens = chunk.message.usage.input_tokens
                                    output_tokens = chunk.message.usage.output_tokens
                        self.cost_tracker and self.cost_tracker.generate_end(
                            cost_context,
                            input_tokens=input_tokens,
                            output_tokens=output_tokens,
                            message_size_bytes=size_bytes,
                            status=cost.Status.SUCCESS,
                            extra_data=cost_extra_data,
                        )
                    except Exception as e:
                        raise e
                    finally:
                        # close the stream manager we opened manually above
                        stream_manager.__exit__(None, None, None)

                if self.print_response:
                    output_generator, print_generator = tee(stream_generator(), 2)
                    for chunk in print_generator:
                        print(chunk)
                else:
                    output_generator = stream_generator()
                return output_generator

            else:  # non-streaming
                response = self._client.messages.create(
                    **arguments,
                )
                input_tokens = response.usage.input_tokens
                output_tokens = response.usage.output_tokens
                response_text = response.content[0].text
                size_bytes += len(response_text.encode("utf-8"))
                self.cost_tracker and self.cost_tracker.generate_end(
                    cost_context,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    message_size_bytes=size_bytes,
                    status=cost.Status.SUCCESS,
                    extra_data=cost_extra_data,
                )
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

    def __repr__(self):
        class_name = self.__class__.__name__
        return f"<{class_name}({self.label})>"
