"""Vertex AI model."""

import threading
from itertools import tee
from typing import Iterator, Type, Dict, Any

import google.api_core.exceptions as google_exceptions
from google import genai
from google.genai.types import HttpOptions
from pydantic import BaseModel as PydanticBaseModel

from lumiflow_ai_models import cost
from lumiflow_ai_models.basemodel import BaseModel
from lumiflow_ai_models.exceptions import RateLimitException, ServiceErrorException, ProhibitedContentException
from lumiflow_ai_models.gcp import check_gcp_authentication
from lumiflow_ai_models.parsing import unstrip_model_instance, strip_model

LOCATION = "us-central1"
PROJECT_ID = ""


class VertexAI(BaseModel):
    """A model using Vertex AI to access a pre-trained model."""

    @classmethod
    def list(cls) -> list[str]:
        """List all available models."""
        raise NotImplementedError

    def __init__(
        self,
        model_id: str,
        label: str = None,
        print_response: bool = False,
        cost_tracker: cost.Tracker = None,
        location: str = LOCATION,
        project_id: str = PROJECT_ID,
        timeout: int = None,
    ):
        super().__init__(model_id, label, print_response, cost_tracker)
        self.client = genai.Client(
            http_options=HttpOptions(api_version="v1"), vertexai=True, project=project_id, location=location
        )
        self.timeout = timeout
        check_gcp_authentication()

    def generate(
        self,
        message: str,
        output_model: Type[PydanticBaseModel] = None,
        stream: bool = False,
        max_new_tokens: int = None,
        temperature: float = None,
        top_p: float = None,
        cost_context: cost.Tracker.Context = None,
        cost_extra_data: dict = None,
        **kwargs,
    ) -> str | Iterator[str]:
        cost_context = self.cost_tracker and self.cost_tracker.generate_start(
            cost_type=cost.CostType.TOKEN,
            model_id="vertexai/" + self.model_id,
            model_class=self.__class__.__name__.lower(),
            context=cost_context,
        )

        config_kwargs: Dict[str, Any] = {
            "max_output_tokens": max_new_tokens,
            "temperature": temperature,
            "top_p": top_p,
            # "top_k": top_k,
        }
        config_kwargs = {k: v for k, v in config_kwargs.items() if v is not None}
        if output_model is not None:
            config_kwargs["response_mime_type"] = "application/json"
            # Strip the Pydantic models Fields because google genai does not work with extra data (e.g. examples)
            config_kwargs["response_schema"] = strip_model(output_model)
        config = genai.types.GenerateContentConfig(**config_kwargs)

        size_bytes = len(message.encode("utf-8"))

        try:
            if stream and not output_model:  # Note: streaming with output_model is not supported
                obj = {}  # to store the timeout object

                def threading_timeout_handler():
                    obj["timeout"] = True
                    p = obj["stream"]
                    del obj["stream"]
                    p.close()

                streaming_response = self.client.models.generate_content_stream(
                    model=self.model_id,
                    contents=message,
                    config=config,
                )

                obj["stream"] = streaming_response

                timer = None
                if self.timeout:
                    timer = threading.Timer(self.timeout or 0, threading_timeout_handler)
                    timer.start()

                def stream_generator(streaming_response):
                    try:
                        input_tokens = 0
                        output_tokens = 0
                        size_bytes = 0

                        for chunk in streaming_response:
                            input_tokens = chunk.usage_metadata.prompt_token_count or input_tokens
                            output_tokens = (
                                (chunk.usage_metadata.total_token_count or 0) - input_tokens
                            ) or output_tokens
                            size_bytes += len(chunk.text.encode("utf-8"))
                            yield chunk.text

                        self.cost_tracker and self.cost_tracker.generate_end(
                            cost_context,
                            input_tokens=input_tokens,
                            output_tokens=output_tokens,
                            message_size_bytes=size_bytes,
                            status=cost.Status.SUCCESS,
                            extra_data=cost_extra_data,
                        )
                    except Exception as e:
                        if "timeout" not in obj:
                            raise e
                    timer and timer.cancel()
                    if "timeout" in obj:
                        raise Exception("Timeout exceeded")

                if self.print_response:
                    output_generator, print_generator = tee(stream_generator(streaming_response), 2)
                    for chunk in print_generator:
                        print(chunk)
                else:
                    output_generator = stream_generator(streaming_response)
                return output_generator

            else:  # non-streaming
                response = self.client.models.generate_content(
                    model=self.model_id,
                    contents=message,
                    config=config,
                )

                if response.text is None:
                    if response.candidates[0].finish_reason == genai.types.FinishReason.PROHIBITED_CONTENT:
                        raise ProhibitedContentException(f"Prohibited content: {response.candidates[0].finish_message}")
                    else:
                        raise ValueError(f"Model '{self.model_id}' response is None. ")

                input_tokens = response.usage_metadata.prompt_token_count
                output_tokens = response.usage_metadata.total_token_count - input_tokens
                size_bytes += len(response.text.encode("utf-8"))
                self.cost_tracker and self.cost_tracker.generate_end(
                    cost_context,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    message_size_bytes=size_bytes,
                    status=cost.Status.SUCCESS,
                    extra_data=cost_extra_data,
                )

                if self.print_response:
                    print(response.text)

                if output_model is not None:
                    return unstrip_model_instance(response.parsed, output_model)
                return response.text

        except Exception as e:
            if isinstance(e, google_exceptions.TooManyRequests) or isinstance(e, google_exceptions.ResourceExhausted):
                message = f"Too many requests to '{self.model_id}'. Reason: {e}"
                exception_to_raise = RateLimitException(message)
            elif (
                isinstance(e, google_exceptions.ServerError)
                or isinstance(e, google_exceptions.InternalServerError)
                or isinstance(e, google_exceptions.ServiceUnavailable)
            ):
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
