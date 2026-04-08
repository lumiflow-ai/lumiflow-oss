import logging
import math
import threading
from datetime import datetime

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

from lumiflow_ai_models import models, cost, wrappers
from lumiflow_ai_models.exceptions import RateLimitException, ServiceErrorException
from lumiflow_eval_service.runners import QuestionMappingRunner, EvaluationRunner
from lumiflow_eval_service.settings import settings as eval_settings
from lumiflow_eval_service.types import (
    GenerationStats,
    RecipeCreate,
    RecipeCreateOut,
    RecipeEvaluate,
    RecipeEvaluateOut,
    RetryableEvalFailure,
    MetricKind,
)
from lumiflow_eval_service.models import available_models, ModelKey, ModelInfo

logger = logging.getLogger("uvicorn")
if not logger.handlers:
    logger = logging.getLogger(__name__)

if eval_settings.DEV:
    logger.setLevel(logging.DEBUG)
    logger.debug("DEV mode is ON.")

logger.debug("Eval Service Settings: %s", eval_settings.model_dump())

app = FastAPI()
pacer_contexts_lock = threading.Lock()
pacer_contexts: dict[str, wrappers.PacerContext] = {}
runtime_config = eval_settings.eval_runtime_config

EXCEPTION_NAME_MAP: dict[str, type[Exception]] = {
    "RateLimitException": RateLimitException,
    "ServiceErrorException": ServiceErrorException,
}


def resolve_exception_classes(exception_names: list[str]) -> list[type[Exception]]:
    resolved: list[type[Exception]] = []
    for name in exception_names:
        exception_type = EXCEPTION_NAME_MAP.get(name)
        if exception_type:
            resolved.append(exception_type)
        else:
            logger.warning("Ignoring unknown wrapper exception in config: %s", name)
    return resolved


def resolve_model_id(requested_model_key: str | None, use_fake_model: bool | None = None) -> ModelKey:
    if use_fake_model is None:
        use_fake_model = eval_settings.FAKE_MODEL

    if use_fake_model:
        logger.debug("Using fake model.")
        return eval_settings.eval_runtime_config.fake_model_key

    model_key = requested_model_key or next(iter(available_models))
    return model_key


def get_model_info(model_key: str) -> ModelInfo:
    if not available_models:
        raise HTTPException(
            status_code=503,
            detail="No evaluation models are configured. Please configure at least one available model.",
        )

    model_info = available_models.get(model_key)
    if not model_info:
        raise HTTPException(
            status_code=400,
            detail=f"Model {model_key} is not available. Available models: {[None] + list(available_models.keys())}",
        )
    model_name, model_id, _, _ = model_info
    logger.debug(f"Using model: {model_name}, model_id: {model_id}")
    return model_info


def get_model_lane_key(model_name: str, model_id: str) -> str:
    return f"{model_name}:{model_id}"


def get_pacer_context(model_name: str, model_id: str) -> wrappers.PacerContext:
    pacer_config = runtime_config.wrappers.pacer
    lane_key = get_model_lane_key(model_name, model_id)
    with pacer_contexts_lock:
        context = pacer_contexts.get(lane_key)
        if context is None:
            context = wrappers.PacerContext(
                label=lane_key,
                initial_delay=pacer_config.initial_delay,
                min_delay=pacer_config.min_delay,
                max_delay=pacer_config.max_delay,
                decay=pacer_config.decay,
                increment=pacer_config.increment,
            )
            pacer_contexts[lane_key] = context
        return context


def build_retryable_eval_failure(
    *,
    model_name: str,
    model_id: str,
    code: str,
    message: str,
    status_code: int,
) -> JSONResponse:
    retry_config = runtime_config.wrappers.retry
    pacer_context = get_pacer_context(model_name, model_id)
    retry_after_seconds = max(
        retry_config.backoff,
        pacer_context.delay,
    )
    payload = RetryableEvalFailure(
        retryable=True,
        code=code,
        message=message,
        retry_after_seconds=retry_after_seconds,
        lane=get_model_lane_key(model_name, model_id),
    )
    return JSONResponse(
        status_code=status_code,
        headers={"Retry-After": str(max(1, math.ceil(retry_after_seconds)))},
        content=payload.model_dump(exclude_none=True, exclude_unset=True, mode="json", by_alias=True),
    )


def resolve_model_params(requested: dict, defaults: dict):
    requested_without_none = {key: value for key, value in requested.items() if value is not None}
    resolved_gen_params = {**defaults, **requested_without_none}

    temperature = resolved_gen_params.get("temperature")
    if temperature is not None and temperature != "":
        resolved_gen_params["temperature"] = float(temperature)

    top_p = resolved_gen_params.get("top_p")
    if top_p is not None and top_p != "":
        resolved_gen_params["top_p"] = float(top_p)

    max_new_tokens = resolved_gen_params.get("max_new_tokens")
    if max_new_tokens is not None and max_new_tokens != "":
        resolved_gen_params["max_new_tokens"] = int(max_new_tokens)

    return resolved_gen_params


