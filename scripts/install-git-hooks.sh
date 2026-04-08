#!/usr/bin/env bash
set -euo pipefail

HOOK_PATH="$(git rev-parse --git-path hooks/pre-commit 2>/dev/null || true)"

if [ -z "$HOOK_PATH" ]; then
  echo "No git repository found; skipping hook installation."
  exit 0
fi

mkdir -p "$(dirname "$HOOK_PATH")"

cat > "$HOOK_PATH" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

if [ -f "scripts/pre-commit.sh" ]; then
  exec bash scripts/pre-commit.sh "$@"
fi

echo "No pre-commit hook target found." >&2
exit 1
HOOK

chmod +x "$HOOK_PATH"
echo "Installed pre-commit hook at $HOOK_PATH"
