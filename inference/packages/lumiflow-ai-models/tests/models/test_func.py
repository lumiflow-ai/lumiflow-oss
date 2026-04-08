from lumiflow_ai_models.models import Func


class TestFuncModel:
    def test_generate(self):
        model = Func(
            function=lambda text: f"{text} B",
        )
        response = model.generate("A")
        assert response == "A B"

    def test_generate_list(self):
        model = Func(
            function=lambda text: [text, "B", "C"],
        )
        response = model.generate("A")
        assert list(response) == ["A", "B", "C"]

    def test_generate_stream(self):
        model = Func(
            function=lambda text: f"{text} B",
        )
        response = model.generate("A", stream=True)
        assert list(response) == ["A B"]

    def test_generate_list_stream(self):
        model = Func(
            function=lambda text: [text, "B", "C"],
        )
        response = model.generate("A", stream=True)
        assert list(response) == ["A", "B", "C"]
