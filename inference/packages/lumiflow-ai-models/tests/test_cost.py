import math
import os
import time

import pydantic
import pytest

from lumiflow_ai_models import cost
from lumiflow_ai_models.models.func import Func
from lumiflow_ai_models.wrappers.structuredoutput import StructuredOutput


class TestTracker:
    def test_no_cost(self, capsys):
        cost_tracker = cost.Tracker(
            "instance",
            pricing={
                "instance": {
                    "hourly_cost": 2_000,
                },
            },
            use_human_format=False,
            raise_on_error=True,
        )
        lc, tc = cost_tracker.cost(print_details=True)
        assert lc == 0
        assert tc == 0
        captured = capsys.readouterr()
        assert "Notebook cost" not in captured.out
        assert "Token-based cost" not in captured.out
        assert "Time-based cost" not in captured.out
        assert "LLM cost: $0.00" in captured.out
        assert "Egress cost" not in captured.out
        assert "Total cost: $0.00" in captured.out

        cost_tracker.stats(print_details=True)
        captured = capsys.readouterr()
        assert "Generate count: 0" in captured.out

    def test_time_costs_llm_load(self, capsys):
        cost_tracker = cost.Tracker(
            "instance",
            pricing={
                "instance": {
                    "hourly_cost": 2_000,
                },
            },
            use_human_format=False,
            raise_on_error=True,
        )
        load_ctx = cost_tracker.loading_start(
            model_id="model_id",
        )
        time.sleep(0.13)
        cost_tracker.loading_end(load_ctx)
        lc, tc = cost_tracker.cost(print_details=True)
        assert (0.13 * 2_000 / 3600) <= lc <= (0.14 * 2_000 / 3600)
        assert tc == 0
        captured = capsys.readouterr()
        assert "Notebook cost" not in captured.out
        assert "Token-based cost" not in captured.out
        assert "Time-based cost" in captured.out
        assert "LLM cost: $0.07" in captured.out
        assert "Egress cost" not in captured.out
        assert "Total cost: $0.00" in captured.out

        cost_tracker.stats(print_details=True)
        captured = capsys.readouterr()
        assert "Generate count: 0" in captured.out

    def test_token_cost_llm_generation(self, capsys):
        cost_tracker = cost.Tracker(
            "instance",
            pricing={
                "model": {
                    "input_cost": 3,
                    "output_cost": 5,
                }
            },
            use_human_format=False,
            raise_on_error=False,
        )
        for _ in range(13):
            gen_ctx = cost_tracker.generate_start(
                cost_type=cost.CostType.TOKEN,
                model_id="model_id",
            )
            cost_tracker.generate_end(
                gen_ctx,
                input_tokens=7_000,
                output_tokens=11_000,
                message_size_bytes=1024**3,
                status=cost.Status.SUCCESS,
            )
        lc, tc = cost_tracker.cost(print_details=True)
        assert math.isclose(lc, 13 * ((3 * 7_000 + 5 * 11_000) / 1e6 + 0.09), rel_tol=1e-5)
        captured = capsys.readouterr()
        assert "Notebook cost" not in captured.out
        assert "Token-based cost" in captured.out
        assert "Time-based cost" not in captured.out
        assert "LLM cost: $2.158000" in captured.out
        assert "Egress cost: $1.17" in captured.out
        assert "Egress size: 13958643712" in captured.out
        assert "Total cost: $2.158000" in captured.out

        rpm, tpm, *_ = cost_tracker.stats(print_details=True)
        captured = capsys.readouterr()
        assert rpm == 13
        assert tpm == 13 * (7_000 + 11_000)
        assert "Generate count: 13" in captured.out

    def test_token_cost_llm_generation_failed(self, capsys):
        cost_tracker = cost.Tracker(
            "instance",
            pricing={
                "model": {
                    "input_cost": 3,
                    "output_cost": 5,
                }
            },
            use_human_format=False,
            raise_on_error=False,
        )
        for _ in range(13):
            gen_ctx = cost_tracker.generate_start(
                cost_type=cost.CostType.TOKEN,
                model_id="model_id",
            )
            cost_tracker.generate_end(
                gen_ctx,
                input_tokens=7_000,
                output_tokens=11_000,
                message_size_bytes=1024**3,
                status=cost.Status.SUCCESS,
            )
        for _ in range(17):
            gen_ctx = cost_tracker.generate_start(
                cost_type=cost.CostType.TOKEN,
                model_id="model_id",
            )
            cost_tracker.generate_end(
                gen_ctx,
                input_tokens=7_000,
                output_tokens=11_000,
                message_size_bytes=1024**3,
                status=cost.Status.FAIL,
                error="Error",
            )
        lc, tc = cost_tracker.cost(print_details=True)
        assert math.isclose(lc, 13 * ((3 * 7_000 + 5 * 11_000) / 1e6 + 0.09) + 17 * 0.09, rel_tol=1e-5)
        captured = capsys.readouterr()
        assert "Notebook cost" not in captured.out
        assert "Token-based cost" in captured.out
        assert "Time-based cost" not in captured.out
        assert "LLM cost: $3.688000" in captured.out
        assert "Egress cost: $2.70" in captured.out
        assert "Egress size: 32212254720" in captured.out
        assert "Total cost: $3.688000" in captured.out

        rpm, tpm, *_ = cost_tracker.stats(print_details=True)
        captured = capsys.readouterr()
        assert rpm == 13
        assert tpm == 13 * (7_000 + 11_000)
        assert "Generate count: 30" in captured.out
        assert "Successful generate count: 13" in captured.out

        # The log of the cost tracker should contain status and error
        assert all(entry["status"] == cost.Status.SUCCESS and entry["error"] is None for entry in cost_tracker.log[:13])
        assert all(entry["status"] == cost.Status.FAIL and entry["error"] == "Error" for entry in cost_tracker.log[13:])

    def test_token_cost_llm_generation_extra_data(self, capsys):
        cost_tracker = cost.Tracker(
            "instance",
            use_human_format=False,
            raise_on_error=False,
        )
        gen_ctx = cost_tracker.generate_start(
            cost_type=cost.CostType.TOKEN,
            model_id="model_id",
        )
        cost_tracker.generate_end(
            gen_ctx,
            input_tokens=1,
            output_tokens=2,
            message_size_bytes=3,
            status=cost.Status.SUCCESS,
            extra_data={"test": "123"},
        )
        df = cost_tracker.dataframe()
        assert "test" in df.columns
        assert df.loc[0, "test"] == "123"

    def test_token_cost_llm_generation_extra_data_existing_key(self, capsys):
        cost_tracker = cost.Tracker(
            "instance",
            use_human_format=False,
            raise_on_error=False,
        )
        gen_ctx = cost_tracker.generate_start(
            cost_type=cost.CostType.TOKEN,
            model_id="model_id",
        )
        cost_tracker.generate_end(
            gen_ctx,
            input_tokens=1,
            output_tokens=2,
            message_size_bytes=3,
            status=cost.Status.SUCCESS,
            extra_data={"type": "123"},
        )
        df = cost_tracker.dataframe()
        assert "extra_type" in df.columns
        assert df.loc[0, "extra_type"] == "123"

    def test_time_cost_llm_generation(self, capsys):
        cost_tracker = cost.Tracker(
            "instance",
            pricing={
                "instance": {
                    "hourly_cost": 2_000,
                },
            },
            use_human_format=False,
            raise_on_error=True,
        )
        gen_ctx = cost_tracker.generate_start(
            cost_type=cost.CostType.TIME,
            model_id="model_id",
        )
        time.sleep(0.13)
        cost_tracker.generate_end(gen_ctx, status=cost.Status.SUCCESS)
        lc, tc = cost_tracker.cost(print_details=True)
        assert (0.13 * 2_000 / 3600) <= lc <= (0.14 * 2_000 / 3600)
        assert tc == 0
        captured = capsys.readouterr()
        assert "Notebook cost" not in captured.out
        assert "Token-based cost" not in captured.out
        assert "Time-based cost" in captured.out
        assert "LLM cost: $0.07" in captured.out
        assert "Total cost: $0.0000" in captured.out

        cost_tracker.stats(print_details=True)
        captured = capsys.readouterr()
        assert "Generate count: 1" in captured.out

    def test_mixed_costs_llm_generation(self, capsys):
        cost_tracker = cost.Tracker(
            "instance",
            pricing={
                "instance": {
                    "hourly_cost": 2_000,
                },
                "model_id-2": {
                    "input_cost": 3,
                    "output_cost": 5,
                },
            },
            use_human_format=False,
            raise_on_error=True,
        )
        gen_ctx = cost_tracker.generate_start(
            cost_type=cost.CostType.TIME,
            model_id="model_id-1",
        )
        time.sleep(0.13)
        cost_tracker.generate_end(
            gen_ctx,
            input_tokens=13_000,
            output_tokens=17_000,
            status=cost.Status.SUCCESS,
        )
        gen_ctx = cost_tracker.generate_start(
            cost_type=cost.CostType.TOKEN,
            model_id="model_id-2",
        )
        cost_tracker.generate_end(
            gen_ctx,
            input_tokens=7_000,
            output_tokens=11_000,
            status=cost.Status.SUCCESS,
        )
        lc, tc = cost_tracker.cost(print_details=True)
        assert (
            ((0.13 * 2_000 / 3600) + (3 * 7_000 + 5 * 11_000) / 1e6)
            <= lc
            <= ((0.15 * 2_000 / 3600) + (3 * 7_000 + 5 * 11_000) / 1e6)
        )
        captured = capsys.readouterr()
        assert "Notebook cost" not in captured.out
        assert "Token-based cost" in captured.out
        assert "Time-based cost" in captured.out
        assert "LLM cost: $0.1" in captured.out
        assert "Total cost: $0.076" in captured.out

        rpm, tpm, *_ = cost_tracker.stats(print_details=True)
        captured = capsys.readouterr()
        assert rpm == 2
        assert tpm == 7_000 + 11_000 + 13_000 + 17_000
        assert captured.out.count("Generate count: 2") == 1

    def test_pricing(self):
        cost_tracker = cost.Tracker(
            "instance",
            raise_on_error=True,
        )
        assert cost_tracker.pricing

    def test_pricing_override(self):
        cost_tracker = cost.Tracker(
            "instance",
            pricing={
                "instance": {
                    "hourly_cost": 2,
                },
            },
            raise_on_error=True,
        )
        assert cost_tracker.pricing.get("instance").get("hourly_cost") == 2


