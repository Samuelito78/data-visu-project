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

## Contours des quartiers (à venir)

