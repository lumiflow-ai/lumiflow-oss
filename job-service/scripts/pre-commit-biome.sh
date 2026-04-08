#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT_PREFIX="$(git rev-parse --show-prefix 2>/dev/null || true)"

if [ "$PROJECT_PREFIX" = "job-service/" ]; then
  mapfile -t STAGED_FILES < <(
    git diff --cached --name-only --diff-filter=ACMRT -- \
      ':(top)job-service/src/**/*.ts' \
      ':(top)job-service/tsconfig.json' \
      ':(exclude,top)job-service/src/generated/**' |
      sed 's#^job-service/##'
  )
else
  mapfile -t STAGED_FILES < <(
    git diff --cached --name-only --diff-filter=ACMRT -- \
      ':(top)src/**/*.ts' \
      ':(top)tsconfig.json' \
      ':(exclude,top)src/generated/**'
  )
fi

if [ "${#STAGED_FILES[@]}" -eq 0 ]; then
  exit 0
fi

npx @biomejs/biome check --error-on-warnings --write "${STAGED_FILES[@]}"
git add -- "${STAGED_FILES[@]}"
