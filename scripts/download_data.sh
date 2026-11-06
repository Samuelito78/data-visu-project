#!/usr/bin/env bash
# Télécharge les deux datasets Kaggle dans data/raw/ (téléchargement anonyme, aucun jeton requis).
set -euo pipefail

RACINE="$(cd "$(dirname "$0")/.." && pwd)"
RAW="$RACINE/data/raw"
API="https://www.kaggle.com/api/v1/datasets/download"

telecharger() {  # $1 = sous-dossier, $2 = propriétaire/slug Kaggle
  local dest="$RAW/$1"
  mkdir -p "$dest"
  echo "→ $2"
  curl -fsSL -o "$dest/$1.zip" "$API/$2"
  unzip -oq "$dest/$1.zip" -d "$dest"
  rm "$dest/$1.zip"
}

telecharger airbnb thedevastator/airbnb-prices-in-european-cities
telecharger hotels mykhailozub/500-hotels-from-airbnb-booking-and-hotelscom

echo "Fichiers dans $RAW :"
ls "$RAW"/airbnb | wc -l | xargs echo "  airbnb :"
ls "$RAW"/hotels | xargs echo "  hotels :"
