#!/usr/bin/env bash
cd "$(dirname "$0")"
source .venv/bin/activate
exec uvicorn backend.main:app --reload --port 8001
