#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -d "../frontend/src" ]; then
  mkdir -p "../frontend/src/generated"
  npx tsx src/scripts/generate-types.ts "../frontend/src/generated/serverTypes.ts"
fi

if [ -d "../job-service/src" ]; then
  mkdir -p "../job-service/src/generated"
  npx tsx src/scripts/generate-types.ts "../job-service/src/generated/backendTypes.ts"
fi
