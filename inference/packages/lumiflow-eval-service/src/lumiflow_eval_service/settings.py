"""Configuration settings for the eval service."""

import json
from functools import cached_property
from pathlib import Path

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class EvalModelConfig(BaseModel):
    name: str
    id: str
    function: str | None = None
    model_params: dict = Field(default_factory=dict, alias="modelParams")
    gen_params: dict = Field(default_factory=dict, alias="genParams")

    model_config = {"populate_by_name": True}


class StructuredOutputWrapperConfig(BaseModel):
    enabled: bool = True


class PacerWrapperConfig(BaseModel):
    enabled: bool = True
    initial_delay: float = Field(default=0.0, alias="initialDelay")
    min_delay: float = Field(default=0.0, alias="minDelay")
    max_delay: float = Field(default=5.0, alias="maxDelay")
    decay: float = 0.9
    increment: float = 1.0
    exceptions: list[str] = Field(default_factory=lambda: ["RateLimitException", "ServiceErrorException"])

    model_config = {"populate_by_name": True}


class RetryWrapperConfig(BaseModel):
    enabled: bool = True
    retries: int = 2
    raise_last_exception: bool = Field(default=True, alias="raiseLastException")
    backoff: float = 1.0
    backoff_max: float = Field(default=5.0, alias="backoffMax")
    jitter: float = 0.5
    exceptions: list[str] = Field(default_factory=lambda: ["RateLimitException", "ServiceErrorException"])

    model_config = {"populate_by_name": True}


class WrapperConfig(BaseModel):
    structured_output: StructuredOutputWrapperConfig = Field(
        default_factory=StructuredOutputWrapperConfig, alias="structuredOutput"
    )
    pacer: PacerWrapperConfig = Field(default_factory=PacerWrapperConfig)
    retry: RetryWrapperConfig = Field(default_factory=RetryWrapperConfig)

    model_config = {"populate_by_name": True}


class EvalRuntimeConfig(BaseModel):
    fake_model_key: str = Field(default="fake", alias="fakeModelKey")
    models: dict[str, EvalModelConfig]
    wrappers: WrapperConfig = Field(default_factory=WrapperConfig)

    model_config = {"populate_by_name": True}


class EvalServiceSettings(BaseSettings):
    """Settings for the eval service."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore")

    # Enable development mode with verbose logging and other features
    DEV: bool = False

    # Whether to use the fake model that generates random responses instead of real LLMs
    FAKE_MODEL: bool = False

    # Optional inline JSON config override for models and wrappers.
    eval_config_json: str | None = None

    # Path to eval-service runtime config when eval_config_json is not set.
    eval_config_path: str = str(Path(__file__).resolve().parent / "default_eval_config.json")

    @cached_property
    def eval_runtime_config(self) -> EvalRuntimeConfig:
        if self.eval_config_json:
            config_data = json.loads(self.eval_config_json)
            return EvalRuntimeConfig.model_validate(config_data)

        config_file = Path(self.eval_config_path)
        if not config_file.exists():
            raise ValueError(f"Eval config file not found: {config_file}")

        with config_file.open("r", encoding="utf-8") as f:
            return EvalRuntimeConfig.model_validate(json.load(f))


settings = EvalServiceSettings()
