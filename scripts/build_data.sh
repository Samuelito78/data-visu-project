#!/usr/bin/env bash
# Rejoue toute la préparation : exécute les notebooks dans l'ordre (sorties écrites dans les .ipynb).
set -euo pipefail
RACINE="$(cd "$(dirname "$0")/.." && pwd)"
PY="${PYTHON:-$RACINE/.venv/bin/python}"
[ -d "$RACINE/data/raw/airbnb" ] || "$RACINE/scripts/download_data.sh"
for nb in 01_airbnb 02_hotels_booking 03_table_commune; do
  echo "→ $nb"
  "$PY" -m jupyter nbconvert --to notebook --execute --inplace "$RACINE/notebooks/$nb.ipynb"
done
