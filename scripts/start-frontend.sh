#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/frontend"

if [[ ! -f package.json ]]; then
  echo "ERROR: frontend/package.json not found."
  echo "Are you in the Thesis project folder?"
  exit 1
fi

npm install
echo "Starting frontend on http://localhost:5173"
exec npm run dev
