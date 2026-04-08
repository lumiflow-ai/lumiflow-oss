"""Base class for all AI models."""

from typing import Iterator

from lumiflow_ai_models import cost


class BaseModel:
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
    ):
        """Initialize a new model.
        Args:
            model_id (str): The identifier of the model to use.
            label (str): An optional arbitrary label for the model.
            print_response (bool): Whether to print every response from the model.
            cost_tracker (CostTracker): The cost tracker to use for tracking costs; otherwise, use the default cost
                tracker.
        """
        self.model_id = model_id
        self.label = label or model_id
        self.print_response = print_response
        self.cost_tracker = cost_tracker or cost.DEFAULT_TRACKER

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
        """Generate text from one message.
        Args:
            message: The message to send to the model.
            stream: Whether to stream the response or not.
            max_new_tokens: The maximum number of tokens to generate.
            temperature: The temperature to use for sampling.
            top_p: The top-p value to use for sampling.
            cost_context: The cost tracker context to use for tracking costs.
                If not provided, a new context will be created.
            cost_extra_data: Additional data to include in the cost tracking.
            **kwargs: Additional keyword arguments to pass to the model. Those argument maybe model-specific,
                thus might not be supported by all models.
        """
        raise NotImplementedError

    def __repr__(self):
        class_name = self.__class__.__name__
        return f"<{class_name}({self.label})>"
