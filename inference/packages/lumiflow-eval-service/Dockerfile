FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

RUN groupadd --gid 1000 appuser && \
    useradd --uid 1000 --gid appuser --shell /bin/bash --create-home appuser

WORKDIR /app

FROM base AS deps

RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

RUN pip install --no-cache-dir --upgrade pip setuptools wheel

COPY --from=ghcr.io/astral-sh/uv:0.8.4 /uv /uvx /bin/

FROM deps AS build

COPY pyproject.toml ./pyproject.toml
COPY uv.lock ./uv.lock
COPY packages/ ./packages/

RUN chown -R appuser:appuser /app

USER appuser

RUN uv sync --all-packages --no-dev --locked

FROM build AS final

USER appuser

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "lumiflow_eval_service.main:app", "--host", "0.0.0.0", "--port", "8000"]
