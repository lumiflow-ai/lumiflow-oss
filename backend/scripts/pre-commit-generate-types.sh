#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

npm run generate:types
npm run generate:client-types

git add src/types.ts

if [ -e "../frontend/src/generated/serverTypes.ts" ]; then
  git add "../frontend/src/generated/serverTypes.ts"
fi

if [ -e "../job-service/src/generated/backendTypes.ts" ]; then
  git add "../job-service/src/generated/backendTypes.ts"
fi
