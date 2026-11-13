# Handoff : projet de visualisation « Hôtel ou Airbnb ? »

Ce document résume ce qui a été décidé dans une conversation précédente avec Claude, pour reprendre le travail dans Claude Code. **Le périmètre de cette reprise est uniquement la première partie : collecte des données et construction de la table commune.** Les visualisations D3 viendront après.

---

## 1. Contexte du projet

- Formation : Master MIAGE, parcours MBDS, M2.
- Cours : *Information Visualization*, Marco Winckler (Université Côte d'Azur, Polytech Nice, I3S).
- Équipe : deux étudiants. Le prof demande **une technique de visualisation par étudiant**.
- Outils de l'équipe : un dépôt GitHub déjà créé ; Jupyter Notebook pour la préparation des données.

### Consignes du prof

Liste reprise des diapositives du cours :

- analyser un dataset Kaggle multivarié, validé par le superviseur ;
- décrire le pipeline de visualisation, des données brutes aux variables visuelles ;
- décrire les utilisateurs cibles, les objectifs de visualisation et les tâches utilisateur ;
- proposer une technique par étudiant, **en D3.js**, avec :
  - des interactions (navigation, sélection, filtres) ;
  - deux niveaux, vue d'ensemble et détails ;
  - la possibilité de changer de dataset ;
- fournir une démonstration exécutable.

L'évaluation comprend un rapport d'environ 15 pages maximum, une présentation avec démo, le code source et un examen écrit.

### Contraintes technologiques

- **D3.js est obligatoire pour les visualisations** (cours 1, diapo 54 : « Propose 1 visualization technique using D3JS »). La démo doit être exécutable.
- **Rien n'est imposé pour la préparation des données.** Python, pandas et Jupyter sont donc un choix libre et raisonnable.
- Conséquence directe pour cette étape : la sortie de la préparation doit être **des fichiers statiques que D3 sait charger** (`d3.csv`, `d3.json`), versionnés dans le dépôt. La démo ne doit pas dépendre d'un serveur Python.

---

## 2. Problématique

> En tant que voyageur, avec un budget donné, est-il plus intéressant de réserver un hôtel ou un Airbnb, et dans quel secteur de la ville ?

On compare les deux offres sur quatre critères : le prix, la note, la distance au centre et l'accès au métro. La comparaison porte sur les quatre villes communes aux deux datasets : **Londres, Berlin, Paris, Rome**.

L'utilisateur cible est un voyageur non expert, en couple ou en petit groupe. La problématique est descriptive : on montre où et comment les offres diffèrent, sans chercher à expliquer pourquoi.

---

## 3. Les deux datasets

> ⚠️ Les noms de colonnes ci-dessous viennent de mémoire et du plan de l'équipe. **Ils sont à vérifier sur les vrais fichiers** avant d'écrire du code qui en dépend.

### A. Airbnb Prices in European Cities

- Lien : https://www.kaggle.com/datasets/thedevastator/airbnb-prices-in-european-cities
- Format : CSV, un fichier par ville et par période (semaine / week-end). On garde les 8 fichiers des 4 villes communes.
- Volume total : environ 51 700 annonces sur 10 villes.
- Colonnes attendues :

| Colonne | Contenu |
|---|---|
| `realSum` | **prix total pour 2 personnes et 2 nuits**, en € |
| `room_type`, `room_shared`, `room_private` | type de logement |
| `person_capacity`, `bedrooms` | capacité |
| `host_is_superhost`, `multi`, `biz` | profil de l'hôte |
| `cleanliness_rating` | propreté, sur 10 |
| `guest_satisfaction_overall` | satisfaction, sur 100 |
| `dist` | distance au centre, en km |
| `metro_dist` | distance au métro le plus proche, en km |
| `attr_index`, `rest_index` (et versions `_norm`) | indices d'attractions et de restaurants |
| `lng`, `lat` | coordonnées |

- Limites : pas de date précise de collecte dans les fichiers.

### B. 7500 hotels from Airbnb, Booking and Hotels.com

- Lien : https://www.kaggle.com/datasets/mykhailozub/500-hotels-from-airbnb-booking-and-hotelscom
- Format : JSON, environ 500 établissements par site et par ville, collecte en 2023.
- Villes : Londres, Berlin, Paris, Madrid, Rome. Madrid n'existe pas côté Airbnb et est exclue.
- Contenu attendu :
  - prix en **USD** ;
  - nombre d'étoiles ;
  - note sur 10 et nombre d'avis ;
  - **quartier** ;
  - distance au centre (km) ;
  - accès au métro (oui / non).
- Limites :
  - **pas de latitude ni de longitude** ;
  - prix pour des dates non précisées, sans savoir s'il s'agit d'un prix par nuit ou pour le séjour (à vérifier) ;
  - structure JSON à découvrir : niveau d'imbrication, champ indiquant le site source.

---

## 4. Décisions déjà prises

- **Une table commune, une ligne par hébergement**, avec une colonne `source` (Airbnb ou hôtel).
- **Côté hôtels, on ne garde que les résultats Booking des 4 villes communes.** C'est le choix du plan actuel. Il reste à confirmer si Hotels.com doit être ajouté et si les résultats « Airbnb » du dataset hôtels doivent être ignorés ; voir la section 8.
- **Prix** : prix par nuit en €.
  - Airbnb : `realSum / 2`. On garde l'hypothèse « 2 personnes », mais le prix reste celui du logement.
  - Hôtels : conversion USD → EUR, avec un taux fixe documenté.
- **Note** : ramenée sur 100.
  - Airbnb : `guest_satisfaction_overall` tel quel.
  - Hôtels : note sur 10 × 10.
- **Métro proche** : booléen.
  - Airbnb : `metro_dist < seuil`, avec un seuil proposé de 0,5 km, à fixer.
  - Hôtels : le champ oui / non tel quel.
- **Tranches de distance au centre** : `0–1 km`, `1–2 km`, `2–4 km`, `> 4 km`.
- **Période** : semaine / week-end côté Airbnb, absente côté hôtels.
- **Nettoyage** : retirer les doublons et les prix aberrants. La méthode reste à choisir et à documenter, par exemple écarter les valeurs hors des percentiles 1–99 par ville et par source.

### Piste importante : le rattachement aux quartiers

Les hôtels n'ont pas de GPS, mais ils ont un **quartier**. Pour comparer les deux sources par secteur sur une vraie carte :

1. récupérer un GeoJSON des quartiers de chaque ville : boroughs de Londres, arrondissements de Paris, Bezirke ou Ortsteile de Berlin, municipi ou rioni de Rome ;
2. rattacher chaque annonce Airbnb à son quartier par jointure spatiale sur `lat` / `lng`, avec geopandas ;
3. rattacher chaque hôtel par le **nom** de quartier, via une table de correspondance écrite à la main.

Il faut **mesurer le taux de rattachement des hôtels**. S'il est trop faible, on se replie sur les tranches de distance seulement. Cette étape décide de la faisabilité de la carte choroplèthe, l'une des techniques envisagées.

---

## 5. Schéma cible de la table commune

C'est un premier jet, à confirmer ensemble avant de coder la fusion. Il servira aussi de dictionnaire de données pour le rapport.

| Colonne | Type | Côté Airbnb | Côté hôtels |
|---|---|---|---|
| `id` | texte | généré, par ex. `PAR-A-00001` | généré, par ex. `PAR-H-00001` |
| `ville` | catégorie | nom du fichier | ville de recherche |
| `source` | catégorie | `Airbnb` | `Hôtel` |
| `type` | catégorie | `room_type` (logement entier, chambre privée, chambre partagée) | `Hôtel` |
| `etoiles` | entier, nul côté Airbnb | — | nombre d'étoiles |
| `nom` | texte | — ou généré | nom de l'hôtel |
| `prix_nuit_eur` | réel | `realSum / 2` | prix converti en € (et divisé si prix séjour) |
| `note_100` | réel | `guest_satisfaction_overall` | note × 10 |
| `nb_avis` | entier | — | nombre d'avis |
| `dist_centre_km` | réel | `dist` | distance au centre |
| `tranche_dist` | catégorie | dérivée | dérivée |
| `metro_proche` | booléen | `metro_dist < seuil` | accès métro |
| `quartier` | texte | jointure spatiale | nom normalisé |
| `lat`, `lon` | réel, nul côté hôtels | `lat`, `lng` | — |
| `periode` | catégorie | `semaine` / `weekend` | nul |
| `capacite` | entier | `person_capacity` | — |
| `superhost` | booléen | `host_is_superhost` | — |

### Fichiers de sortie

À placer dans `data/processed/`, chargeables par D3 :

- `offres.csv` : table complète ;
- `offres_<ville>.csv` : un fichier par ville. Cela sert directement la consigne « changer de dataset » côté D3 ;
- `quartiers_<ville>.geojson` : contours simplifiés, si le rattachement aux quartiers est retenu.

---

## 6. Organisation proposée du dépôt

```
data/
  raw/            # fichiers Kaggle bruts — NON versionnés (.gitignore), récupérés par script
  external/       # GeoJSON des quartiers (sources et licences notées dans docs/sources.md)
  interim/        # sorties intermédiaires de chaque notebook (une par source)
  processed/      # table commune finale, versionnée (c'est ce que D3 charge)
notebooks/
  01_airbnb_exploration_nettoyage.ipynb
  02_hotels_exploration_nettoyage.ipynb
  03_quartiers_rattachement.ipynb
  04_table_commune.ipynb
src/prep/         # fonctions Python partagées (chargement, normalisation, contrôles)
scripts/
  download_data.sh   # téléchargement via l'API Kaggle
docs/
  schema.md       # dictionnaire de données (alimente le rapport)
  decisions.md    # journal des choix : taux de change, seuils, exclusions, avec justification
  sources.md
viz/              # plus tard : application D3
requirements.txt
.gitignore
README.md
```

Pour le téléchargement, l'API Kaggle demande un jeton `~/.kaggle/kaggle.json` que chacun crée de son côté. Les commandes sont `kaggle datasets download -d thedevastator/airbnb-prices-in-european-cities` et `kaggle datasets download -d mykhailozub/500-hotels-from-airbnb-booking-and-hotelscom`. Il faut aussi vérifier la licence de chaque dataset avant de versionner des données dérivées.

Dépendances probables : `pandas`, `numpy`, `geopandas`, `shapely`, `pyarrow` (pour les fichiers intermédiaires en Parquet), `jupyter`, `nbstripout`.

---

## 7. Travailler à deux sans conflits

Les notebooks Jupyter se fusionnent mal dans Git. Règles proposées :

- **Un notebook appartient à une seule personne à la fois.** Jamais deux personnes sur le même `.ipynb` en parallèle.
- **Vider les sorties avant chaque commit** avec `nbstripout`, installé une fois par chacun : `nbstripout --install`. Les diffs restent lisibles.
- **La logique réutilisable va dans `src/prep/` en `.py`.** Les notebooks l'importent et servent à explorer, montrer et documenter.
- **Une branche par tâche, puis une pull request relue par l'autre** avant fusion dans `main`.
- **Le contrat entre les deux** : chaque notebook de source écrit un fichier intermédiaire au **schéma de la section 5**, dans `data/interim/` (`airbnb.parquet`, `hotels.parquet`). Tant que ce schéma est respecté, chacun avance sans attendre l'autre.

### Répartition proposée

| | Personne A : Airbnb + quartiers | Personne B : hôtels |
|---|---|---|
| Exploration | 8 CSV des 4 villes : colonnes, types, valeurs manquantes, distributions | Structure du JSON : imbrication, champ du site source, unités de prix |
| Transformation | Prix par nuit, note, `metro_proche`, période, tranches de distance | Aplatir le JSON, filtrer source et villes, USD → EUR, note × 10, dédoublonnage |
| Quartiers | GeoJSON des 4 villes, jointure spatiale des annonces | Normalisation des noms de quartiers et table de correspondance vers les GeoJSON de A |
| Sortie | `data/interim/airbnb.parquet` | `data/interim/hotels.parquet` |

À faire ensemble : valider le schéma (section 5) **avant** de coder, écrire `04_table_commune.ipynb` (fusion, contrôles, export CSV / GeoJSON) et tenir `docs/decisions.md` à jour.

### Contrôles qualité à prévoir dans le notebook de fusion

- Nombre de lignes par ville et par source, avant et après nettoyage.
- Valeurs manquantes par colonne et par source.
- Distributions de prix et de notes par ville et par source, avec repérage des aberrants.
- Cohérence des distances au centre entre les deux sources.
- Taux de rattachement des hôtels à un quartier.

---

## 8. Questions ouvertes à trancher

1. Le prix du JSON hôtels est-il **par nuit ou pour le séjour**, et pour quelles dates ?
2. Quel **taux de change USD → EUR** retenir ? Proposition : la moyenne annuelle 2023 de la BCE, cohérente avec l'année de collecte, à vérifier et à citer dans le rapport.
3. Quel **seuil de distance au métro** côté Airbnb, pour l'aligner sur l'oui / non des hôtels ? Proposition : 500 m.
4. **Booking seul, ou Booking + Hotels.com** pour l'offre hôtelière ? Le dataset hôtels contient aussi des résultats Airbnb : sont-ils à écarter, ou servent-ils de contrôle de cohérence avec l'autre dataset ?
5. Garder **semaine et week-end séparés**, ou les fusionner ?
6. Comment traiter le **décalage temporel** entre les deux collectes (Airbnb sans date connue, hôtels en 2023) ? Au minimum, le documenter comme limite.
7. Validation du croisement des deux datasets par le superviseur : **encore à faire**.

---

## 9. Pour situer la suite (hors périmètre de cette reprise)

Les techniques envisagées, une par étudiant, restent à répartir. Elles correspondent aux familles citées par le prof :

- **carte choroplèthe par quartier** (localisation) ;
- **coordonnées parallèles** ou **parallel sets** (multivarié) ;
- **sunburst** ville → quartier → type (hiérarchie).

Une maquette interactive avec des données fictives existe sur claude.ai. Elle utilise un schéma proche de la section 5, ce qui permettra de brancher les vraies données facilement.

---

## 10. Première chose à faire dans Claude Code

1. Inspecter l'état actuel du dépôt avant toute modification.
2. Proposer la structure de la section 6, adaptée à ce qui existe déjà, et **attendre validation** avant de créer des fichiers.
3. Ensuite : `requirements.txt`, `.gitignore` (dont `data/raw/`), script de téléchargement, puis un premier notebook d'exploration par source qui confirme les vrais noms de colonnes et répond aux questions 1 et 4 de la section 8.
