from lumiflow_eval_service.fake import func_evaluation_response
from lumiflow_eval_service.settings import settings as eval_settings, EvalModelConfig

from typing import TypeAlias

ModelKey: TypeAlias = str
ModelName: TypeAlias = str
ModelID: TypeAlias = str
ModelParams: TypeAlias = dict
GenParams: TypeAlias = dict
ModelInfo: TypeAlias = tuple[ModelName, ModelID, ModelParams, GenParams]

FAKE_MODEL_KEY: ModelKey = eval_settings.eval_runtime_config.fake_model_key


def _resolve_function(function_name: str):
    function_registry = {
        "fake_evaluation_response": func_evaluation_response,
    }
    resolved = function_registry.get(function_name)
    if not resolved:
        raise ValueError(f"Unknown function '{function_name}' in eval model config.")
    return resolved


def _model_info_from_config(model_config: EvalModelConfig) -> ModelInfo:
    model_params = dict(model_config.model_params)
    gen_params = dict(model_config.gen_params)

    if model_config.function:
        model_params["function"] = _resolve_function(model_config.function)

    return model_config.name, model_config.id, model_params, gen_params


available_models: dict[ModelKey, ModelInfo] = {
    key: _model_info_from_config(model_config) for key, model_config in eval_settings.eval_runtime_config.models.items()
}
