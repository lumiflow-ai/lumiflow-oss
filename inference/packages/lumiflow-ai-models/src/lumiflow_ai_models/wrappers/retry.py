"""Retry wrapper for retrying model method calls with backoff and jitter support."""

import random
import sys
import time
from functools import wraps
from typing import Callable, Optional, ParamSpec, TypeVar

from lumiflow_ai_models.basewrapper import BaseWrapper, ModelOrWrappedModel

P = ParamSpec("P")
R = TypeVar("R")


class Retry(BaseWrapper):
    """Wrap model methods with retry logic and support for backoff and jitter."""

    def __init__(
        self,
        model: ModelOrWrappedModel,
        retries=3,
        raise_after_retries=False,
        raise_last_exception: bool = False,
        exceptions_to_catch: Optional[list[type[BaseException]]] = None,
        backoff: float = 0.0,
        backoff_max: float = None,
        jitter: float = 0.0,
        label: str | None = None,
        verbose: bool = False,
    ):
        """
        Initialize the Retry wrapper.
        Args:
            model: Model or wrapped model to apply retries to.
            retries: Number of retries to attempt before giving up. If negative, will retry indefinitely.
            raise_after_retries: If True, raises an exception after the last retry;
                otherwise, returns None and the last error.
            raise_last_exception: If True, re-raises the last caught exception after retries are exhausted.
            exceptions_to_catch: List of exception types to catch and retry on. Defaults to catching all exceptions.
            backoff: Base backoff time in seconds before retrying. If 0, retries immediately.
            backoff_max: Maximum backoff time in seconds. If None, no maximum is applied.
            jitter: Additional random jitter in seconds to add to the backoff time. Default to 0.
            verbose: If True, print retry attempts and backoff times.
        """
        super().__init__(model)
        self.retries = retries if retries >= 0 else sys.maxsize
        self.raise_after_retries = raise_after_retries
        self.raise_last_exception = raise_last_exception
        self.exceptions_to_catch = exceptions_to_catch or [BaseException]
        self.backoff = backoff
        self.backoff_max = backoff_max if backoff_max is not None else float("inf")
        self.jitter = jitter
        self.label = label
        self.verbose = verbose
        if verbose:
            print(f"{self._prefix()} Retrying with backoff={backoff} (max={backoff_max}) and jitter={jitter}")

    def _prefix(self) -> str:
        if self.label is not None:
            return f"Retry ({self.label})"
        return "Retry"

    def _wrap(self, func: Callable[P, R]) -> Callable[P, tuple[R | None, None | str] | R]:
        """Wrap ``func`` with retry behavior.

        Returns the wrapped result directly when nesting ``Retry`` wrappers.
        Otherwise returns ``(result, error)``, where ``error`` is ``None`` on
        success and a string describing the last failure once retries are
        exhausted.
        """

        @wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> tuple[R | None, None | str] | R:
            last_error = None
            last_exception = None
            for attempt in range(1 + self.retries):
                try:
                    if isinstance(self.model, Retry):
                        return func(*args, **kwargs)
                    else:
                        return func(*args, **kwargs), None
                except tuple(self.exceptions_to_catch) as e:
                    if self.verbose:
                        print(f"{self._prefix()} Attempt {attempt} failed: {e}")
                    last_error = str(e)
                    last_exception = e
                    if attempt < self.retries:
                        sleep_time = self.backoff * (2**attempt)
                        if self.backoff_max is not None:
                            sleep_time = min(sleep_time, self.backoff_max)
                        if self.jitter > 0:
                            sleep_time += random.uniform(0, self.jitter)
                        if sleep_time > 0:
                            if self.verbose:
                                print(f"{self._prefix()} Retrying in {sleep_time:.2f} seconds...")
                            time.sleep(sleep_time)
                        elif self.verbose:
                            print(f"{self._prefix()} Retrying immediately...")
            if self.raise_last_exception and last_exception is not None:
                raise last_exception
            if self.raise_after_retries:
                raise RuntimeError(f"Failed after {1 + self.retries} attempts.")
            else:
                print(f"{self._prefix()} Failed after {1 + self.retries} attempts.")
                return None, last_error

        return wrapper
