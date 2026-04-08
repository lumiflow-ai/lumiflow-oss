"""Configuration settings for AI models."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class AIModelSettings(BaseSettings):
    """Settings for AI model providers."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore")

    # OpenAI settings
    openai_api_key: str | None = None

    # Anthropic settings
    anthropic_api_key: str | None = None

    # Grok settings
    grok_api_key: str | None = None

    # Ollama settings
    ollama_api_key: str | None = None
    ollama_host: str | None = None


# Global settings instance
settings = AIModelSettings()
