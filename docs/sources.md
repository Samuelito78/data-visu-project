# Sources de données

## Airbnb Prices in European Cities

- URL : https://www.kaggle.com/datasets/thedevastator/airbnb-prices-in-european-cities
- Auteur : thedevastator
- Fichiers utilisés : 8 CSV (`<ville>_weekdays.csv` et `<ville>_weekends.csv` pour london, berlin, paris, rome). Les 12 autres fichiers (autres villes) sont téléchargés mais ignorés.
- Volume brut utilisé : 28 192 lignes.
- Limite : aucune date de collecte dans les fichiers.
- Licence : CC0 (domaine public), d'après les métadonnées Kaggle consultées le 6 novembre 2026. Les données dérivées peuvent être versionnées.

## 7500 hotels from Airbnb, Booking and Hotels.com

- URL : https://www.kaggle.com/datasets/mykhailozub/500-hotels-from-airbnb-booking-and-hotelscom
- Auteur : mykhailozub
- Fichiers utilisés : `London.json`, `Berlin.json`, `Paris.json`, `Rome.json`, liste `bookingHotels` uniquement (`Madrid.json` ignoré).
- Volume brut utilisé : 1 708 lignes, dont 208 pour Rome.
- Limite : collecte en 2023, pas de coordonnées, dates de séjour non précisées.
- Licence : CC0 (domaine public), d'après les métadonnées Kaggle consultées le 6 novembre 2026. Les données dérivées peuvent être versionnées.

## Téléchargement

- Script : `scripts/download_data.sh`.
- Le téléchargement est anonyme, via `https://www.kaggle.com/api/v1/datasets/download/<owner>/<slug>`. Aucun jeton Kaggle n'est requis.
- Les archives sont décompressées dans `data/raw/airbnb/` et `data/raw/hotels/`.

## Contours des quartiers

Téléchargés par `scripts/download_geo.sh` dans `data/raw/geo/` (non versionné). Ils sont normalisés par le notebook 03 dans `data/external/quartiers_<ville>.geojson`, et simplifiés pour D3 dans `data/processed/`.

| Ville | Niveau | Source | URL | Licence |
|---|---|---|---|---|
| Paris | 20 arrondissements | Ville de Paris | https://opendata.paris.fr/explore/dataset/arrondissements/ | ODbL |
| Berlin | 12 Bezirke | Geoportal Berlin (ALKIS Bezirke, service WFS) | https://gdi.berlin.de/services/wfs/alkis_bezirke | Datenlizenz Deutschland – Zero 2.0 |
| Londres | 33 boroughs (Local Authority Districts, décembre 2023, version BFE : les limites couvrent la Tamise, D17) | Office for National Statistics, Open Geography Portal | https://geoportal.statistics.gov.uk/ (couche `Local_Authority_Districts_December_2023_Boundaries_UK_BFE`, codes `E09`) | Open Government Licence ; contient des données Ordnance Survey (à citer) |
| Rome | 15 municipi | OpenStreetMap (relations `boundary=administrative`, `admin_level=10`), via Overpass | https://www.openstreetmap.org/relation/1458218 (Municipio I) | ODbL, « © les contributeurs d'OpenStreetMap » |

Attributions à reprendre dans le rapport et dans la démo : « © Ville de Paris (ODbL) », « Geoportal Berlin (DL-DE Zero 2.0) », « Contains National Statistics and Ordnance Survey data © Crown copyright and database right », « © OpenStreetMap contributors (ODbL) ».

## Géocodage des hôtels

Les coordonnées de `data/external/hotels_geocodage.csv` viennent d'OpenStreetMap, interrogé via Overpass et Nominatim (ODbL, « © les contributeurs d'OpenStreetMap »). Quelques adresses ont été relevées à la main sur des sites publics, puis géocodées ; elles sont notées dans `hotels_geocodage_corrections.csv`. Aucune page Booking n'a été extraite.

La licence des données dérivées de Paris et de Rome est l'ODbL : les fichiers `quartiers_paris.geojson` et `quartiers_rome.geojson` restent sous ODbL, avec obligation d'attribution.

