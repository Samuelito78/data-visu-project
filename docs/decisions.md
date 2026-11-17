# Journal des décisions de préparation des données

Chaque décision donne : ce qui est décidé, la justification chiffrée, la conséquence ou limite. Les constantes sont dans `src/prep/common.py`.

## D1. Villes retenues

- Décision : Londres, Berlin, Paris, Rome.
- Justification : ce sont les villes communes aux deux datasets. Madrid existe côté hôtels mais pas côté Airbnb.
- Conséquence : Madrid est exclue.

## D2. Source des hôtels

- Décision : liste `bookingHotels` seule.
- Justification : `hotelsComHotels` n'a ni étoiles, ni quartier (la localisation est presque toujours la ville ; à Rome, les 500 valent « Rome City Centre »), ni distance, ni métro. `airbnbHotels` (270 par ville, prix « per night » en dollars, note sur 5) sert seulement de contrôle de cohérence.
- Conséquence : `airbnbHotels` n'est pas intégrée. Une seule plateforme représente l'offre hôtelière.

## D3. Prix Airbnb

- Décision : `prix_nuit_eur = realSum / 2`.
- Justification : `realSum` est le total pour 2 personnes et 2 nuits ; on obtient le prix par nuit du logement.
- Conséquence : prix du logement, pas par personne.

## D4. Prix Booking

- Décision : on utilise `price.value` seul, sans `taxesAndCharges`, et on le traite comme un prix par nuit.
- Justification : `taxesAndCharges` manque pour 95 % des hôtels de Londres (23 renseignés sur 500, avec des ratios incohérents de 2 % à 1100 %) et pour 58 % de Berlin. Ailleurs il vaut 2 à 5 % du prix (taxe de séjour). Les médianes Booking et Hotels.com sont proches à Berlin (109 contre 112 $) et à Londres (197,5 contre 204 $), ce qui soutient l'hypothèse « par nuit ».
- Conséquence : légère sous-estimation du prix réel des hôtels (taxes exclues).

## D5. Conversion de devise

- Décision : 1 EUR = 1,0813 USD (`USD_PAR_EUR`).
- Justification : moyenne annuelle 2023 du taux de référence de la BCE, année de collecte des hôtels. À citer dans le rapport.
- Conséquence : seuls les prix Booking (en USD) sont convertis ; les prix Airbnb sont déjà en euros.

## D6. Distance au centre côté Booking

- Décision : les valeurs ≥ 100 sont des mètres lus comme des kilomètres ; on les divise par 1000.
- Justification : le champ contient des valeurs de 100 à 500 par pas de 50, qui correspondent à « 450 m » lu 450. La plus petite valeur en km est 0,5, donc aucun chevauchement. La valeur de 26,9 km (Berlin) est conservée.
- Conséquence : la règle repose sur le seuil de 100 ; un établissement réellement à plus de 100 km serait mal converti (aucun cas observé).

## D7. Rome, prix Booking

