#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Thesis setup check ==="
echo "Project folder: $ROOT"
echo

echo "Git branch:"
git branch --show-current || true
echo

echo "Latest commit:"
git log --oneline -1 || true
echo

echo "Expected features in App.tsx:"
if grep -q "buildLabel" frontend/src/App.tsx 2>/dev/null; then
  echo "  OK - build label found (new UI)"
else
  echo "  MISSING - run: git pull origin cursor/improve-scan-ability-3f2f"
fi
if grep -q "AuthPanel" frontend/src/App.tsx 2>/dev/null; then
  echo "  OK - login/save UI found"
else
  echo "  MISSING - saved theses code not present"
fi
echo

echo "Backend health (port 8001):"
if curl -fsS http://localhost:8001/health >/dev/null 2>&1; then
  echo "  OK - backend running"
else
  echo "  NOT RUNNING - start with: ./scripts/start-backend.sh"
fi
echo

echo "Frontend (port 5173):"
if curl -fsS http://localhost:5173 >/dev/null 2>&1; then
  echo "  OK - frontend running"
else
  echo "  NOT RUNNING - start with: ./scripts/start-frontend.sh"
fi