class TestFuncModel:
    def test_func_model(self):
        cost_tracker = cost.Tracker(
            instance_id=None,
            pricing={
                "func": {
                    "input_cost": 1.0,
                    "output_cost": 2.0,
                },
            },
        )
        model = Func(lambda x: x, "myfunc", cost_tracker=cost_tracker)
        model.generate("a")
        assert len(cost_tracker.log) == 1
        assert cost_tracker.log[0]["type"] == cost.Type.GENERATE
        assert cost_tracker.log[0]["model_class"] == "func"
        assert cost_tracker.log[0]["model_id"] == "myfunc"
        assert cost_tracker.log[0]["status"] == cost.Status.SUCCESS
        assert cost_tracker.log[0]["error"] is None

    def test_func_model_error(self):
        cost_tracker = cost.Tracker(
            instance_id=None,
            pricing={
                "func": {
                    "input_cost": 1.0,
                    "output_cost": 2.0,
                },
            },
        )

        def raise_exception(x):
            raise Exception("Test exception")

        model = Func(raise_exception, "myfunc", cost_tracker=cost_tracker)
        with pytest.raises(Exception):
            model.generate("a")
        assert len(cost_tracker.log) == 1
        assert cost_tracker.log[0]["type"] == cost.Type.GENERATE
        assert cost_tracker.log[0]["model_class"] == "func"
        assert cost_tracker.log[0]["model_id"] == "myfunc"
        assert cost_tracker.log[0]["status"] == cost.Status.FAIL
        assert cost_tracker.log[0]["error"] == "Exception: Test exception"

    def test_func_model_edit_context(self):
        cost_tracker = cost.Tracker(
            instance_id=None,
            pricing={
                "func": {
                    "input_cost": 1.0,
                    "output_cost": 2.0,
                },
            },
        )

        def func_(x):
            return x

        model = Func(func_, "myfunc", cost_tracker=cost_tracker)
        context = cost.Tracker.Context(log_entry={"test": "123"})
        model.generate("a", cost_context=context)
        context.log_entry["status"] = cost.Status.FAIL
        context.log_entry["error"] = "Test error"

        assert len(cost_tracker.log) == 1
        assert cost_tracker.log[0]["test"] == "123"
        assert cost_tracker.log[0]["type"] == cost.Type.GENERATE
        assert cost_tracker.log[0]["model_class"] == "func"
        assert cost_tracker.log[0]["model_id"] == "myfunc"
        assert cost_tracker.log[0]["status"] == cost.Status.FAIL
        assert cost_tracker.log[0]["error"] == "Test error"