- Décision (validée par l'équipe le 6 novembre 2026) : les hôtels de Rome (208 bruts, 207 après dédoublonnage) sont **gardés, y compris dans les comparaisons de prix**. Ils sont marqués `prix_comparable = false` pour que l'interface et le rapport signalent la divergence.
- Justification de la divergence :
  - Leurs prix sont 2 à 5 fois plus élevés qu'ailleurs à étoiles égales. Médiane 3 étoiles : 513 $ contre 104 à 155 $ ; 5 étoiles : 863 $ contre 345 à 472 $.
  - Le rapport n'est pas constant, donc un nombre de nuits ne corrige pas l'écart.
  - Les autres sources du même dataset ne montrent pas une Rome aussi chère : Airbnb 77 $ la nuit, Hotels.com 297 $, contre 581 $ pour Booking.
  - La recherche Booking de Rome semble faite dans d'autres conditions que les autres villes : 207 résultats au lieu de 500, et 68 % des hôtels à moins de 2 km du centre contre environ 20 % ailleurs. C'est probablement dû à d'autres dates ou à un filtre, ce qui n'est pas vérifiable faute de dates dans les données.
- Conséquence : toute vue qui compare des prix d'hôtels doit afficher un avertissement quand Rome est sélectionnée, en s'appuyant sur `prix_comparable`. Le rapport doit présenter cette limite avec les chiffres ci-dessus. Les Airbnb de Rome ne sont pas concernés.

## D8. Proximité du métro côté Airbnb

- Décision : `metro_proche = metro_dist < 0,5` km.
- Justification : alignement sur le booléen `subwayAccess` des hôtels. Part « proche » Airbnb / Hôtels : Berlin 0,57 / 0,70 ; Londres 0,47 / 0,76 ; Paris 0,97 / 0,98 ; Rome 0,43 / 0,55.
- Conséquence : les deux définitions ne sont pas identiques ; la comparaison reste indicative.

## D9. Note

- Décision : Airbnb `guest_satisfaction_overall` (déjà sur 100) ; Booking `score` × 10 ; « No rating » (33 hôtels) devient vide.
- Justification : mise sur une échelle commune de 0 à 100.
- Conséquence : les médianes diffèrent (Airbnb environ 95, Booking environ 80). Cela reflète surtout deux systèmes de notation, pas forcément une différence de qualité.

## D10. Étoiles

- Décision : les étoiles absentes restent vides.
- Justification : 25 % des établissements Booking n'en ont pas ; les inventer biaiserait les comparaisons.
- Conséquence : les vues par étoiles excluent ces lignes.

## D11. Type d'hébergement côté Booking

- Décision : les 134 logements entiers (« Entire … » dans `highlights`) ont `type = Logement entier` et `source = Hôtel`.
- Justification : la source reflète la plateforme, le type reflète le bien.
- Conséquence : la comparaison « Hôtel contre Airbnb » par `source` mélange quelques logements entiers côté hôtels ; filtrer par `type` pour comparer à type égal.

## D12. Doublons

- Décision : Airbnb, retrait des lignes strictement identiques (aucune trouvée) ; Booking, un établissement = un lien par ville (3 doublons retirés).
- Justification : Airbnb n'a pas d'identifiant d'annonce, donc une même annonce en semaine et en week-end reste deux lignes distinctes, distinguées par `periode`.
- Conséquence : on ne peut pas apparier une annonce entre les deux périodes.

## D13. Prix aberrants

- Décision : retrait, à la fusion, des lignes dont le prix est hors des percentiles 1 % et 99 % de leur groupe (ville et source).
- Justification : environ 2 % des lignes retirées ; limite l'effet des valeurs extrêmes sur les échelles.
- Conséquence : les très bas et très hauts prix légitimes sont aussi retirés. Les lignes écartées sont listées dans le notebook 05.

## D14. Tranches de distance

- Décision : 0–1, 1–2, 2–4, > 4 km, intervalles fermés à gauche.
- Justification : donner des classes lisibles et ordonnées pour les vues agrégées.
- Conséquence : une distance de 1,00 km tombe dans « 1–2 km ».

## D15. Quartiers

- Décision : côté Booking, `location` est normalisé (suffixe de ville retiré ; « 7th arr. » devient « 7e arrondissement » ; ville seule devient vide). Ce nom intermédiaire est ensuite traduit vers les contours officiels (D16, D17).
- Justification : le découpage est hétérogène selon les villes : Paris par arrondissements ; Londres surtout par boroughs avec quelques quartiers ; Berlin par Bezirke avec quelques Ortsteile ; Rome par quartiers touristiques.
- Conséquence : le nom Booking ne sert que d'étape intermédiaire ; la table finale utilise les contours (D16).

## D16. Niveau de découpage par ville

- Décision : Paris en 20 arrondissements, Berlin en 12 Bezirke, Londres en 33 boroughs, Rome en 15 municipi.
- Justification :
  - Paris, Berlin et Londres : c'est le découpage administratif que Booking utilise déjà, presque tous les noms correspondent. Le niveau plus fin de Paris (80 quartiers administratifs) laisserait environ 6 hôtels par zone.
  - Rome : les noms Booking sont des repères touristiques (« Spagna », « Central Station »…) qui mélangent des rioni minuscules et de grands quartieri. Les municipi sont des zones de taille comparable, et chaque nom s'y rattache.
- Conséquence (couverture, après nettoyage ; zone « comparable » si ≥ 30 Airbnb et ≥ 10 hôtels) :

| Ville | Zones | Avec Airbnb | Avec hôtels | Comparables |
|---|---|---|---|---|
| Paris | 20 | 20 | 20 | 18 |
| Berlin | 12 | 12 | 12 | 10 |
| Londres | 33 | 13 | 20 | 10 |
| Rome | 15 | 13 | 13 | 1 |

  - Londres : le dataset Airbnb ne couvre que les boroughs centraux. Les boroughs périphériques seront grisés.
  - Rome : 156 hôtels sur 207 sont dans le Municipio I. La carte de Rome sert surtout aux Airbnb ; la comparaison entre sources par zone n'y est pas significative. C'est une limite à ajouter à D7.

## D17. Rattachement des offres aux quartiers

- Décision :
  - Une offre avec coordonnées (tous les Airbnb, et les hôtels géocodés de façon fiable, D19) est rattachée par jointure spatiale : point contenu dans le contour, sinon contour le plus proche à moins de 250 m.
  - Une offre sans coordonnées (hôtels pour l'instant) est rattachée par son nom Booking, via `data/external/correspondance_quartiers.csv`, table écrite à la main. Chaque ligne y est qualifiée : `identique`, `contenance` (quartier contenu dans le contour, par ex. Chiswick → Hounslow) ou `approximation`.
- Justification :
  - Airbnb : 28 187 annonces sur 28 192 tombent dans un contour, et les 5 autres, en bordure de Rome, sont à moins de 250 m.
  - Hôtels : tous les noms Booking ont un contour. Les approximations concernent 36 hôtels à Rome (« Rome City Center », « Central Station », « Tiburtino », « Trionfale », « San Giovanni ») et 1 à Londres (« West End »).
- Contours de Londres : on utilise les limites « BFE » de l'ONS, qui passent au milieu de la Tamise, et non la version « Excluding MHW » du London Datastore, qui s'arrête aux berges.
  - Les contours de Paris, Berlin et Rome couvrent déjà leur fleuve. Avec « Excluding MHW », seule la carte de Londres montrait un fleuve, sous la forme d'un vide entre les quartiers. Les quatre cartes sont maintenant traitées de la même façon : pas de cours d'eau.
  - On n'ajoute pas de couche d'eau aux autres villes : l'eau ne sert pas aux tâches de la carte (comparer des prix par quartier), et le bleu y code déjà les hôtels.
  - Effet sur les données : les 34 annonces de Londres au bord de la Tamise, auparavant rattachées au contour le plus proche, tombent maintenant dans un contour. 5 annonces changent de borough, à cause des retouches de limites entre 2011 et 2023 ; la seule annonce de Brent passe à Hammersmith and Fulham.
- Conséquence : les deux sources partagent le même référentiel de quartiers. Pour les hôtels qui ont à la fois une position et un nom Booking, les deux méthodes donnent le même quartier dans 98 à 99 % des cas (Rome : 97,7 %). Cet accord valide à la fois le géocodage et la table de correspondance.

## D18. Centre de référence des distances

- Décision : la distance au centre des Airbnb est **recalculée** à vol d'oiseau depuis le centre utilisé par Booking. La colonne `dist` d'origine est abandonnée.
- Justification :
  - Booking mesure `distanceFromCenter` depuis un point fixe par ville, estimé par le géocodage avec un écart médian de 20 à 30 m : Trafalgar Square, porte de Brandebourg, Hôtel de Ville, piazza Venezia (G1, en annexe).
  - La même méthode appliquée aux Airbnb (notebook 01, section 3 bis) explique `dist` avec un écart médian de 2 à 7 m. Le point trouvé est le même que celui de Booking à Londres (0,08 km d'écart) et à Paris (0,10 km). Il diffère à Berlin, où c'est Alexanderplatz, à 2,83 km, et à Rome, où c'est la gare Termini, à 1,75 km.
  - On recalcule côté Airbnb parce que les hôtels sans coordonnées ne sont situés que par leur distance Booking.
- Conséquence : les tranches de distance (D14) mesurent la même chose pour les deux sources. Avant cette correction, les tranches Airbnb de Berlin et de Rome étaient décalées.

## D19. Géocodage des hôtels

- Décision : on intègre les coordonnées des hôtels seulement quand le géocodage est `fiable`. Le détail de la méthode figure en annexe, décisions G1 à G5 :
  - appariement des noms avec OpenStreetMap, puis Nominatim, puis corrections relues à la main ;
  - aucune extraction des pages Booking ;
  - contrôles d'emprise, d'écart de distance (≤ 0,5 km) et de quartier.
- Justification : 1 183 hôtels sur 1 705 sont fiables (69 % ; de 67 à 73 % selon la ville). Parmi eux, l'écart médian à la distance Booking est de 0,03 km.
- Conséquence :
  - Dans la table finale, 1 166 hôtels ont une position. Les autres ont été écartés comme prix aberrants (D13).
  - Les hôtels non géocodés gardent un quartier par leur nom (D17), mais pas de point sur la carte.
  - **Biais à signaler** : les hôtels non géocodés sont surtout des indépendants et des logements entiers. Une carte de points surreprésente donc les chaînes, bien cartographiées dans OSM.

## Annexe : détail du géocodage des hôtels (G1 à G5)

Code : `src/prep/geocodage.py` ; exploration et contrôles : `notebooks/04_geocodage_hotels.ipynb`. Le contrat d'origine de cette étape (méthodes, format de sortie, contrôles) est archivé dans `docs/archives/handoff_geocodage_hotels.md`.

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

- Conséquence : la question ouverte « définition du centre » est réglée côté hôtels. Côté Airbnb, voir D18.

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
- Intégration : jointure de `hotels_geocodage.csv` sur `link` au notebook 05, en ne gardant que `fiable = true` (D19).

## Questions encore ouvertes

- Semaine et week-end : les garder séparés ou les fusionner ?
- Décalage temporel : Airbnb sans date de collecte, hôtels collectés en 2023.
- Validation du croisement des deux datasets par le superviseur.
