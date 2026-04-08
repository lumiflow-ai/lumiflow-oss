import uuid
from datetime import datetime
import json
from unittest.mock import patch

import pytest
from fastapi import HTTPException
import lumiflow_eval_service.main as eval_main
from lumiflow_eval_service.main import (
    app,
    build_retryable_eval_failure,
    recipe_create,
    recipe_evaluate,
    available_models,
    resolve_model_id,
    get_model_info,
    get_model_lane_key,
    get_pacer_context,
)
from lumiflow_eval_service.models import FAKE_MODEL_KEY
from lumiflow_eval_service.types import RecipeCreate, RecipeCreateOut, RecipeEvaluate, RecipeEvaluateOut

from lumiflow_eval_service.runners import EvalResponse
from starlette.responses import JSONResponse
from lumiflow_ai_models.exceptions import RateLimitException, ServiceErrorException


class TestServiceRecipe:
    def test_recipe_evaluate_openapi_includes_retryable_failure_responses(self):
        openapi_schema = app.openapi()
        responses = openapi_schema["paths"]["/recipe/evaluate"]["post"]["responses"]

        assert responses["429"]["content"]["application/json"]["schema"]["$ref"].endswith("RetryableEvalFailure")
        assert responses["503"]["content"]["application/json"]["schema"]["$ref"].endswith("RetryableEvalFailure")

    def test_resolve_model_id_uses_fake_model_when_requested(self):
        model_key = resolve_model_id("gpt-5-mini", use_fake_model=True)
        assert model_key == FAKE_MODEL_KEY

    def test_resolve_model_id_reads_fake_model_setting_when_unspecified(self):
        with patch.object(eval_main.eval_settings, "FAKE_MODEL", True):
            model_key = resolve_model_id("gpt-5-mini")
            assert model_key == FAKE_MODEL_KEY

        with patch.object(eval_main.eval_settings, "FAKE_MODEL", False):
            model_key = resolve_model_id("gpt-5-mini")
            assert model_key == "gpt-5-mini"

    def test_resolve_model_id_uses_runtime_configured_fake_model_key(self):
        with patch.object(eval_main.eval_settings.eval_runtime_config, "fake_model_key", "fake-overridden"):
            model_key = resolve_model_id("gpt-5-mini", use_fake_model=True)

        assert model_key == "fake-overridden"

    def test_get_model_info_allows_fake_model_as_regular_model(self):
        model_name, model_id, _, _ = get_model_info(FAKE_MODEL_KEY)
        assert model_name == "func"
        assert model_id == "fake"

    def test_get_model_info_raises_when_registry_empty(self):
        original_available_models = available_models.copy()
        try:
            available_models.clear()
            with patch.object(eval_main.eval_settings, "FAKE_MODEL", False):
                with pytest.raises(HTTPException) as exception_info:
                    get_model_info("gpt-5-mini")
        finally:
            available_models.update(original_available_models)

        assert exception_info.value.status_code == 503
        assert "No evaluation models are configured" in exception_info.value.detail

    def test_get_model_info_raises_for_unknown_model_key(self):
        with pytest.raises(HTTPException) as exception_info:
            get_model_info("not-a-real-model")

        assert exception_info.value.status_code == 400
        assert "not-a-real-model" in exception_info.value.detail

    def test_get_model_lane_key_is_provider_and_model_specific(self):
        assert get_model_lane_key("openai", "gpt-5-mini") == "openai:gpt-5-mini"

    def test_get_pacer_context_reuses_the_same_lane(self):
        first = get_pacer_context("openai", "gpt-5-mini")
        second = get_pacer_context("openai", "gpt-5-mini")

        assert first is second

    def test_get_pacer_context_isolated_between_lanes(self):
        first = get_pacer_context("openai", "gpt-5-mini")
        second = get_pacer_context("bedrock", "amazon.nova-micro-v1:0")

        assert first is not second

    def test_get_pacer_context_uses_configured_max_delay(self):
        with patch.object(eval_main.runtime_config.wrappers.pacer, "max_delay", 3.0):
            context = get_pacer_context("openai", "gpt-5-nano-config-test")

        assert context.max_delay == 3.0

    def test_build_retryable_eval_failure_uses_lane_delay_and_header(self):
        context = get_pacer_context("openai", "gpt-5-mini-retry-after")
        context.delay = 2.3

        response = build_retryable_eval_failure(
            model_name="openai",
            model_id="gpt-5-mini-retry-after",
            code="rate_limited",
            message="Too many requests",
            status_code=429,
        )

        response_dict = (
            json.loads(response.body.tobytes()) if isinstance(response.body, memoryview) else json.loads(response.body)
        )
        assert response.status_code == 429
        assert response.headers["Retry-After"] == "3"
        assert response_dict["retryable"] is True
        assert response_dict["retryAfterSeconds"] == 2.3
        assert response_dict["lane"] == "openai:gpt-5-mini-retry-after"

    def test_recipe_create(self):
        question = "Are any medications mentioned?"

        json_response: JSONResponse = recipe_create(RecipeCreate(question=question))
        response_dict = (
            json.loads(json_response.body.tobytes())
            if isinstance(json_response.body, memoryview)
            else json.loads(json_response.body)
        )
        recipe_create_response = RecipeCreateOut(**response_dict)

        assert len(recipe_create_response.prompt.input_name) > 0
        assert recipe_create_response.prompt.input_name in recipe_create_response.prompt.template
        assert question in recipe_create_response.prompt.template
        assert recipe_create_response.metric.name == question

    def test_recipe_evaluate(self):
        template = """
        INPUT_ARTIFACT
        Does the artifact explicitly mention the name of at least one medication?
        """
        input_name = "INPUT_ARTIFACT"
        input_value = "I had to take ibuprofen for my headache yesterday."

        response_value = True
        response_evidence = ["ibuprofen", "llm hallucination"]

        def func(x):
            assert input_value in x
            assert input_name not in x
            return EvalResponse(value=response_value, evidence=response_evidence).model_dump_json()

        original_available_models = available_models.copy()
        original_resolve_model_id = eval_main.resolve_model_id
        try:
            available_models["func"] = ("func", "func", {"function": func}, {})
            with patch(
                "lumiflow_eval_service.main.resolve_model_id",
                side_effect=lambda key: original_resolve_model_id(key, use_fake_model=False),
            ):
                json_response: JSONResponse = recipe_evaluate(
                    RecipeEvaluate(
                        prompt=RecipeEvaluate.Prompt(
                            template=template,
                            input_name=input_name,
                            input_value=input_value,
                        ),
                        model=RecipeEvaluate.Model(
                            name="func",
                            temperature=None,
                            top_p=None,
                            max_new_tokens=None,
                        ),
                        timestamp=datetime.now(),
                        event_summary_id=uuid.uuid4(),
                        generation_id=str(uuid.uuid4()),
                        org_id=uuid.uuid4(),
                    )
                )
        finally:
            available_models.clear()
            available_models.update(original_available_models)

        response_dict = (
            json.loads(json_response.body.tobytes())
            if isinstance(json_response.body, memoryview)
            else json.loads(json_response.body)
        )
        recipe_evaluate_response = RecipeEvaluateOut(**response_dict)
        assert recipe_evaluate_response.value == response_value
        assert recipe_evaluate_response.evidence == [
            "ibuprofen"
        ]  # the llm hallucination should not be included in the evidence
        assert recipe_evaluate_response.generation.total_tokens_sent > 0
        assert recipe_evaluate_response.generation.total_tokens_generated > 0
        assert recipe_evaluate_response.generation.cost >= 0.0
        assert recipe_evaluate_response.generation.total_wall_duration > 0

    def test_recipe_evaluate_with_fake_model(self):
        template = """
        ### START Artifact
        INPUT_ARTIFACT
        ### END Artifact
        Does the artifact mention medication?
        """
        input_name = "INPUT_ARTIFACT"
        input_value = "The patient is taking ibuprofen once daily."

        with patch.object(eval_main.eval_settings, "FAKE_MODEL", False):
            with patch("lumiflow_eval_service.fake.random.choice", return_value=True):
                with patch("lumiflow_eval_service.fake.random_evidence_from_text", return_value=["ibuprofen"]):
                    json_response: JSONResponse = recipe_evaluate(
                        RecipeEvaluate(
                            prompt=RecipeEvaluate.Prompt(
                                template=template,
                                input_name=input_name,
                                input_value=input_value,
                            ),
                            model=RecipeEvaluate.Model(
                                name="fake",
                                temperature=None,
                                top_p=None,
                                max_new_tokens=None,
                            ),
                            timestamp=datetime.now(),
                            event_summary_id=uuid.uuid4(),
                            generation_id=str(uuid.uuid4()),
                            org_id=uuid.uuid4(),
                        )
                    )

        response_dict = (
            json.loads(json_response.body.tobytes())
            if isinstance(json_response.body, memoryview)
            else json.loads(json_response.body)
        )
        recipe_evaluate_response = RecipeEvaluateOut(**response_dict)
        assert recipe_evaluate_response.value is True
        assert recipe_evaluate_response.evidence == ["ibuprofen"]
        assert recipe_evaluate_response.generation.model_id == "fake"

    def test_recipe_evaluate_returns_retryable_rate_limit_response(self):
        with patch(
            "lumiflow_eval_service.main.EvaluationRunner.run", side_effect=RateLimitException("Too many requests")
        ):
            json_response: JSONResponse = recipe_evaluate(
                RecipeEvaluate(
                    prompt=RecipeEvaluate.Prompt(
                        template="INPUT_ARTIFACT",
                        input_name="INPUT_ARTIFACT",
                        input_value="Example artifact",
                    ),
                    model=RecipeEvaluate.Model(
                        name="fake",
                        temperature=None,
                        top_p=None,
                        max_new_tokens=None,
                    ),
                    timestamp=datetime.now(),
                    event_summary_id=uuid.uuid4(),
                    generation_id=str(uuid.uuid4()),
                    org_id=uuid.uuid4(),
                )
            )

        response_dict = (
            json.loads(json_response.body.tobytes())
            if isinstance(json_response.body, memoryview)
            else json.loads(json_response.body)
        )
        assert json_response.status_code == 429
        assert json_response.headers["Retry-After"] == "1"
        assert response_dict["code"] == "rate_limited"
        assert response_dict["retryable"] is True
        assert response_dict["lane"] == "func:fake"

    def test_recipe_evaluate_returns_retryable_service_error_response(self):
        with patch(
            "lumiflow_eval_service.main.EvaluationRunner.run", side_effect=ServiceErrorException("Service unavailable")
        ):
            json_response: JSONResponse = recipe_evaluate(
                RecipeEvaluate(
                    prompt=RecipeEvaluate.Prompt(
                        template="INPUT_ARTIFACT",
                        input_name="INPUT_ARTIFACT",
                        input_value="Example artifact",
                    ),
                    model=RecipeEvaluate.Model(
                        name="fake",
                        temperature=None,
                        top_p=None,
                        max_new_tokens=None,
                    ),
                    timestamp=datetime.now(),
                    event_summary_id=uuid.uuid4(),
                    generation_id=str(uuid.uuid4()),
                    org_id=uuid.uuid4(),
                )
            )

        response_dict = (
            json.loads(json_response.body.tobytes())
            if isinstance(json_response.body, memoryview)
            else json.loads(json_response.body)
        )
        assert json_response.status_code == 503
        assert response_dict["code"] == "service_unavailable"
        assert response_dict["retryable"] is True
        assert response_dict["lane"] == "func:fake"

    def test_recipe_evaluate_respects_empty_wrapper_exception_lists(self):
        with (
            patch.object(eval_main.runtime_config.wrappers.pacer, "exceptions", []),
            patch.object(eval_main.runtime_config.wrappers.retry, "exceptions", []),
            patch("lumiflow_eval_service.main.wrappers.StructuredOutput", side_effect=lambda model: model),
            patch("lumiflow_eval_service.main.wrappers.Pacer", side_effect=lambda model, **kwargs: model) as pacer_mock,
            patch("lumiflow_eval_service.main.wrappers.Retry", side_effect=lambda model, **kwargs: model) as retry_mock,
            patch("lumiflow_eval_service.main.EvaluationRunner.run", return_value=(True, ["ibuprofen"])),
        ):
            json_response: JSONResponse = recipe_evaluate(
                RecipeEvaluate(
                    prompt=RecipeEvaluate.Prompt(
                        template="INPUT_ARTIFACT",
                        input_name="INPUT_ARTIFACT",
                        input_value="Example artifact",
                    ),
                    model=RecipeEvaluate.Model(
                        name="fake",
                        temperature=None,
                        top_p=None,
                        max_new_tokens=None,
                    ),
                    timestamp=datetime.now(),
                    event_summary_id=uuid.uuid4(),
                    generation_id=str(uuid.uuid4()),
                    org_id=uuid.uuid4(),
                )
            )

        assert json_response.status_code == 200
        assert pacer_mock.call_args.kwargs["exceptions_to_catch"] == []
        assert retry_mock.call_args.kwargs["exceptions_to_catch"] == []
