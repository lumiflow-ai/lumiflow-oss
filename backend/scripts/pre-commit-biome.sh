#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

mapfile -t STAGED_FILES < <(
  git diff --cached --name-only --diff-filter=ACMRT -- \
    ':(top)backend/**/*.cjs' \
    ':(top)backend/**/*.cts' \
    ':(top)backend/**/*.js' \
    ':(top)backend/**/*.jsx' \
    ':(top)backend/**/*.json' \
    ':(top)backend/**/*.jsonc' \
    ':(top)backend/**/*.mjs' \
    ':(top)backend/**/*.mts' \
    ':(top)backend/**/*.ts' \
    ':(top)backend/**/*.tsx' |
    sed 's#^backend/##'
)

if [ "${#STAGED_FILES[@]}" -eq 0 ]; then
  exit 0
fi

npx @biomejs/biome check --error-on-warnings --write "${STAGED_FILES[@]}"
git add -- "${STAGED_FILES[@]}"
