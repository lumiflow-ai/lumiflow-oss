import pytest

from lumiflow_core.workers import worker, is_worker_decorated


class TestWorkers:
    def test_decorator(self, capsys):
        @worker(verbose=True)
        def w(arg):
            task, item = arg
            return item

        assert w((0, 1)) == 1
        captured = capsys.readouterr()
        assert captured.out.count("Worker processing task 0") == 1
        assert captured.out.count("Worker processed task 0") == 1
        assert "Worker failed" not in captured.err
        assert "Worker retrying" not in captured.err
        assert "Worker retries exhausted" not in captured.err

    def test_wrapped(self, capsys):
        def w(arg):
            task, item = arg
            return item

        assert worker(verbose=True)(w)((0, 1)) == 1
        captured = capsys.readouterr()
        assert captured.out.count("Worker processing task 0") == 1
        assert captured.out.count("Worker processed task 0") == 1
        assert "Worker failed" not in captured.err
        assert "Worker retrying" not in captured.err
        assert "Worker retries exhausted" not in captured.err

    def test_is_worker_decorated(self):
        def w(arg):
            task, item = arg
            return item

        assert not is_worker_decorated(w)
        decorated_worker = worker(verbose=True)(w)
        assert is_worker_decorated(decorated_worker)
        assert not is_worker_decorated(w)

    def test_retry(self, capsys):
        @worker(verbose=True, max_retries=2)
        def w(_):
            raise Exception()

        assert w((0, 1)) is None
        captured = capsys.readouterr()
        assert captured.out.count("Worker processing task 0") == 1
        assert captured.err.count("Worker failed") == 3
        assert "Worker retrying task 0, retry 1" in captured.err
        assert "Worker retrying task 0, retry 2" in captured.err
        assert "Worker retrying task 0, retry 3" not in captured.err
        assert captured.err.count("Worker retries exhausted") == 1

    def test_raise(self, capsys):
        @worker(verbose=True, raise_on_error=True)
        def w(_):
            raise Exception()

        with pytest.raises(Exception):
            w((0, 1))

        captured = capsys.readouterr()
        assert captured.out.count("Worker processing task 0") == 1
        assert captured.err.count("Worker failed") == 1
        assert "Worker retrying" not in captured.err
