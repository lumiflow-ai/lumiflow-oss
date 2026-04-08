#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT_PREFIX="$(git rev-parse --show-prefix 2>/dev/null || true)"

if [ "$PROJECT_PREFIX" = "frontend/" ]; then
  mapfile -t STAGED_FILES < <(
    git diff --cached --name-only --diff-filter=ACMRT -- \
      ':(top)frontend/**/*.cjs' \
      ':(top)frontend/**/*.cts' \
      ':(top)frontend/**/*.js' \
      ':(top)frontend/**/*.jsx' \
      ':(top)frontend/**/*.json' \
      ':(top)frontend/**/*.jsonc' \
      ':(top)frontend/**/*.mjs' \
      ':(top)frontend/**/*.mts' \
      ':(top)frontend/**/*.ts' \
      ':(top)frontend/**/*.tsx' \
      ':(exclude,top)frontend/.next/**' \
      ':(exclude,top)frontend/.vscode/**' \
      ':(exclude,top)frontend/coverage/**' \
      ':(exclude,top)frontend/src/data/**' \
      ':(exclude,top)frontend/src/generated/**' |
      sed 's#^frontend/##'
  )
else
  mapfile -t STAGED_FILES < <(
    git diff --cached --name-only --diff-filter=ACMRT -- \
      ':(top)**/*.cjs' \
      ':(top)**/*.cts' \
      ':(top)**/*.js' \
      ':(top)**/*.jsx' \
      ':(top)**/*.json' \
      ':(top)**/*.jsonc' \
      ':(top)**/*.mjs' \
      ':(top)**/*.mts' \
      ':(top)**/*.ts' \
      ':(top)**/*.tsx' \
      ':(exclude,top).next/**' \
      ':(exclude,top).vscode/**' \
      ':(exclude,top)coverage/**' \
      ':(exclude,top)src/data/**' \
      ':(exclude,top)src/generated/**'
  )
fi

if [ "${#STAGED_FILES[@]}" -eq 0 ]; then
  exit 0
fi

npx @biomejs/biome check --error-on-warnings --write "${STAGED_FILES[@]}"
git add -- "${STAGED_FILES[@]}"
