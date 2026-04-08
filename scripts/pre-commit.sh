#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

if [ -f "backend/package.json" ]; then
  npm --prefix backend run pre-commit -- "$@"
fi

if [ -f "job-service/package.json" ]; then
  npm --prefix job-service run pre-commit -- "$@"
fi

if [ -f "frontend/package.json" ]; then
  npm --prefix frontend run pre-commit -- "$@"
fi

if [ -f "inference/.pre-commit-config.yaml" ]; then
  uv --directory inference run pre-commit run \
    --config inference/.pre-commit-config.yaml \
    --hook-stage pre-commit \
    "$@"
fi
