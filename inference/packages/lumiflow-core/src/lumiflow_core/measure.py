"""
Various helper functions to measure time.
Context manager to measure the time it takes to run a block of code.
(see https://stackoverflow.com/questions/33987060/python-context-manager-that-measures-time)
"""

import datetime
from time import perf_counter, clock_gettime, CLOCK_MONOTONIC


class time:
    """Measure time

    Args:
      label: The label to display before the elapsed time, otherwise "Time".
      do_print: Whether to print the elapsed time or not. By default, the time is shown when leaving the context.

    Usage:
      To run a function and print the elapsed time:

        with measure.time("my function"):
          my_function()

      To access the time after it was measures:

        with measure.time(print=False) as timing:
          my_function()
        print(f"My function took {timing}")
        print(f"My function took {timing.elapsed} seconds")
    """

    def __init__(self, label: str = None, do_print: bool = True):
        self.label = label
        self.print = do_print
        self._elapsed = None

    def __enter__(self):
        self._elapsed = None
        self.start = perf_counter()
        return self

    def __exit__(self, *exc):
        self._elapsed = perf_counter() - self.start
        if self.print:
            print(self)

    def __repr__(self):
        prefix = self.label or "Time"
        return f"{prefix}: {self.elapsed:.3f} seconds"

    @property
    def elapsed(self):
        return self._elapsed if self._elapsed is not None else perf_counter() - self.start


def uptime() -> float:
    """Get the uptime of the system in seconds."""
    return clock_gettime(CLOCK_MONOTONIC)


def seconds_to_human(seconds) -> str:
    """Convert seconds to a human-readable format."""
    return str(datetime.timedelta(seconds=seconds))
