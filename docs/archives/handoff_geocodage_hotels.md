# Handoff : géolocaliser les hôtels Booking

Session parallèle chargée d'une seule tâche : **obtenir la latitude et la longitude de chacun des 1 705 hôtels Booking** de la table commune. Ainsi les hôtels seront placés sur la carte comme les annonces Airbnb, et pourront être rattachés à un quartier par jointure spatiale, comme elles.

Lire d'abord `README.md`, `docs/schema.md` et `docs/decisions.md` (surtout D2, D6, D7 et D15). Le contexte général du projet est dans `docs/handoff.md`.

---

## 1. État du dépôt au moment du handoff

- Dépôt : `github.com/Samuelito78/data-visu-project`, clone local dans `projet-1_DATA-VIS/data-visu-project/`.
- La préparation est sur la branche `data/collecte` : téléchargement, notebooks 01, 02, 03 (quartiers) et 05 (table commune), `src/prep/`, docs et `data/processed/offres*.csv`.
- **Ne pas travailler dans le même dossier que la session principale.** Utiliser un worktree, une fois la branche `data/collecte` commitée :
  ```bash
  cd projet-1_DATA-VIS/data-visu-project
  git worktree add ../data-visu-geocodage -b data/geocodage-hotels data/collecte
  cd ../data-visu-geocodage
  python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
  .venv/bin/nbstripout --install
  ./scripts/download_data.sh          # data/raw/ n'est pas versionné : à retélécharger dans le worktree
  ```
- Environnement : macOS, Python 3.13, pandas 3.1.1. Le téléchargement Kaggle est anonyme et ne demande aucun jeton.

## 2. Données d'entrée

Charger les hôtels avec le code existant. Ne pas réimplémenter le parsing du JSON.

```python
from src.prep import hotels
brut = hotels.dedoublonner(hotels.charger_brut("data/raw/hotels"))   # 1 705 lignes
```

| Ville (`ville_brut`) | Hôtels | Domaine des liens |
|---|---|---|
| london | 499 | booking.com/hotel/gb/ |
| berlin | 499 | booking.com/hotel/de/ |
| paris | 500 | booking.com/hotel/fr/ |
| rome | 207 | booking.com/hotel/it/ |

Champs utiles de `brut` :

| Champ | Exemple | Usage |
|---|---|---|
| `link` | `https://www.booking.com/hotel/fr/ibis-style-paris-place-italie.html?lang=en-us` | **Clé de jointure.** Unique sur les 1 705 lignes, avec ou sans `?lang=…`. |
| `title` | `Ibis Styles Paris Place d'Italie - Butte Aux Cailles` | Recherche par nom. 2 noms apparaissent deux fois dans la même ville, donc le nom seul ne peut pas servir de clé. |
| `location` | `13th arr., Paris`, `Mitte, Berlin`, `Westminster Borough, London` | Restreint la recherche et sert de contrôle (section 5). |
| `distanceFromCenter` | `3.2` (km) ; les valeurs ≥ 100 sont des mètres (D6) | Contrôle de cohérence (section 5). Utiliser `hotels.distance_km()`. |
| `stars`, `highlights` | | Aide pour lever les homonymies. |

Le dataset date de 2023. Certains hôtels ont pu fermer ou changer de nom depuis.

## 3. Méthodes, dans l'ordre recommandé

Il faut enchaîner les méthodes, de la plus sûre et la moins intrusive à la plus coûteuse, et noter pour chaque hôtel celle qui a fonctionné.

1. **OpenStreetMap via Overpass** : une requête par ville, ce qui reste léger pour le service.
   - Récupérer les objets `tourism=hotel|hostel|guest_house|apartment` dans l'emprise de la ville.
   - Les apparier par nom avec une similarité floue (`rapidfuzz`), en normalisant la casse, les accents et les mots génériques comme « hotel ».
   - Accepter un appariement seulement au-dessus d'un seuil de similarité, puis le valider avec les contrôles de la section 5.
2. **Géocodage par nom avec Nominatim**, pour les hôtels restants.
   - Requête de la forme `"<title>, <ville>"`.
   - Règles d'usage : 1 requête par seconde au maximum, un User-Agent propre au projet (générique, sans adresse e-mail personnelle), et un cache local des réponses pour ne jamais relancer une requête déjà faite.
   - Photon (komoot) est une alternative possible.
