"""AWS Bedrock model."""

import json
import threading
from itertools import tee
from typing import Iterator

import boto3

from lumiflow_ai_models import cost
from lumiflow_ai_models.basemodel import BaseModel
from lumiflow_ai_models.exceptions import RateLimitException, ServiceErrorException

REGION_NAME = "us-east-1"


def _extract_text(value) -> str:
    """Extract model-visible text from Bedrock response fragments."""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "".join(_extract_text(item) for item in value)
    if isinstance(value, dict):
        if "text" in value:
            return _extract_text(value.get("text"))
        return ""
    return ""


class Bedrock(BaseModel):
    """A model using the AWS Bedrock service to load a pre-trained model."""

    region_name = REGION_NAME

    @classmethod
    def list(cls, region_name: str = None) -> dict[str, str]:
        """List all available models."""
        region_name = region_name or cls.region_name
        if region_name != REGION_NAME:
            print(f"Region name '{region_name}'")
        bedrock = boto3.client(service_name="bedrock", region_name=region_name)
        return {
            model.get("modelId"): f"{model.get('providerName')} {model.get('modelName')}"
            for model in bedrock.list_foundation_models().get("modelSummaries", [])
            if (
                model.get("modelLifecycle", {}).get("status") == "ACTIVE"
                and "ON_DEMAND" in model.get("inferenceTypesSupported", [])
            )
        }

    def __init__(
        self,
        model_id: str,
        label: str = None,
        print_response: bool = False,
        cost_tracker: cost.Tracker = None,
        region_name: str = None,
        timeout: int = None,
    ):
        super().__init__(model_id, label, print_response, cost_tracker)
        region_name = region_name or self.__class__.region_name
        if region_name != REGION_NAME:
            print(f"Region name '{region_name}'")
        self._brt = boto3.client("bedrock-runtime", region_name=region_name)
        self.timeout = timeout

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
            model_id="bedrock/" + self.model_id,
            model_class=self.__class__.__name__.lower(),
            context=cost_context,
        )
        messages = [
            {
                "role": "user",
                "content": [{"text": message}],
            }
        ]
        size_bytes = len(json.dumps(messages).encode("utf-8"))
        try:
            inference_config = {"maxTokens": max_new_tokens, "temperature": temperature, "topP": top_p}
            inference_config.update(**kwargs)
            inference_config = {k: v for k, v in inference_config.items() if v is not None}

            if stream:
                obj = {}  # to store the timeout object

                def threading_timeout_handler():
                    obj["timeout"] = True
                    p = obj["stream"]
                    del obj["stream"]
                    p.close()

                streaming_response = self._brt.converse_stream(
                    modelId=self.model_id,
                    messages=messages,
                    inferenceConfig=inference_config,
                )["stream"]

                obj["stream"] = streaming_response

                timer = None
                if self.timeout:
                    timer = threading.Timer(self.timeout or 0, threading_timeout_handler)
                    timer.start()

                def stream_generator(streaming_response, size_bytes):
                    try:
                        for chunk in streaming_response:
                            if "contentBlockDelta" in chunk:
                                delta = chunk["contentBlockDelta"].get("delta", {})
                                text = _extract_text(delta)
                                if text:
                                    text_size = len(text.encode("utf-8"))
                                    size_bytes += text_size
                                    yield text
                            if "metadata" in chunk:
                                metadata = chunk["metadata"]
                                input_tokens = metadata["usage"]["inputTokens"]
                                output_tokens = metadata["usage"]["outputTokens"]
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
                    output_generator, print_generator = tee(stream_generator(streaming_response, size_bytes), 2)
                    for chunk in print_generator:
                        print(chunk)
                else:
                    output_generator = stream_generator(streaming_response, size_bytes)
                return output_generator

            else:  # non-streaming
                if self.timeout:
                    print("Timeout not supported for non-streaming mode")
                response = self._brt.converse(
                    modelId=self.model_id,
                    messages=messages,
                    inferenceConfig=inference_config,
                )
                content_blocks = response["output"]["message"].get("content", [])
                response_text = "".join(_extract_text(block) for block in content_blocks)

                input_tokens = response["usage"]["inputTokens"]
                output_tokens = response["usage"]["outputTokens"]
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
            if isinstance(e, self._brt.exceptions.ThrottlingException) or isinstance(
                e, self._brt.exceptions.ServiceQuotaExceededException
            ):
                message = f"Too many requests to '{self.model_id}'. Reason: {e}"
                exception_to_raise = RateLimitException(message)
            elif isinstance(e, self._brt.exceptions.ModelStreamErrorException) or isinstance(
                e, self._brt.exceptions.ServiceUnavailableException
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