class TestStructuredOutputModelWrapper:
    def test_structured_output(self):
        cost_tracker = cost.Tracker(
            instance_id=None,
            pricing={
                "func": {
                    "input_cost": 1.0,
                    "output_cost": 2.0,
                },
            },
        )

        class MyModel(pydantic.BaseModel):
            text: str

        model = Func(lambda x: """{"text": "b"}""", "myfunc", cost_tracker=cost_tracker)
        model = StructuredOutput(model, output_model=MyModel)
        r = model.generate("a")
        assert isinstance(r, MyModel)
        assert r.text == "b"

        assert len(cost_tracker.log) == 1
        assert cost_tracker.log[0]["type"] == cost.Type.GENERATE
        assert cost_tracker.log[0]["model_class"] == "func"
        assert cost_tracker.log[0]["model_id"] == "myfunc"
        assert cost_tracker.log[0]["status"] == cost.Status.SUCCESS
        assert cost_tracker.log[0]["error"] is None

    def test_structured_output_error(self):
        cost_tracker = cost.Tracker(
            instance_id=None,
            pricing={
                "func": {
                    "input_cost": 1.0,
                    "output_cost": 2.0,
                },
            },
        )

        class MyModel(pydantic.BaseModel):
            text: str

        model = Func(lambda x: """garbage""", "myfunc", cost_tracker=cost_tracker)
        model = StructuredOutput(model, output_model=MyModel)
        with pytest.raises(Exception):
            model.generate("a")

        assert len(cost_tracker.log) == 1
        assert cost_tracker.log[0]["type"] == cost.Type.GENERATE
        assert cost_tracker.log[0]["model_class"] == "func"
        assert cost_tracker.log[0]["model_id"] == "myfunc"
        assert cost_tracker.log[0]["status"] == cost.Status.FAIL
        assert "StructuredOutput" in cost_tracker.log[0]["error"]
        assert "No JSON found" in cost_tracker.log[0]["error"]
        assert "garbage" in cost_tracker.log[0]["error"]


