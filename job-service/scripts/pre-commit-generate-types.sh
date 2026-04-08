#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

npm run generate-types

git add src/generated/jobServiceTypes.ts
