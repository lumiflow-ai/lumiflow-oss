"""Pacer wrapper to control the pace of requests across multiple models."""

import threading
import time
from typing import Optional, Any

from lumiflow_ai_models.basewrapper import BaseWrapper, ModelOrWrappedModel
from lumiflow_ai_models.exceptions import RateLimitException


class PacerContext:
    def __init__(
        self,
        label: str | None = None,
        initial_delay: float = 0.0,
        min_delay: float = 0.0,
        max_delay: float = 20.0,
        decay: float = 0.9,
        increment: float = 1.0,
    ):
        """
        Initializes a PacerContext to manage delays for a group of models.
        Args:
            label: Optional label for the group.
            initial_delay: Initial delay in seconds before the first request.
            min_delay: Minimum delay in seconds.
            max_delay: Maximum delay in seconds.
            decay: Factor by which to reduce the delay after a successful request.
            increment: Amount to increase the delay after an exception.
        """
        self.label = label
        self.delay = initial_delay
        self.delay_lock = threading.Lock()
        self.min_delay = min_delay
        self.max_delay = max_delay
        self.decay = decay
        self.increment = increment


DEFAULT_PACER_CONTEXT = PacerContext(label="default")


class Pacer(BaseWrapper):
    """Wrap model methods to control the pace of requests globally across all instances."""

    def __init__(
        self,
        model: ModelOrWrappedModel,
        context: PacerContext = DEFAULT_PACER_CONTEXT,
        exceptions_to_catch: Optional[list[type[Exception]]] = None,
        verbose: bool = False,
    ):
        """
        Initializes the Pacer wrapper.
        Args:
            model: Model or wrapped model to apply pacing to.
            context: PacerContext instance tracking delays and settings.
            exceptions_to_catch: List of exception types that should trigger pacing. Defaults to [RateLimitException].
            verbose (bool): If True, prints pacing-related messages.
        """
        super().__init__(model)
        self.context = context
        self.exceptions_to_catch = exceptions_to_catch or [RateLimitException]
        self.verbose = verbose

    def _prefix(self) -> str:
        if self.context != DEFAULT_PACER_CONTEXT and self.context.label is not None:
            return f"Pacer ({self.context.label})"
        return "Pacer"

    def _update_delay(self, exception_caught: Optional[Exception] = None):
        with self.context.delay_lock:
            current_delay = self.context.delay
            if exception_caught:
                new_delay = min(current_delay + self.context.increment, self.context.max_delay)
                if self.verbose:
                    print(
                        f"{self._prefix()}: Increasing delay from {current_delay:.2f}s "
                        f"to {new_delay:.2f}s caused by: {exception_caught}."
                    )
            else:
                new_delay = max(self.context.min_delay, current_delay * self.context.decay)
                if self.verbose:
                    print(f"{self._prefix()}: Decreasing delay from {current_delay:.2f}s to {new_delay:.2f}s.")
            self.context.delay = new_delay

    def generate(
        self,
        *args,
        **kwargs,
    ) -> Any:
        with self.context.delay_lock:
            delay = self.context.delay

        if self.verbose:
            print(f"{self._prefix()}: Waiting for {delay:.2f}s")
        time.sleep(delay)

        try:
            response = self.model.generate(*args, **kwargs)
            self._update_delay(exception_caught=None)
        except tuple(self.exceptions_to_catch) as e:
            self._update_delay(exception_caught=e)
            raise

        return response