class TestPricingDataLoader:
    def test_get_data(self):
        data = cost.PricingDataLoader.get_data()
        assert data

    def test_get_data_from_file(self):
        filepath = os.path.join(os.path.abspath(os.path.dirname(__file__)), "data/pricing.tsv")
        data = cost.PricingDataLoader.get_data_from_file(filepath)
        assert "pricing/model_id-A" in data
        assert data.get("pricing/model_id-A").get("input_cost") == 1.0
        assert data.get("pricing/model_id-A").get("output_cost") == 2.0
        assert "pricing/model_id-B" in data
        assert data.get("pricing/model_id-B").get("input_cost") == 3.0
        assert data.get("pricing/model_id-B").get("output_cost") == 4.0

    def test_check_unique_keys_in_data(self):
        """Check that the keys in the pricing data are unique across the pricing tsv files in the package."""
        keys = set()
        for filepath in cost.PricingDataLoader.get_filepaths():
            with open(filepath, "r") as file:
                header = None
                for idx, line in enumerate(file):
                    line = line.split("#")[0].strip()  # Remove comments
                    if line:  # Skip empty lines
                        if not header:  # First valid line is the header
                            header = line.strip().split("\t")
                        else:
                            key = line.split("\t")[0]
                            assert key not in keys
                            keys.add(key)
                assert len(keys) > 0