@app.post("/recipe/create", response_model=RecipeCreateOut)
def recipe_create(recipe_create: RecipeCreate):
    model_key = resolve_model_id((recipe_create.parameters or {}).get("model"))
    _, _, _, gen_params = get_model_info(model_key)
    resolved_gen_params = resolve_model_params(recipe_create.parameters or {}, gen_params)

    prompt_template, input_name, metric_kind = QuestionMappingRunner().run(question=recipe_create.question)

    # Convert metric_kind string to MetricKind enum
    if isinstance(metric_kind, str):
        try:
            metric_kind = MetricKind(metric_kind)
        except ValueError:
            # Handle case where string doesn't match any enum value
            metric_kind = MetricKind.UNKNOWN if hasattr(MetricKind, "UNKNOWN") else list(MetricKind)[0]

    response = RecipeCreateOut(
        prompt=RecipeCreateOut.PromptOut(
            template=prompt_template,
            input_name=input_name,
        ),
        model=RecipeCreateOut.ModelOut(
            name=model_key,
            temperature=resolved_gen_params.get("temperature"),
            top_p=resolved_gen_params.get("top_p"),
            max_new_tokens=resolved_gen_params.get("max_new_tokens"),
        ),
        metric=RecipeCreateOut.MetricOut(
            name=recipe_create.question,
            kind=MetricKind(metric_kind),
        ),
    )
    return JSONResponse(content=response.model_dump(exclude_none=True, exclude_unset=True, mode="json", by_alias=True))


@app.post(
    "/recipe/evaluate",
    response_model=RecipeEvaluateOut,
    responses={
        429: {"model": RetryableEvalFailure, "description": "Retryable provider rate limit response."},
        503: {"model": RetryableEvalFailure, "description": "Retryable upstream service saturation response."},
    },
)
def recipe_evaluate(recipe_evaluate: RecipeEvaluate):
    # Note: cost_tracker and model are per request and cannot be shared across requests.
    cost_tracker = cost.Tracker(instance_id=None)
    notebook_context = cost_tracker.notebook_start()

    model_key = resolve_model_id(recipe_evaluate.model.name)
    model_name, model_id, model_params, gen_params = get_model_info(model_key)
    # TODO: restore using request-supplied generation params on /recipe/evaluate
    # after implementing per-model filtering and validation of generation parameters.
    resolved_gen_params = resolve_model_params({}, gen_params)
    model = models.model_from(model_name, model_id, **model_params)
    structured_output_config = runtime_config.wrappers.structured_output
    pacer_config = runtime_config.wrappers.pacer
    retry_config = runtime_config.wrappers.retry
    pacer_exceptions = resolve_exception_classes(pacer_config.exceptions)
    retry_exceptions = resolve_exception_classes(retry_config.exceptions)

    if structured_output_config.enabled:
        model = wrappers.StructuredOutput(model)

    if pacer_config.enabled:
        model = wrappers.Pacer(
            model,
            context=get_pacer_context(model_name, model_id),
            exceptions_to_catch=pacer_exceptions,
        )

    if retry_config.enabled:
        model = wrappers.Retry(
            model,
            exceptions_to_catch=retry_exceptions,
            retries=retry_config.retries,
            raise_last_exception=retry_config.raise_last_exception,
            backoff=retry_config.backoff,
            backoff_max=retry_config.backoff_max,
            jitter=retry_config.jitter,
        )
    model.cost_tracker = cost_tracker

    logger.debug(f"Using model provider: {model_name}")
    logger.debug(f"Using model ID: {model_id}")
    logger.debug(f"Using generation parameters: {resolved_gen_params}")

    try:
        value, evidence = EvaluationRunner().run(
            template=recipe_evaluate.prompt.template,
            input_name=recipe_evaluate.prompt.input_name,
            input_value=recipe_evaluate.prompt.input_value,
            model=model,
            stream=True,
            temperature=resolved_gen_params.get("temperature"),
            top_p=resolved_gen_params.get("top_p"),
            max_new_tokens=resolved_gen_params.get("max_new_tokens"),
            verbose=eval_settings.DEV,
        )
    except RateLimitException as exc:
        cost_tracker.notebook_end(notebook_context)
        logger.warning("Returning retryable rate-limit response for %s.", get_model_lane_key(model_name, model_id))
        return build_retryable_eval_failure(
            model_name=model_name,
            model_id=model_id,
            code="rate_limited",
            message=str(exc),
            status_code=429,
        )
    except ServiceErrorException as exc:
        cost_tracker.notebook_end(notebook_context)
        logger.warning("Returning retryable service-error response for %s.", get_model_lane_key(model_name, model_id))
        return build_retryable_eval_failure(
            model_name=model_name,
            model_id=model_id,
            code="service_unavailable",
            message=str(exc),
            status_code=503,
        )

    cost_tracker.notebook_end(notebook_context)
    _, total_cost = cost_tracker.cost(print_details=eval_settings.DEV)
    if eval_settings.DEV:
        print("Cost:", total_cost)
        print("notebook_duration:", cost_tracker.notebook_duration())
        print("generate_duration:", cost_tracker.generate_duration())
        cost_tracker.stats(print_details=True)

    response = RecipeEvaluateOut(
        value=value,
        evidence=evidence,
        generation=GenerationStats(
            total_tokens_sent=cost_tracker.stats(print_details=False).total_input_tokens,
            total_tokens_generated=cost_tracker.stats(print_details=False).total_output_tokens,
            cost=total_cost if total_cost else 0.0,
            errors=[],  # TODO handle errors
            org_id=recipe_evaluate.org_id,
            event_summary_id=recipe_evaluate.event_summary_id,
            generation_id=recipe_evaluate.generation_id,
            model_id=model_key,
            model_params=resolved_gen_params or None,
            total_wall_duration=cost_tracker.notebook_duration() or 0,
            cluster_id=cost_tracker.instance_id or "",
        ),
    )
    return JSONResponse(content=response.model_dump(exclude_none=True, exclude_unset=True, mode="json", by_alias=True))


@app.get("/healthcheck")
def healthcheck():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat(), "service": "eval-service"}


def main():
    uvicorn.run("lumiflow_eval_service.main:app", host="127.0.0.1", port=8000, log_level="debug", reload=True)


if __name__ == "__main__":
    main()
