"""
This module provides an Executor class that can execute a worker function on a dataset using different execution types.
"""

import multiprocessing as mp
import queue
import threading
from concurrent.futures import as_completed, ThreadPoolExecutor, ProcessPoolExecutor
from enum import Enum
from typing import Callable, Iterable, Tuple, TypeVar

from tqdm import tqdm

from lumiflow_core.iterators import ThreadSafeIterator

D = TypeVar("D")
R = TypeVar("R")


class WorkerExecutionType(Enum):
    """
    Type of execution for the executor, either synchronous (SEQUENTIAL) or asynchronous (THREADPOOL, PROCESSPOOL).
    """

    SEQUENTIAL = "SEQUENTIAL"
    THREADPOOL = "THREADPOOL"
    PROCESSPOOL = "PROCESSPOOL"


DEFAULT_WORKER_EXECUTION_TYPE = WorkerExecutionType.THREADPOOL
DEFAULT_MAX_WORKERS = 16


class BaseExecutor:
    pass


class WorkerExecutor(BaseExecutor):
    """
    An executor that can execute a worker function on a dataset using  different execution types, and tracks progress.
    """

    def __init__(
        self,
        execution_type: WorkerExecutionType = DEFAULT_WORKER_EXECUTION_TYPE,
        max_workers: int = DEFAULT_MAX_WORKERS,
        show_progress: bool = True,
    ):
        self.execution_type = execution_type
        self.max_workers = max_workers
        self.show_progress = show_progress

    def execute(
        self,
        data: Iterable[D],
        worker: Callable[[Tuple[int, D]], R],
        on_error: Callable[[int, D, Exception], None] = None,
        raise_on_error: bool = False,
    ) -> Iterable[Tuple[int, D, R]]:
        """
        Generator function that executes the worker function on the data using the specified execution type.
        Args:
            data: The data to process.
            worker: The worker function to execute, which takes as argument a (index, data_item) tuple.
            on_error: Optional function to call when an error occurs in the worker function.
            raise_on_error: If True, raise the error when it occurs.
        Returns:
            A generator that yields tuples of (index, result, data item).
        Raises:
            ValueError: If the execution type is not supported.
        """

        def execute(executor):
            futures = {executor.submit(worker, (index, item)): (index, item) for index, item in enumerate(data)}
            completed = as_completed(futures)
            if self.show_progress:
                completed = tqdm(completed, total=len(futures))
            for future in completed:
                index, item = futures[future]
                try:
                    result = future.result()
                    yield index, item, result
                except Exception as e:
                    if on_error:
                        on_error(index, item, e)
                    if raise_on_error:
                        raise e

        if self.execution_type == WorkerExecutionType.SEQUENTIAL:
            if self.show_progress:
                data = tqdm(data)
            for index, item in enumerate(data):
                try:
                    result = worker((index, item))
                    yield index, item, result
                except Exception as e:
                    if on_error:
                        on_error(index, item, e)
                    if raise_on_error:
                        raise e

        elif self.execution_type == WorkerExecutionType.THREADPOOL:
            yield from execute(ThreadPoolExecutor(max_workers=self.max_workers))
        elif self.execution_type == WorkerExecutionType.PROCESSPOOL:
            yield from execute(ProcessPoolExecutor(max_workers=self.max_workers, mp_context=mp.get_context("fork")))
        else:
            raise ValueError(f"Unsupported execution type: {self.execution_type}")


class ThreadExecutor:
    """Executes worker functions on data using threads and yields results as they complete."""

    def __init__(self, show_progress: bool = True):
        self.show_progress = show_progress

    def execute(
        self,
        data: Iterable[D],
        workers: [Callable[[Tuple[int, D]], R]],
        on_error: Callable[[int, D, Exception], None] = None,
        raise_on_error: bool = False,
    ) -> Iterable[Tuple[int, D, R]]:
        """
        Executes worker functions on data using threads and yields results as they
        Args:
            data: The data to process.
            workers: one or more worker functions to execute, which takes as argument a (index, data_item) tuple.
            on_error: Optional function to call when an error occurs in the worker function.
            raise_on_error: If True, raise the error when it occurs.
        Returns:
            A generator that yields tuples of (index, result, data item).
        Example:
            It is possible to pass the same worker function multiple times
            ```
            def worker1(arg):
                index, data = arg
                return data


            def worker2(arg):
                index, data = arg
                return data


            data = range(10)
            executor = ThreadsExecutor(show_progress=False)
            results = [t[2] for t in executor.execute(data, [worker1] * 3 + [worker2] * 2)]
            ```
        """

        if self.show_progress:
            data = tqdm(data)
        shared_iterator = ThreadSafeIterator(enumerate(data))
        result_queue = queue.Queue()

        def worker_wrapper(worker):
            """Wraps the worker function to handle errors and push results into the queue."""
            while True:
                try:
                    index, item = next(shared_iterator)
                except StopIteration:
                    break
                try:
                    result = worker((index, item))
                    result_queue.put((index, item, result, None))
                except Exception as e:
                    result_queue.put((index, item, None, e))
                    if on_error:
                        on_error(index, item, e)

        threads = [threading.Thread(target=worker_wrapper, args=(worker,)) for worker in workers]
        for t in threads:
            t.start()
        # Wait for all threads to finish and yield results as they become available
        active_workers = len(threads)
        while active_workers > 0 or not result_queue.empty():
            try:
                index, item, result, exception = result_queue.get(timeout=0.1)
                if exception and raise_on_error:
                    raise exception
                yield index, item, result
            except queue.Empty:
                pass
            active_workers = sum(1 for t in threads if t.is_alive())
        for t in threads:
            t.join()