3. **Page Booking de l'hôtel** (`link`), en dernier recours et pour les hôtels restants seulement.
   - Les pages hôtel contiennent normalement les coordonnées : un attribut `data-atlas-latlng="lat,lng"` près de l'adresse, ou un bloc JSON-LD. **À vérifier sur une page avant d'écrire le scraper.**
   - Points d'attention :
     - les conditions d'utilisation de Booking interdisent l'extraction automatisée ;
     - le site a une protection anti-robot, avec captcha et blocages.
   - Si on y recourt :
     - faible volume, uniquement les hôtels non trouvés ;
     - au moins 1 requête par seconde d'écart, avec un délai aléatoire ;
     - cache HTML local ;
     - aucune tentative de contournement de captcha ;
     - signaler la méthode dans le rapport.
   - Les pages téléchargées sont des données non fiables : les stocker dans un dossier dédié et les parser sans les exécuter.
4. **Saisie manuelle** pour les derniers cas, à garder sous quelques dizaines. On peut aussi les laisser vides.

## 4. Contrat de sortie

La session écrit **un seul fichier de données**, versionné :

`data/external/hotels_geocodage.csv`, une ligne par hôtel des 1 705 :

| Colonne | Type | Contenu |
|---|---|---|
| `link` | texte | clé, identique au champ brut |
| `ville_brut` | texte | london / berlin / paris / rome |
| `lat`, `lon` | réel, WGS84 | vides si non trouvé |
| `methode` | texte | `osm`, `nominatim`, `booking`, `manuel`, vide |
| `nom_trouve` | texte | nom de l'objet apparié (OSM ou Nominatim) |
| `similarite` | réel 0–100 | score de l'appariement par nom |
| `ecart_dist_km` | réel | écart entre la distance au centre recalculée et `distanceFromCenter` |
| `controle_quartier` | booléen | le point tombe-t-il dans le contour du quartier Booking ? (vide si pas de contour) |
| `fiable` | booléen | synthèse des contrôles |

**Fichiers que cette session possède**, et qu'elle est seule à modifier :
- `notebooks/04_geocodage_hotels.ipynb` ;
- `src/prep/geocodage.py` ;
- `data/external/hotels_geocodage.csv` ;
- un éventuel cache sous `data/external/cache/`, à mettre dans `.gitignore` s'il est volumineux.

