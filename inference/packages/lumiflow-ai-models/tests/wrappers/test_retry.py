import pytest

from lumiflow_ai_models.models import Func
from lumiflow_ai_models.wrappers import Retry


class TestRetry:
    def test_generate_success(self):
        model = Retry(
            Func(
                function=lambda x: f"{x} B",
            ),
            retries=3,
            verbose=True,
        )

        result, error = model.generate("A")
        assert result == "A B"
        assert error is None

    def test_generate_exception_continue(self, capsys):
        def raise_exception(text):
            raise ValueError(f"Error: {text}")

        model = Retry(
            Func(
                function=raise_exception,
            ),
            retries=3,
            verbose=True,
        )

        result, error = model.generate("A")
        assert result is None
        assert error == "Error: A"

        captured = capsys.readouterr()
        assert "Attempt 0 failed" in captured.out
        assert "Attempt 1 failed" in captured.out
        assert "Attempt 2 failed" in captured.out
        assert "Attempt 3 failed" in captured.out
        assert "Failed after 4 attempts." in captured.out

    def test_generate_exception_raise(self):
        def raise_exception(text):
            raise ValueError(f"Error: {text}")

        model = Retry(
            Func(
                function=raise_exception,
            ),
            retries=3,
            raise_after_retries=True,
        )
        with pytest.raises(RuntimeError) as e:
            model.generate("A")
        assert str(e.value) == "Failed after 4 attempts."

    def test_generate_exception_reraises_last_exception(self):
        def raise_exception(text):
            raise ValueError(f"Error: {text}")

        model = Retry(
            Func(
                function=raise_exception,
            ),
            retries=2,
            raise_last_exception=True,
        )
        with pytest.raises(ValueError) as e:
            model.generate("A")
        assert str(e.value) == "Error: A"

    def test_generate_catch_exception(self):
        class MyException(Exception):
            pass

        def raise_exception(text):
            raise MyException(f"Error: {text}")

        model = Retry(
            Func(
                function=raise_exception,
            ),
            retries=3,
            exceptions_to_catch=[MyException],
        )
        result, error = model.generate("A")
        assert result is None
        assert error == "Error: A"

    def test_generate_ignore_exception(self):
        class MyException1(Exception):
            pass

        class MyException2(Exception):
            pass

        def raise_exception(text):
            raise MyException2(f"Error: {text}")

        model = Retry(
            Func(
                function=raise_exception,
            ),
            retries=3,
            exceptions_to_catch=[MyException1],
            raise_after_retries=True,
        )
        with pytest.raises(MyException2) as e:
            model.generate("A")
        assert str(e.value) == "Error: A"

    def test_double_wrap(self, capsys):
        model = Retry(
            Func(
                function=lambda x: f"{x} B",
            ),
            retries=1,
        )
        model = Retry(
            model,
            retries=2,
        )

        result, error = model.generate("A")
        assert result == "A B"
        assert error is None

    def test_double_wrap_outer_exception(self, capsys):
        class MyException1(Exception):
            pass

        class MyException2(Exception):
            pass

        def raise_exception(text):
            raise MyException2("Exception 2")

        model = Retry(
            Func(
                function=raise_exception,
            ),
            retries=3,
            exceptions_to_catch=[MyException1],
            verbose=True,
        )
        model = Retry(
            model,
            retries=4,
            exceptions_to_catch=[BaseException],
            verbose=True,
        )

        result, error = model.generate("A")

        # The inner Retry should not catch MyException2, and ignore it;
        # the outer Retry should catch MyException2 and retry it 4 times.
        assert result is None
        assert error == "Exception 2"
        captured = capsys.readouterr()
        assert captured.out.count("Attempt 0 failed") == 1
        assert captured.out.count("Attempt 1 failed") == 1
        assert captured.out.count("Attempt 2 failed") == 1
        assert captured.out.count("Attempt 3 failed") == 1
        assert captured.out.count("Attempt 4 failed") == 1
        assert "Failed after 5 attempts." in captured.out

    def test_double_wrap_inner_exception(self, capsys):
        class MyException(Exception):
            pass

        def raise_exception(text):
            raise MyException("MyException")

        model = Retry(
            Func(
                function=raise_exception,
            ),
            retries=3,
            exceptions_to_catch=[MyException],
            verbose=True,
        )
        model = Retry(
            model,
            retries=4,
            verbose=True,
        )

        result, error = model.generate("A")
        # The inner Retry should catch MyException and retry it 3 times;
        # the outer Retry should not catch MyException, and ignore it.
        assert result is None
        assert error == "MyException"
        captured = capsys.readouterr()
        assert captured.out.count("Attempt 0 failed") == 1
        assert captured.out.count("Attempt 1 failed") == 1
        assert captured.out.count("Attempt 2 failed") == 1
        assert captured.out.count("Attempt 3 failed") == 1
        assert "Failed after 4 attempts." in captured.out
