"""
A model that runs a function and returns its returned value.
This is useful for testing or calling an external system.
"""

from typing import Callable, Iterable, Iterator

from lumiflow_ai_models import cost
from lumiflow_ai_models.basemodel import BaseModel


class Func(BaseModel):
    """
    A model that runs a function and returns its returned value.
    Useful for testing or calling an external system.
    """

    def __init__(
        self,
        function: Callable[[str], str] | Callable[[str], Iterable[str]],
        model_id: str = "func",
        label: str = None,
        print_response: bool = False,
        cost_tracker: cost.Tracker = None,
        cost: cost.CostType = None,
    ):
        """Initialize a new model.
        Args:
            function: The function to run.
            label: An optional label for the model.
            print_response: Whether to print every response from the model.
            cost_tracker: The cost tracker to use for tracking costs.
        """
        super().__init__(model_id, label, print_response, cost_tracker)
        self.function = function
        self.cost = cost

    def generate(
        self,
        message: str,
        stream: bool = False,
        max_new_tokens: int = None,
        temperature: float = None,
        top_p: float = None,
        cost_context: cost.Tracker.Context = None,
        cost_extra_data: dict = None,
        **kwargs,
    ) -> str | Iterator[str]:
        cost_context = self.cost_tracker and self.cost_tracker.generate_start(
            cost_type=self.cost,
            model_id=self.label,
            model_class=self.__class__.__name__.lower(),
            context=cost_context,
        )
        size_bytes = len(message.encode("utf-8"))
        try:
            response = self.function(message, **kwargs)
            if isinstance(response, str):
                size_bytes += len(response.encode("utf-8"))
                self.cost_tracker and self.cost_tracker.generate_end(
                    cost_context,
                    input_tokens=len(message),
                    output_tokens=len(response),
                    message_size_bytes=size_bytes,
                    status=cost.Status.SUCCESS,
                    extra_data=cost_extra_data,
                )
                return response if not stream else iter([response])

            elif isinstance(response, Iterable):  # Handle the streaming case

                def stream_generator(response, size_bytes):
                    length = 0
                    for chunk in response:
                        size_bytes += len(chunk.encode("utf-8"))
                        length += len(chunk)
                        yield chunk
                    self.cost_tracker and self.cost_tracker.generate_end(
                        cost_context,
                        input_tokens=len(message),
                        output_tokens=length,
                        message_size_bytes=size_bytes,
                        status=cost.Status.SUCCESS,
                        extra_data=cost_extra_data,
                    )

                return stream_generator(response, size_bytes)

            else:
                raise TypeError("Function must return either a string or an iterator of strings.")
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