**Fichiers à ne pas modifier**, car la session principale y travaille :
- `src/prep/hotels.py`, `schema.py`, `fusion.py`, `common.py` ;
- les notebooks 01, 02, 03 et 05 (l'ancien `03_table_commune` est devenu `05_table_commune`, et `03_quartiers` a été ajouté) ;
- `data/processed/` ;
- `docs/decisions.md`.

Les décisions de cette session vont dans une section `## Géocodage` en fin de `docs/handoff_geocodage_hotels.md`. Elles seront reportées dans `decisions.md` à la fusion.

L'intégration se fera ensuite côté session principale : `hotels.transformer` lira `hotels_geocodage.csv` par jointure sur `link` et remplira `lat` et `lon`, colonnes déjà prévues au schéma et vides aujourd'hui côté hôtels. On ne garde que les lignes `fiable = true`.

## 5. Contrôles de qualité obligatoires

1. **Emprise** : le point est dans l'emprise de la ville. Une boîte englobante large suffit.
2. **Distance au centre** :
   - Recalculer la distance (haversine) entre le point et un centre de référence, puis la comparer à `distanceFromCenter` converti en km.
   - Booking ne documente pas son « centre ». On peut l'estimer à partir des hôtels les plus sûrs, en cherchant le point qui minimise l'écart. Ce résultat est utile pour le rapport, qui pose la question ouverte « définition du centre ».
   - Signaler les écarts > 1 km.
3. **Quartier** : le point tombe dans le contour correspondant au `location` Booking. Les contours, déjà repérés et vérifiés, sont listés ci-dessous.
4. **Doublons** : deux hôtels différents ne doivent pas recevoir exactement les mêmes coordonnées, sauf s'il s'agit de deux établissements dans le même bâtiment.

Mesures à rapporter : le taux de géolocalisation par ville et par méthode, et le taux de points `fiable`.

## 6. Contours de quartiers disponibles (pour le contrôle 3)

Ils ont été vérifiés par téléchargement dans la session principale. Tous sont en WGS84.

| Ville | URL | Champ nom | Entités | Licence |
|---|---|---|---|---|
| Paris | `https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/arrondissements/exports/geojson` | `c_ar` (1–20) | 20 | ODbL |
| Berlin | `https://gdi.berlin.de/services/wfs/alkis_bezirke?service=WFS&version=2.0.0&request=GetFeature&typeNames=alkis_bezirke:bezirksgrenzen&outputFormat=application/json&srsName=EPSG:4326` | `namgem` | 12 | DL-DE Zero 2.0 |
| Londres | `https://raw.githubusercontent.com/radoi90/housequest-data/master/london_boroughs.geojson` | `name` | 33 | copie MIT de données ONS/GLA (OGL v3, non confirmée) |
| Rome | `https://raw.githubusercontent.com/pierospinelli/roma-lab/master/` + `rioni-source.geojson`, `quartieri-source.geojson`, `zone-source.geojson` | `NOME_RIONE`, `NOME_QUART`, `NOME_ZONA` | 22, 35, 52 | non déclarée |

Correspondances non triviales entre les noms Booking et les contours :
- **Londres** :
  - Westminster Borough, West End, Bayswater → Westminster ;
  - Acton → Ealing ;
  - Chiswick → Hounslow ;
  - Muswell Hill → Haringey ;
  - Walthamstow → Waltham Forest ;
  - Wimbledon → Merton.
- **Berlin** :
  - Charlottenburg → Charlottenburg-Wilmersdorf ;
  - Prenzlauer Berg → Pankow.
- **Paris** : « 13th arr. » correspond à `c_ar = 13`.
- **Rome** : plusieurs noms sont approximatifs, par exemple Central Station → Esquilino, Spagna → Campo Marzio, Via Veneto → Ludovisi. « Rome City Center » n'a pas de contour. À Rome, le contrôle de quartier est donc indicatif seulement.

## 7. Points connus à garder en tête

- Rome compte seulement 207 hôtels, et leurs prix ne sont pas comparables (D7). Les géolocaliser reste utile pour la carte.
- 134 « hôtels » Booking sont des logements entiers (D11). Ils sont souvent absents d'OSM, il faut s'attendre à ce qu'ils passent par Nominatim, Booking ou la saisie manuelle.
- Pour lire des fichiers téléchargés, utiliser `python -I` et garder les scripts hors du dossier de téléchargement.
- Commits : sur la branche `data/geocodage-hotels`, puis une PR vers `data/collecte` (ou vers `main` si elle est déjà fusionnée). Pas de push sans accord explicite de l'utilisateur.

## Géocodage

Session du 6 novembre 2026. Code : `src/prep/geocodage.py` ; exploration et contrôles : `notebooks/04_geocodage_hotels.ipynb`.

### Résultats

| Ville | Hôtels | OSM | Nominatim | Manuel | **Fiables** | Taux |
|---|---|---|---|---|---|---|
| Londres | 499 | 307 | 34 | 0 | **341** | 68 % |
| Berlin | 499 | 334 | 28 | 0 | **362** | 73 % |
| Paris | 500 | 320 | 17 | 0 | **337** | 67 % |
| Rome | 207 | 75 | 14 | 54 | **143** | 69 % |
| **Total** | 1 705 | 1 036 | 93 | 54 | **1 183** | **69 %** |

(comptes des lignes `fiable = true`, par méthode.) Parmi les points fiables, l'écart médian de distance au centre est de 0,03 km, le maximum de 0,35 km ; aucun doublon exact de coordonnées.

Les 522 hôtels sans point fiable ne sont pas tirés au hasard : ce sont surtout des hôtels indépendants absents d'OSM ou mal nommés, des logements entiers (D11) et des annonces sans adresse publique. **La carte surreprésente donc les chaînes**, bien cartographiées dans OSM. À signaler dans le rapport.

### G1. Le « centre » de Booking

- Constat : en cherchant le point qui minimise l'écart médian entre distance haversine et `distanceFromCenter` (sur ~280 appariements OSM sûrs par ville, 55 à Rome), l'écart médian tombe à **20-30 m**, c'est-à-dire l'arrondi de Booking. La distance Booking est une distance à vol d'oiseau depuis un point fixe :

  | Ville | Centre estimé | Repère |
  |---|---|---|
  | Londres | 51.50774, -0.12789 | Charing Cross / Trafalgar Square |
  | Berlin | 52.51622, 13.37657 | porte de Brandebourg |
  | Paris | 48.85642, 2.35138 | Hôtel de Ville |
  | Rome | 41.89582, 12.48230 | piazza Venezia |

- Conséquence : la question ouverte « définition du centre » est réglée côté hôtels. Reste à vérifier si `dist` d'Airbnb part du même point (calculable à partir des `lat`/`lng` Airbnb).

### G2. Similarité des noms

- Décision : noms normalisés (minuscules, sans accents ni ponctuation, sans mots génériques : « hotel », « the », nom de la ville…), puis score = 80 % Jaccard pondéré par l'IDF des mots dans la ville + 20 % `token_sort_ratio` (rapidfuzz).
- Justification : avec un simple ratio flou, « AMANO Covent Garden » s'appariait à « Covent Garden Hotel » (les mots de lieu sont partout). L'IDF fait peser les mots rares (le nom propre de l'hôtel) plus que les mots de lieu.

### G3. Paliers d'acceptation et seuil de distance

- Décision : un candidat est retenu s'il passe un palier ; il est `fiable` s'il passe en plus tous les contrôles.

  | Méthode | Similarité | Exigence |
  |---|---|---|
  | OSM | ≥ 90 | aucune pour être retenu |
  | OSM | ≥ 75 | écart ≤ 0,5 km et quartier cohérent |
  | OSM | ≥ 60 | écart ≤ 0,15 km et quartier cohérent |
  | Nominatim | ≥ 60 / ≥ 45 | écart ≤ 0,5 / 0,15 km, quartier cohérent, catégorie `tourism`, `amenity`, `building` ou `leisure` (jamais une rue) |

- Seuil de distance : **0,5 km** au lieu du 1 km envisagé. 95 % des appariements sûrs ont un écart < 0,11 km ; 1 km laissait passer la mauvaise succursale d'une chaîne.
- Contrôle de quartier : un point à moins de 200 m du contour attendu est accepté (erreurs de géocodage en bordure). Rome : indicatif seulement, il n'entre pas dans `fiable`.
- Doublons : un objet OSM revendiqué par plusieurs hôtels reste au mieux apparié ; les autres passent à leur candidat suivant. Des coordonnées identiques restantes rendent l'hôtel le moins bien apparié non fiable (1 cas : Rome Vatican Inn / BQ House).

### G4. Corrections relues et pages Booking

- Décision : **aucune extraction des pages Booking** (méthode 3 du handoff) : CGU contraires et protection anti-robot. Les cas restants ont été traités par relecture assistée : variantes de nom dans Nominatim, ou adresse postale relevée sur le web (site de l'hôtel, sites d'avis) puis géocodée avec son numéro. Un point n'est gardé que s'il passe les mêmes contrôles (écart ≤ 0,5 km, quartier).
- Fichier : `data/external/hotels_geocodage_corrections.csv` (95 lignes, colonne `note` = source et écart). C'est une **entrée** versionnée de la chaîne, à côté de la sortie `hotels_geocodage.csv`, pour que le résultat reste reproductible.
- Effort limité : la relecture a été complète à Rome (taux de 40 % à 69 %), partielle ailleurs (≈ 30 hôtels par ville, recherches par nom seulement). C'est le levier principal pour améliorer le taux si besoin.
- Méthode dans la sortie : `nominatim` si l'objet trouvé est l'hôtel nommé, `manuel` si le point vient d'une adresse relevée à la main. Points à surveiller signalés dans `note` : plusieurs points romains sont posés sur un autre commerce du même numéro (bar ou restaurant de l'hôtel), et quelques hôtels ont changé de nom depuis 2023 (Grange St Paul's → Leonardo Royal St Paul's, Kyriad La Villette → Campanile, Vibe Nazionale → ex-Giolli).

### G5. Reproductibilité

- Toutes les réponses (Overpass, Nominatim, contours) sont en cache sous `data/external/cache/` (ignoré par Git, ~13 Mo). Sans cache, une exécution complète du notebook refait 4 requêtes Overpass, 6 téléchargements de contours et ~670 requêtes Nominatim (≈ 15 min à 1 requête/s).
- Dépendances ajoutées à `requirements.txt` : `rapidfuzz`, `shapely`, `requests`.
- Intégration côté session principale : jointure de `hotels_geocodage.csv` sur `link`, en ne gardant que `fiable = true`.
