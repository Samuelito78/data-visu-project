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

- Décision : les 208 hôtels de Rome sont gardés avec `prix_comparable = false`.
- Justification : leurs prix sont 2 à 5 fois plus élevés qu'ailleurs à étoiles égales. Médiane 3 étoiles : 513 $ contre 104 à 155 $ ; 5 étoiles : 863 $ contre 345 à 472 $. Le rapport n'est pas constant, donc un nombre de nuits ne corrige pas l'écart.
- Conséquence : les vues de prix doivent filtrer ou signaler ces lignes. **Décision finale à prendre par l'équipe** : exclure Rome des comparaisons de prix hôtels, ou la garder avec un avertissement.

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
- Conséquence : les très bas et très hauts prix légitimes sont aussi retirés. Les lignes écartées sont listées dans le notebook 03.

## D14. Tranches de distance

- Décision : 0–1, 1–2, 2–4, > 4 km, intervalles fermés à gauche.
- Justification : donner des classes lisibles et ordonnées pour les vues agrégées.
- Conséquence : une distance de 1,00 km tombe dans « 1–2 km ».

## D15. Quartiers

- Décision : côté Booking, `location` est normalisé (suffixe de ville retiré ; « 7th arr. » devient « 7e arrondissement » ; ville seule devient vide). Côté Airbnb, `quartier` reste vide en attendant la jointure spatiale avec des contours (étape suivante).
- Justification : le découpage est hétérogène selon les villes : Paris par arrondissements ; Londres surtout par boroughs avec quelques quartiers ; Berlin par Bezirke avec quelques Ortsteile ; Rome par quartiers touristiques.
- Conséquence : les quartiers ne sont pas comparables d'une ville à l'autre ni entre sources tant que la jointure spatiale n'est pas faite.

## Questions encore ouvertes

- D7 : que faire des hôtels de Rome dans les comparaisons de prix ?
- Semaine et week-end : les garder séparés ou les fusionner ?
- Décalage temporel : Airbnb sans date de collecte, hôtels collectés en 2023.
- Définition du « centre » : non documentée dans les deux datasets, les distances ne sont peut-être pas calculées depuis le même point.
- Validation du croisement des deux datasets par le superviseur.
