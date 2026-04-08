"""Base class for AI models using OpenAI API."""

import json
from itertools import tee
from typing import Iterator

import openai

from lumiflow_ai_models import cost
from lumiflow_ai_models.basemodel import BaseModel
from lumiflow_ai_models.exceptions import RateLimitException, ServiceErrorException


class BaseOpenAI(BaseModel):
    """Base class for AI models using OpenAI API."""

    api_key = None
    cost_model_id = None

    def completions_create(
        self, messages, max_completion_tokens, temperature, top_p, stream=False, stream_options=None, **kwargs
    ):
        raise NotImplementedError

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
            cost_type=cost.CostType.TOKEN,
            model_id=self.cost_model_id or f"{self.__class__.__name__.lower()}/{self.model_id}",
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
            if stream:
                streaming_response = self.completions_create(
                    messages=messages,
                    max_completion_tokens=max_new_tokens,
                    temperature=temperature,
                    top_p=top_p,
                    stream=True,
                    stream_options={"include_usage": True},
                    **kwargs,
                )

                def stream_generator(streaming_response):
                    input_tokens = 0
                    output_tokens = 0
                    for chunk in streaming_response:
                        if len(chunk.choices) > 0:
                            if chunk.choices[0].delta:
                                response_text = chunk.choices[0].delta.content or ""
                            else:
                                response_text = ""
                            if response_text:  # Only yield non-empty content
                                yield response_text
                        if chunk.usage:
                            input_tokens = chunk.usage.prompt_tokens
                            output_tokens = chunk.usage.completion_tokens
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
                response = self.completions_create(
                    messages=messages,
                    max_completion_tokens=max_new_tokens,
                    temperature=temperature,
                    top_p=top_p,
                    **kwargs,
                )
                input_tokens = response.usage.prompt_tokens
                output_tokens = response.usage.completion_tokens
                response_text = response.choices[0].message.content
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
            if isinstance(e, openai.APITimeoutError) or isinstance(e, openai.RateLimitError):
                message = f"Too many requests to '{self.model_id}'. Reason: {e}"
                exception_to_raise = RateLimitException(message)
            elif isinstance(e, openai.InternalServerError):
                message = f"Service error from '{self.model_id}'. Reason: {e}"
                exception_to_raise = ServiceErrorException(message)
            else:
                message = f"Can't invoke '{self.model_id}'. Reason: {e}"
                exception_to_raise = e

            self.cost_tracker and self.cost_tracker.generate_end(
                cost_context,
                message_size_bytes=size_bytes,
                extra_data=cost_extra_data,
                status=cost.Status.FAIL,
                error=f"{type(exception_to_raise).__name__}: {exception_to_raise}",
            )
            print(f"ERROR: {message}")
            if exception_to_raise is e:
                raise
            else:
                raise exception_to_raise from e
