# Hôtel ou Airbnb ?

Projet de visualisation de données. Master MIAGE MBDS, cours *Information Visualization* de Marco Winckler (Université Côte d'Azur). Par Luca VIZIO et Samuel BOIX-SEGURA.

> Pour un voyageur avec un budget donné, vaut-il mieux réserver un hôtel ou un Airbnb, et dans quel secteur de la ville ?

## Description du projet

Quand on prépare un court séjour dans une grande ville, on hésite souvent entre un hôtel et un Airbnb, sans savoir lequel est le plus avantageux, ni où loger. Les sites de réservation présentent les deux offres séparément, ce qui empêche de les comparer.

Notre projet réunit ces deux offres dans une même visualisation interactive, pour quatre capitales européennes : Londres, Berlin, Paris et Rome. Il s'adresse à un voyageur non expert qui part à deux, avec un budget par nuit en tête. Il compare les deux types d'hébergement sur quatre critères qui comptent pour lui :
- le prix par nuit ;
- la note des clients ;
- la distance au centre ;
- l'accès au métro.

Il montre comment ces critères varient d'un quartier à l'autre.

Les données viennent de deux datasets Kaggle :
- environ 28 000 annonces Airbnb ;
- 1 700 hôtels Booking.

Nous les avons transformés en une table commune d'environ 29 000 offres : prix convertis en euros par nuit, notes ramenées sur 100, distances mesurées depuis un même centre et accès au métro aligné. Chaque offre est rattachée à un quartier officiel : arrondissement, Bezirk, borough ou municipio. Les hôtels, qui n'avaient pas de coordonnées, ont été géolocalisés pour 69 % d'entre eux.

La visualisation, développée en D3.js, propose une vue d'ensemble par ville, par distance et par quartier. Elle permet ensuite de filtrer selon ses critères, puis d'afficher le détail d'une offre. La problématique reste descriptive : on montre où et comment les deux offres diffèrent, sans chercher à l'expliquer.

## Sources

| Dataset | Lien | Ce qui est utilisé |
|---|---|---|
| Airbnb Prices in European Cities | [kaggle.com/datasets/thedevastator/…](https://www.kaggle.com/datasets/thedevastator/airbnb-prices-in-european-cities) | 8 CSV, pour Londres, Berlin, Paris et Rome en semaine et le week-end : 28 192 annonces |
| 7500 hotels from Airbnb, Booking and Hotels.com | [kaggle.com/datasets/mykhailozub/…](https://www.kaggle.com/datasets/mykhailozub/500-hotels-from-airbnb-booking-and-hotelscom) | la liste Booking des 4 mêmes villes : 1 705 hôtels |

Les deux datasets sont sous licence CC0. Les contours des quartiers (Ville de Paris, Geoportal Berlin, London Datastore, OpenStreetMap) et le géocodage (OpenStreetMap) ont leurs propres licences et mentions obligatoires, détaillées dans [`docs/sources.md`](docs/sources.md).

## Documentation

| Document | Contenu |
|---|---|
| [`docs/utilisateurs_taches.md`](docs/utilisateurs_taches.md) | Utilisateurs visés, besoins, catalogue des tâches utilisateur et limites des données |
| [`docs/workflow.md`](docs/workflow.md) | Workflow complet : chaque script, ce qu'il lit, ce qu'il fait, ce qu'il produit, jusqu'au dataset visualisé |
| [`docs/schema.md`](docs/schema.md) | Dictionnaire de données de la table commune : types de Munzner, unités, dérivation par source |
| [`docs/decisions.md`](docs/decisions.md) | Journal des choix de préparation (D1 à D19), avec leur justification chiffrée |
| [`docs/sources.md`](docs/sources.md) | Sources, licences et attributions |
| [`docs/documentation.html`](docs/documentation.html) | Toute la documentation ci-dessus, sur une seule page lisible dans un navigateur |
| [`viz/README.md`](viz/README.md) | Application D3 : organisation, contrat d'une vue, état partagé, règles communes |

## Workflow en bref

Le découpage suit le modèle de pipeline du cours (Ward, Grinstein et Keim). Le détail de chaque étape est dans [`docs/workflow.md`](docs/workflow.md).

| Étape du modèle | Script | Sortie | Lignes |
|---|---|---|---|
| Raw data | `scripts/download_data.sh`, `scripts/download_geo.sh` | `data/raw/` (non versionné) | 51 707 annonces, 5 JSON, 4 jeux de contours |
| Data transformation | `notebooks/01_airbnb.ipynb` | `data/interim/airbnb.parquet` | 28 192 |
| Data transformation | `notebooks/02_hotels_booking.ipynb` | `data/interim/hotels.parquet` | 1 705 |
| Data transformation | `notebooks/03_quartiers.ipynb` | `data/external/quartiers_*.geojson`, `data/processed/quartiers_*.geojson` | 80 quartiers |
| Data transformation | `notebooks/04_geocodage_hotels.ipynb` | `data/external/hotels_geocodage.csv` | 1 183 positions fiables |
| Data tables | `notebooks/05_table_commune.ipynb` | `data/processed/offres*.csv` | 29 315 |
| Visual mapping → Views | `viz/` (application D3, voir [`viz/README.md`](viz/README.md)) | `viz/index.html` | |

La logique de préparation est dans `src/prep/`, que les notebooks importent. Le schéma de la table commune est défini dans `src/prep/schema.py`, et chaque étape le vérifie avant d'écrire.

## Répartition du travail

*À compléter par l'équipe : chacun indique la partie réalisée par l'autre.*

| Partie | Réalisée par |
|---|---|
| Choix des datasets, problématique | |
| Collecte et préparation des données (notebooks 01, 02, 05) | |
| Quartiers et géolocalisation des hôtels (notebooks 03, 04) | |
| Documentation (utilisateurs, tâches, workflow) | |
| Technique de visualisation 1 (D3) | |
| Technique de visualisation 2 (D3) | |
| Rapport et soutenance | |

## Lancer la visualisation

Rien à installer : les données traitées et D3 sont dans le dépôt.

```bash
./scripts/serve.sh        # serveur local à la racine du dépôt (Python 3, déjà présent sur macOS et Linux)
```

Puis ouvrir <http://localhost:8000/viz/>. Ouvrir `viz/index.html` directement ne marche pas : le navigateur bloque le chargement des CSV en `file://`. L'organisation du code D3 et le contrat d'une vue sont décrits dans [`viz/README.md`](viz/README.md).

## Préparation des données : installation et exécution

Seulement pour modifier ou rejouer la préparation (Python 3.11+).

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/nbstripout --install        # une fois par poste : retire les sorties des notebooks au commit
./scripts/build_data.sh               # télécharge les données si besoin, puis exécute les notebooks
                                      # (GEOCODER=1 ./scripts/build_data.sh rejoue aussi le géocodage, ~15 min)
.venv/bin/python scripts/build_doc.py # régénère docs/documentation.html
.venv/bin/jupyter lab                 # pour explorer les notebooks
```

Le téléchargement Kaggle est anonyme : aucun jeton n'est nécessaire. Les données traitées sont versionnées. On peut donc lancer la visualisation sans rien exécuter.

## Travailler à deux

- **`main` reste toujours démontrable** : on n'y pousse pas directement, tout passe par une pull request relue par l'autre.
- **Une branche par sujet**, partie de `main` à jour (`git switch main && git pull`) :
  - `viz/technique-1`, `viz/technique-2` : chacun sa technique, dans son dossier `viz/technique-N/` ;
  - `viz/commun-…` : une modification du socle partagé (`viz/commun/`, `style.css`, `index.html`, `main.js`), dans une PR à part et courte, pour limiter les conflits ;
  - `data/…` : une modification de la préparation.
- **Ne jamais modifier `data/processed/` à la main** : ces fichiers sont produits par `notebooks/05_table_commune.ipynb`. Pour changer une colonne, modifier `src/prep/` puis relancer `./scripts/build_data.sh`, et commiter les CSV régénérés avec le code.
- **Notebooks** : lancer `.venv/bin/nbstripout --install` une fois par poste, sinon les sorties des notebooks partent dans les commits.
- **Décisions** : un choix de préparation ou d'encodage qui change ce que montre la visualisation s'ajoute dans `docs/decisions.md`. Il servira au rapport.

## Fichiers chargés par D3

| Fichier | Contenu |
|---|---|
| `data/processed/offres.csv` | table complète : une ligne par hébergement, 19 colonnes |
| `data/processed/offres_<ville>.csv` | une ville (`londres`, `berlin`, `paris`, `rome`), pour « changer de dataset » |
| `data/processed/quartiers_<ville>.geojson` | contours simplifiés des quartiers, orientés pour `d3.geoPath` |

```js
const offres = await d3.csv("data/processed/offres_paris.csv", d3.autoType);
const zones = await d3.json("data/processed/quartiers_paris.geojson");  // relier par offre.quartier = feature.properties.quartier
```

## Organisation du dépôt

```
data/raw/        données brutes téléchargées (ignorées par Git)
data/interim/    une table par source, au schéma commun
data/external/   contours des quartiers, correspondance des noms Booking, géocodage des hôtels
data/processed/  table commune et contours, chargés par D3
viz/             application D3 : socle commun (viz/commun/) et une technique par étudiant
notebooks/       01 Airbnb, 02 Booking, 03 quartiers, 04 géocodage, 05 table commune
src/prep/        code de préparation : schéma, transformations, quartiers, géocodage, fusion
scripts/         téléchargement, exécution de la chaîne, serveur local, génération de la doc HTML
docs/            documentation (et docs/archives/ : documents de travail)
```
