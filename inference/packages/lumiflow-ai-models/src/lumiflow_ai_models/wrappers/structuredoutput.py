"""Wrap model methods to return structured output."""

from typing import Type, Optional, Union, Iterator

from pydantic import BaseModel as PydanticBaseModel

from lumiflow_ai_models import cost, parsing
from lumiflow_ai_models.basewrapper import BaseWrapper, ModelOrWrappedModel


class StructuredOutput(BaseWrapper):
    """Wrap model methods to return structured output."""

    def __init__(self, model: ModelOrWrappedModel, output_model: Type[PydanticBaseModel] = None, verbose=False):
        super().__init__(model)
        self.output_model = output_model
        self.verbose = verbose

    def generate(
        self,
        *args,
        output_model: Optional[Type[PydanticBaseModel]] = None,
        cost_context: cost.Tracker.Context = None,
        **kwargs,
    ) -> Union[str, Iterator[str], PydanticBaseModel]:
        cost_context = cost_context or cost.Tracker.Context()
        output_model = output_model or self.output_model
        response = self.model.generate(*args, **kwargs, cost_context=cost_context)
        if output_model:
            try:
                if isinstance(response, str):
                    return parsing.parse_model(response, output_model or self.output_model)
                elif isinstance(response, Iterator):
                    full_response = ""
                    for chunk in response:
                        if self.verbose:
                            print(chunk)
                        full_response += chunk
                    return parsing.parse_model(full_response, output_model or self.output_model)
                elif isinstance(response, PydanticBaseModel):
                    # if response is already a model instance, e.g. because it was already parsed
                    return response
            except Exception as e:
                cost_context.log_entry["status"] = cost.Status.FAIL
                cost_context.log_entry["error"] = f"StructuredOutput: {e}"
                raise e
            message = f"StructuredOutput: Unexpected response type: {type(response)}"
            cost_context.log_entry["status"] = cost.Status.FAIL
            cost_context.log_entry["error"] = message
            raise ValueError(message)
        else:
            return response
