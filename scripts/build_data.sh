#!/usr/bin/env bash
# Rejoue toute la préparation : exécute les notebooks dans l'ordre (sorties écrites dans les .ipynb).
set -euo pipefail
RACINE="$(cd "$(dirname "$0")/.." && pwd)"
PY="${PYTHON:-$RACINE/.venv/bin/python}"
[ -d "$RACINE/data/raw/airbnb" ] || "$RACINE/scripts/download_data.sh"
[ -f "$RACINE/data/raw/geo/rome_municipi_osm.json" ] || "$RACINE/scripts/download_geo.sh"
# 04 (géocodage des hôtels) interroge OSM et Nominatim (~15 min sans cache) : son résultat,
# data/external/hotels_geocodage.csv, est versionné. Il n'est rejoué qu'avec GEOCODER=1.
for nb in 01_airbnb 02_hotels_booking 03_quartiers 04_geocodage_hotels 05_table_commune; do
  if [ "$nb" = 04_geocodage_hotels ] && [ "${GEOCODER:-0}" != 1 ]; then
    echo "· $nb ignoré (résultat versionné ; GEOCODER=1 pour le rejouer)"; continue
  fi
  echo "→ $nb"
  "$PY" -m jupyter nbconvert --to notebook --execute --inplace "$RACINE/notebooks/$nb.ipynb"
done
