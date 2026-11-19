# Schéma de la table commune `offres`

Ce document décrit `data/processed/offres.csv` : une ligne par hébergement, 19 colonnes, dans l'ordre de `COLONNES` (`src/prep/schema.py`). Le code fait foi : en cas d'écart, corriger ce document.

Les types de donnée suivent la classification de Munzner (*Visualization Analysis and Design*) : catégorielle, ordinale, quantitative, spatiale. On ajoute « identifiant » pour les clés et libellés non analysés.

## Dictionnaire de données

| Colonne | Type pandas | Type (Munzner) | Valeurs / unité | Airbnb | Hôtel (Booking) | Commentaire |
|---|---|---|---|---|---|---|
| `id` | string | identifiant | `PAR-A-00001`, `PAR-H-00001`… | généré : code ville + `A` + rang dans la ville | généré : code ville + `H` + rang dans la ville | Unique. Jamais vide. |
| `ville` | category | catégorielle | Londres, Berlin, Paris, Rome | nom du fichier source | nom du fichier source | Jamais vide. |
| `source` | category | catégorielle | `Airbnb`, `Hôtel` | constante `Airbnb` | constante `Hôtel` | Variable principale de la comparaison. |
| `type` | category | catégorielle | Logement entier, Chambre privée, Chambre partagée, Hôtel | `room_type` traduit | `Logement entier` si `highlights` contient « Entire », sinon `Hôtel` | Voir D11. |
| `etoiles` | Int64 | ordinale | 1 à 5 | vide | `stars` arrondi | Vide pour 25 % des établissements Booking (D10) et par construction pour Airbnb. |
| `nom` | string | identifiant | texte libre | vide | `title` | Libellé d'affichage (infobulle). |
| `prix_nuit_eur` | float64 | quantitative | euros par nuit, 2 décimales | `realSum / 2` (D3) | `price.value / 1,0813` (D4, D5) | Jamais vide. Sans taxes côté Booking. |
| `prix_comparable` | boolean | catégorielle (binaire) | `true` / `false` | toujours `true` | `false` pour Rome, `true` sinon | Voir D7. |
| `note_100` | Float64 | quantitative | 0 à 100 | `guest_satisfaction_overall` | `score` × 10 | « No rating » devient vide (D9). Échelles de notation différentes. |
| `nb_avis` | Int64 | quantitative | entier | vide | `reviews` arrondi | Vide par construction pour Airbnb. |
| `dist_centre_km` | float64 | quantitative | km à vol d'oiseau depuis le centre Booking, 2 décimales | recalculée depuis `lat`/`lng` et le centre Booking (D18) | `distanceFromCenter`, valeurs ≥ 100 divisées par 1000 (D6) | Jamais vide. Même point de référence pour les deux sources (D18). |
| `tranche_dist` | category (ordonnée) | ordinale | `0–1 km`, `1–2 km`, `2–4 km`, `> 4 km` | dérivée de `dist_centre_km` | idem | Bornes fermées à gauche (D14). |
| `metro_proche` | boolean | catégorielle (binaire) | `true` / `false` | `metro_dist < 0,5` km (D8) | `subwayAccess` | Définitions différentes entre sources. |
| `quartier` | string | catégorielle | nom du contour : arrondissement (Paris), Bezirk (Berlin), borough (Londres), municipio (Rome) | jointure spatiale de `lat`/`lon` sur les contours (D17) | nom Booking traduit par `data/external/correspondance_quartiers.csv` ; jointure spatiale une fois géocodé (D17) | Même référentiel pour les deux sources : clé de jointure avec `properties.quartier` de `quartiers_<ville>.geojson`. Vide pour 1 à 5 % des hôtels (Booking ne donne que la ville). |
| `lat` | Float64 | spatiale | degrés décimaux (WGS84) | `lat` | géocodage fiable (`data/external/hotels_geocodage.csv`, D19) | Renseignée pour environ 70 % des hôtels. |
| `lon` | Float64 | spatiale | degrés décimaux (WGS84) | `lng` | géocodage fiable (D19) | Comme `lat`. |
| `periode` | category | catégorielle | `semaine`, `weekend` | fichier `weekdays` / `weekends` | vide | Vide par construction pour les hôtels. |
| `capacite` | Int64 | quantitative | personnes | `person_capacity` | vide | Vide par construction pour les hôtels. |
| `superhost` | boolean | catégorielle (binaire) | `true` / `false` | `host_is_superhost` | vide | Vide par construction pour les hôtels. |

Colonnes obligatoires (jamais vides, contrôlées par `valider`) : `id`, `ville`, `source`, `type`, `prix_nuit_eur`, `prix_comparable`, `dist_centre_km`, `tranche_dist`, `metro_proche`.

Contrôles supplémentaires de `valider` : `id` unique, prix > 0, `note_100` dans [0, 100], distance ≥ 0, étoiles dans [1, 5], valeurs des colonnes catégorielles dans les ensembles autorisés.

## Format CSV pour D3

- Les booléens sont écrits `true` / `false`.
- Les valeurs manquantes sont des cellules vides.
- Prix, note et distance sont arrondis à 2 décimales.
- Avec ces conventions, `d3.csv(url, d3.autoType)` convertit directement les nombres et les booléens, et les cellules vides deviennent `null`.
- Les champs texte qui ressemblent à des nombres n'existent pas : `id` et `quartier` restent des chaînes.

Fichiers produits dans `data/processed/` :

| Fichier | Contenu |
|---|---|
| `offres.csv` | les quatre villes |
| `quartiers_<ville>.geojson` | contours simplifiés (tolérance 25 m), propriétés `ville`, `quartier`, `code` ; anneaux extérieurs dans le sens horaire pour `d3.geoPath` |
| `offres_londres.csv`, `offres_berlin.csv`, `offres_paris.csv`, `offres_rome.csv` | une ville chacun, même schéma |

Pour « changer de dataset » dans l'interface, il suffit de charger un autre fichier : les colonnes sont identiques.

## Place dans le modèle de pipeline du cours

Modèle de Ward, Grinstein et Keim : Raw data → Data transformation → Data tables → Visual mapping → Views.

| Étape du modèle | Éléments du projet |
|---|---|
| Raw data | `data/raw/` : CSV Airbnb et JSON Booking téléchargés depuis Kaggle (voir `sources.md`) |
| Data transformation | `notebooks/01_airbnb.ipynb` et `notebooks/02_hotels_booking.ipynb` (module `src/prep/`) : nettoyage, conversion, dérivation, vers `data/interim/*.parquet` |
| Data transformation (espace) | `notebooks/03_quartiers.ipynb` : contours normalisés et correspondance des noms Booking ; `notebooks/04_geocodage_hotels.ipynb` : coordonnées des hôtels (OSM, Nominatim, corrections relues) |
| Data tables | `notebooks/05_table_commune.ipynb` : fusion, rattachement aux quartiers, contrôles, écrêtage des aberrants, export de `data/processed/offres*.csv` |
| Visual mapping | `viz/` : encodages D3 (position, couleur, taille), voir `viz/README.md` |
| Views | `viz/index.html` : deux techniques liées par un état partagé (`viz/noyau/etat.js`) |
