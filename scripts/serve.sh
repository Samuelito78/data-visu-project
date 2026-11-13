#!/usr/bin/env bash
# Lance un serveur local à la racine du dépôt, pour la visualisation D3.
# Nécessaire : d3.csv et d3.json ne fonctionnent pas en ouvrant index.html directement (file://).
# Usage : ./scripts/serve.sh            puis ouvrir http://localhost:8000/viz/
#         PORT=8080 ./scripts/serve.sh
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-8000}"
echo "Visualisation : http://localhost:${PORT}/viz/   (Ctrl+C pour arrêter)"
exec python3 -m http.server "$PORT" --bind 127.0.0.1
