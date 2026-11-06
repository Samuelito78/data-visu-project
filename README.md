# Hôtel ou Airbnb ?

Projet de visualisation de données (Master MIAGE MBDS, cours *Information Visualization* de Marco Winckler), par Luca VIZIO & Samuel BOIX-SEGURA.

> Pour un voyageur avec un budget donné, vaut-il mieux réserver un hôtel ou un Airbnb, et dans quel secteur de la ville ?

On compare les deux offres à Londres, Berlin, Paris et Rome à partir de deux datasets Kaggle, réunis dans une table commune que l'application D3 charge en fichiers statiques.

## Pipeline de données

Le découpage suit le modèle de pipeline du cours (Ward, Grinstein et Keim) :

| Étape du modèle | Ici | Sortie |
|---|---|---|
| Raw data | `scripts/download_data.sh` | `data/raw/` (non versionné) |
| Data transformation | `notebooks/01_airbnb.ipynb`, `notebooks/02_hotels_booking.ipynb` | `data/interim/*.parquet` |
| Data tables | `notebooks/03_table_commune.ipynb` | `data/processed/offres*.csv` |
| Visual mapping → Views | `viz/` (application D3, à venir) | |

La logique est dans `src/prep/`. Les notebooks l'importent, explorent les données et documentent chaque choix. Le schéma de la table commune est défini dans `src/prep/schema.py` (contrôlé par `valider()`) et décrit dans `docs/schema.md`. Les choix de nettoyage sont justifiés dans `docs/decisions.md`.

## Installation

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/nbstripout --install      # une fois par poste : retire les sorties des notebooks au commit
./scripts/build_data.sh             # télécharge les données si besoin puis exécute les 3 notebooks
.venv/bin/jupyter lab               # pour explorer
```

Le téléchargement Kaggle est anonyme : aucun jeton n'est nécessaire.

## Fichiers produits pour D3

| Fichier | Contenu |
|---|---|
| `data/processed/offres.csv` | table complète, une ligne par hébergement |
| `data/processed/offres_<ville>.csv` | une ville (`londres`, `berlin`, `paris`, `rome`) : sert à « changer de dataset » |

```js
const offres = await d3.csv("data/processed/offres_paris.csv", d3.autoType);
```

## Organisation

```
data/raw/        données Kaggle brutes (ignorées par Git)
data/interim/    une table par source, au schéma commun
data/processed/  table commune, chargée par D3
notebooks/       01 Airbnb, 02 Booking, 03 fusion et contrôles qualité
src/prep/        code partagé : schéma, transformations, fusion
scripts/         téléchargement et exécution de la préparation
docs/            schéma, décisions, sources, plan du projet
```
