#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SCRIPT_PATH="$(realpath "$0")"
ROOT_INSTALLER="$REPO_ROOT/scripts/install-git-hooks.sh"

if [ -f "$ROOT_INSTALLER" ] && [ "$(realpath "$ROOT_INSTALLER")" != "$SCRIPT_PATH" ]; then
  exec bash "$ROOT_INSTALLER"
fi

cd "$REPO_ROOT"
uv run pre-commit install --hook-type pre-commit
