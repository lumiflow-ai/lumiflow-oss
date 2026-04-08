#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

bash scripts/pre-commit-generate-types.sh "$@"
bash scripts/pre-commit-biome.sh "$@"
npm run typecheck
npm run lint -- --error-on-warnings .
