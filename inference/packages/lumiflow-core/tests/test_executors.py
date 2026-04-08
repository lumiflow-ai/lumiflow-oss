import math
import time

import pytest

from lumiflow_core import executors, workers


class TestWorkerExecutor:
    def test_sequential_executor(self):
        def worker(arg):
            task, item = arg
            return item

        data = [1, 2, 3]
        executor = executors.WorkerExecutor(
            execution_type=executors.WorkerExecutionType.SEQUENTIAL,
            max_workers=1,
            show_progress=False,
        )
        results = [t[2] for t in executor.execute(data, worker)]
        assert results == data

    def test_sequential_executor_on_error(self):
        def worker(arg):
            _, item = arg
            raise Exception(item)

        data = [1, 2, 3]
        exceptions = []

        executor = executors.WorkerExecutor(
            execution_type=executors.WorkerExecutionType.SEQUENTIAL,
            max_workers=1,
            show_progress=False,
        )
        for _ in executor.execute(
            data,
            worker,
            on_error=lambda i, d, e: exceptions.append(str(e)),
        ):
            pass
        assert exceptions == [str(e) for e in data]

    def test_sequential_executor_raise(self):
        def worker(arg):
            _, item = arg
            raise Exception(item)

        data = [1, 2, 3]
        executor = executors.WorkerExecutor(
            execution_type=executors.WorkerExecutionType.SEQUENTIAL,
            max_workers=1,
            show_progress=False,
        )
        with pytest.raises(Exception):
            for _ in executor.execute(
                data,
                worker,
                raise_on_error=True,
            ):
                pass

    def test_threadpool_executor(self):
        def worker(arg):
            task, item = arg
            return item

        data = [1, 2, 3]
        executor = executors.WorkerExecutor(
            execution_type=executors.WorkerExecutionType.THREADPOOL,
            max_workers=3,
            show_progress=False,
        )
        results = set([t[2] for t in executor.execute(data, worker)])
        assert results == set(data)

    def test_threadpool_executor_on_error(self):
        def worker(arg):
            _, item = arg
            raise Exception(item)

        data = [1, 2, 3]
        exceptions = set()
        executor = executors.WorkerExecutor(
            execution_type=executors.WorkerExecutionType.THREADPOOL,
            max_workers=3,
            show_progress=False,
        )
        for _ in executor.execute(
            data,
            worker,
            on_error=lambda i, d, e: exceptions.add(str(e)),
        ):
            pass
        assert exceptions == set([str(e) for e in data])

    def test_threadpool_executor_raise(self):
        def worker(arg):
            _, item = arg
            raise Exception(item)

        data = [1, 2, 3]
        executor = executors.WorkerExecutor(
            execution_type=executors.WorkerExecutionType.THREADPOOL,
            max_workers=3,
            show_progress=False,
        )
        with pytest.raises(Exception):
            for _ in executor.execute(
                data,
                worker,
                raise_on_error=True,
            ):
                pass

    def test_executor_worker_decorator(self, capsys):
        @workers.worker(verbose=True)
        def worker(arg):
            task, item = arg
            return item

        data = [1, 2, 3]
        executor = executors.WorkerExecutor(
            execution_type=executors.WorkerExecutionType.SEQUENTIAL,
            max_workers=1,
            show_progress=False,
        )
        results = [t[2] for t in executor.execute(data, worker)]
        assert results == data
        captured = capsys.readouterr()
        for task in range(len(data)):
            assert f"Worker processing task {task}" in captured.out
            assert f"Worker processed task {task}" in captured.out


class TestThreadsExecutor:
    def test_executor_single_worker(self):
        def worker(arg):
            task, item = arg
            return item

        data = range(10)
        executor = executors.ThreadExecutor(show_progress=False)
        results = [t[2] for t in executor.execute(data, [worker])]
        assert results == list(data)

    def test_executor_multi_worker(self):
        def worker(arg):
            task, item = arg
            return item

        data = range(10)
        executor = executors.ThreadExecutor(show_progress=False)
        results = [t[2] for t in executor.execute(data, [worker] * 3)]
        assert set(results) == set(data)

    def test_executor_multi_worker_mix(self):
        def worker1(arg):
            task, item = arg
            time.sleep(0.001)
            return (1, item)

        def worker2(arg):
            task, item = arg
            time.sleep(0.001)
            return (2, item)

        data = range(100)
        executor = executors.ThreadExecutor(show_progress=False)
        results = [t[2] for t in executor.execute(data, [worker1] * 2 + [worker2] * 5)]

        result_worker_id = [r[0] for r in results]
        assert set(result_worker_id) == {1, 2}
        worker1_count = result_worker_id.count(1)
        worker2_count = result_worker_id.count(2)
        assert math.isclose(worker1_count, 2 / 7 * len(data), rel_tol=0.1)
        assert math.isclose(worker2_count, 5 / 7 * len(data), rel_tol=0.1)

        result_items = [r[1] for r in results]
        assert set(result_items) == set(data)

    def test_executor_multi_worker_on_error(self):
        def worker(arg):
            _, item = arg
            raise Exception(item)

        data = [1, 2, 3]
        exceptions = set()
        executor = executors.ThreadExecutor(show_progress=False)
        _ = [
            t[2]
            for t in executor.execute(
                data,
                [worker] * 3,
                on_error=lambda i, d, e: exceptions.add(str(e)),
            )
        ]
        assert exceptions == set([str(e) for e in data])

    def test_executor_multi_worker_raise(self):
        def worker(arg):
            _, item = arg
            raise Exception(item)

        data = [1, 2, 3]
        executor = executors.ThreadExecutor(show_progress=False)
        with pytest.raises(Exception):
            for _ in executor.execute(
                data,
                [worker],
                raise_on_error=True,
            ):
                pass
