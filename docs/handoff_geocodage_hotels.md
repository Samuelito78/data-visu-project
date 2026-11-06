# Handoff : géolocaliser les hôtels Booking

Session parallèle chargée d'une seule tâche : **obtenir la latitude et la longitude de chacun des 1 705 hôtels Booking** de la table commune. Ainsi les hôtels seront placés sur la carte comme les annonces Airbnb, et pourront être rattachés à un quartier par jointure spatiale, comme elles.

Lire d'abord `README.md`, `docs/schema.md` et `docs/decisions.md` (surtout D2, D6, D7 et D15). Le contexte général du projet est dans `docs/handoff.md`.

---

## 1. État du dépôt au moment du handoff

- Dépôt : `github.com/Samuelito78/data-visu-project`, clone local dans `projet-1_DATA-VIS/data-visu-project/`.
- La préparation est sur la branche `data/collecte` : téléchargement, notebooks 01 à 03, `src/prep/`, docs et `data/processed/offres*.csv`.
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
- les notebooks 01 à 03 ;
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

(Section à remplir par la session de géocodage : décisions, seuils retenus, taux obtenus.)
