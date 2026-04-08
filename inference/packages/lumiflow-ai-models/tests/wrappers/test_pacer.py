import math

import pytest

from lumiflow_ai_models.models import Func
from lumiflow_ai_models.wrappers import Pacer, PacerContext


class TestPacer:
    def test_generate_success(self):
        context = PacerContext(initial_delay=0.1, decay=0.9)
        model = Pacer(
            Func(
                function=lambda x: f"{x} B",
            ),
            context=context,
            verbose=True,
        )

        result = model.generate("A")
        assert result == "A B"
        assert math.isclose(context.delay, 0.1 * 0.9, rel_tol=1e-5)

    def test_generate_error_caught(self):
        context = PacerContext(initial_delay=0.1, increment=0.2)

        def raise_exception(_):
            raise ValueError("Error")

        model = Pacer(
            Func(
                function=raise_exception,
            ),
            context=context,
            exceptions_to_catch=[ValueError],
            verbose=True,
        )

        with pytest.raises(ValueError):
            model.generate("A")
        assert math.isclose(context.delay, 0.1 + 0.2, rel_tol=1e-5)

    def test_generate_error_uncaught(self):
        context = PacerContext(initial_delay=0.1, increment=0.2, decay=0.9)

        class MyException(Exception):
            pass

        def raise_exception(_):
            raise MyException("Error")

        model = Pacer(
            Func(
                function=raise_exception,
            ),
            context=context,
            exceptions_to_catch=[ValueError],
            verbose=True,
        )

        with pytest.raises(MyException):
            model.generate("A")
        assert context.delay == 0.1

    def test_generate_success_and_error_same_context(self):
        context = PacerContext(initial_delay=0.1, decay=0.9, increment=0.2)

        model1 = Pacer(
            Func(
                function=lambda x: x,
            ),
            context=context,
            verbose=True,
        )
        model1.generate("A")
        assert math.isclose(context.delay, 0.1 * 0.9, rel_tol=1e-5)

        def raise_exception(_):
            raise Exception("Error")

        model2 = Pacer(
            Func(
                function=raise_exception,
            ),
            exceptions_to_catch=[Exception],
            context=context,
            verbose=True,
        )
        with pytest.raises(Exception):
            model2.generate("B")

        assert math.isclose(context.delay, 0.1 * 0.9 + 0.2, rel_tol=1e-5)

    def test_generate_success_and_error_diff_context(self):
        context1 = PacerContext(initial_delay=0.1, decay=0.9, increment=0.2)
        context2 = PacerContext(initial_delay=0.3, decay=0.8, increment=0.4)

        model1 = Pacer(
            Func(
                function=lambda x: x,
            ),
            context=context1,
            verbose=True,
        )
        model1.generate("A")
        assert math.isclose(context1.delay, 0.1 * 0.9, rel_tol=1e-5)

        def raise_exception(_):
            raise Exception("Error")

        model2 = Pacer(
            Func(
                function=raise_exception,
            ),
            exceptions_to_catch=[Exception],
            context=context2,
            verbose=True,
        )
        with pytest.raises(Exception):
            model2.generate("B")

        assert math.isclose(context1.delay, 0.1 * 0.9, rel_tol=1e-5)
        assert math.isclose(context2.delay, 0.3 + 0.4, rel_tol=1e-5)
