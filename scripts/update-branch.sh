#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Fetching latest code..."
git fetch origin
git checkout cursor/improve-scan-ability-3f2f
git pull origin cursor/improve-scan-ability-3f2f

echo
echo "Done. Latest commit:"
git log --oneline -1
