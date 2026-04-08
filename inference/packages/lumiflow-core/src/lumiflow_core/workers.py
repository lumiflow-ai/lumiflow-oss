"""
Functions to help with worker functions.
"""

import inspect
from functools import wraps

from lumiflow_core import output


def worker(
    verbose: bool = False,
    raise_on_error: bool = False,
    max_retries: int = 0,
):
    """
    Decorator for worker functions that prints progress and handles exceptions.
    Args:
        verbose: whether to print progress messages.
        raise_on_error: whether to raise exceptions or return None on error.
        max_retries: the number of times to retry the worker function on error.
    Returns:
        A decorator function that can be used to decorate worker functions.

    Note:
        The decorated function must accept a single argument, which is a tuple of the form (task, *args).
        The task is used to identify the item being processed, and the rest of the arguments are passed to the worker
            function.
        It may also accept an additional 'verbose' keyword argument.
        The worker function should return the result of processing the item.

    Example:
        Use it as a decorator:

        ```
        @worker(verbose=True)
        def w(arg):
            task, item = arg
            # Do something
            return result
        ```

    Example:
        Use it as a decorator with default arguments:

        ```
        @worker
        def w(arg):
            task, item = arg
            # Do something
            return result
        ```

    Example:
        Use it to wrap a function:

        ```
        def w(arg):
            task, item = arg
            # Do something
            return result


        w = worker(verbose=True)(w)
        ```
    """

    def decorator(func):
        func_params = inspect.signature(func).parameters
        func_supports_verbose = "verbose" in func_params

        @wraps(func)
        def wrapper(*args, **kwargs):
            task, *_ = args[0]

            if verbose:
                print(f"Worker processing task {task}")

            retry = 0
            while retry <= max_retries:
                try:
                    kwargs = {**kwargs, **{"verbose": verbose}} if func_supports_verbose else kwargs
                    result = func(*args, **kwargs)
                    if verbose:
                        print(f"Worker processed task {task}")
                    return result
                except Exception as e:
                    output.print_error(f"Worker failed to process task {task}: ", e, args, kwargs)
                    if raise_on_error:
                        raise e
                    retry += 1
                    if retry <= max_retries:
                        output.print_error(f"Worker retrying task {task}, retry {retry}")

            if max_retries > 0:
                output.print_error(f"Worker retries exhausted for task {task}")
            return None

        wrapper._is_worker_decorated = True
        return wrapper

    # Allow the decorator to be used as a regular function
    if callable(verbose):  # If `verbose` is a function, treat it as `@decorator`
        func = verbose
        return decorator(func)

    return decorator


def is_worker_decorated(func: callable):
    return getattr(func, "_is_worker_decorated", False)
