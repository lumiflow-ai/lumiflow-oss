#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
JOB_SERVICE_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd -- "$JOB_SERVICE_DIR/.." && pwd)"

BACKEND_COMPOSE_FILE="$REPO_ROOT/backend/dev-services/compose.yaml"
JOB_SERVICE_COMPOSE_FILE="$JOB_SERVICE_DIR/docker/compose.yaml"

if [[ -f "$BACKEND_COMPOSE_FILE" ]]; then
  docker compose -f "$BACKEND_COMPOSE_FILE" up -d database
else
  docker compose -f "$JOB_SERVICE_COMPOSE_FILE" up -d database
fi
