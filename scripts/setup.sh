#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

[ -f .env ] || cp .env.example .env
[ -f frontend/.env.local ] || cp frontend/.env.example frontend/.env.local
[ -f backend/.env ] || cp backend/.env.example backend/.env

echo "Environment files are ready."
echo "Next step: docker compose up --build"
