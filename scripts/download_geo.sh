#!/usr/bin/env bash
# Télécharge les contours de quartiers bruts dans data/raw/geo/ (sources et licences : README.md).
set -euo pipefail

RACINE="$(cd "$(dirname "$0")/.." && pwd)"
GEO="$RACINE/data/raw/geo"
UA="data-visu-project/1.0 (projet etudiant MIAGE MBDS)"
mkdir -p "$GEO"

recuperer() {  # $1 = fichier de sortie, $2 = URL
  echo "→ $(basename "$1")"
  curl -fsSL --retry 3 -A "$UA" -o "$1" "$2"
}

# Paris : 20 arrondissements (Ville de Paris, ODbL)
recuperer "$GEO/paris_arrondissements.geojson" \
  "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/arrondissements/exports/geojson"

# Berlin : 12 Bezirke (Geoportal Berlin / ALKIS, Datenlizenz Deutschland – Zero 2.0)
recuperer "$GEO/berlin_bezirke.geojson" \
  "https://gdi.berlin.de/services/wfs/alkis_bezirke?service=WFS&version=2.0.0&request=GetFeature&typeNames=alkis_bezirke:bezirksgrenzen&outputFormat=application/json&srsName=EPSG:4326"

# Londres : 33 boroughs (ONS Open Geography Portal, Local Authority Districts décembre 2023, OGL ; contient des données OS).
# Version « BFE » (full extent) : les limites passent au milieu de la Tamise, comme à Paris, Berlin et Rome pour leur fleuve.
# Les codes E09 sont les 33 districts du Grand Londres.
recuperer "$GEO/london_boroughs_bfe.geojson" \
  "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Local_Authority_Districts_December_2023_Boundaries_UK_BFE/FeatureServer/0/query?where=LAD23CD%20LIKE%20%27E09%25%27&outFields=LAD23CD,LAD23NM&outSR=4326&f=geojson"

# Rome : 15 municipi (OpenStreetMap via Overpass, ODbL). Deux serveurs, essayés dans l'ordre.
REQ='[out:json][timeout:120];area["name"="Roma"]["admin_level"="8"]->.r;rel(area.r)["boundary"="administrative"]["admin_level"="10"]["name"~"^Municipio Roma"];out geom;'
echo "→ rome_municipi_osm.json"
for SERVEUR in https://overpass-api.de/api/interpreter https://overpass.kumi.systems/api/interpreter; do
  if curl -fsSL --retry 2 --max-time 180 -A "$UA" -o "$GEO/rome_municipi_osm.json" "$SERVEUR" --data-urlencode "data=$REQ"; then
    break
  fi
  echo "  échec sur $SERVEUR, serveur suivant"
done

ls -la "$GEO"
