# Utilisateurs visés, besoins et tâches

Ce document décrit à qui s'adresse la visualisation, ce que ces utilisateurs cherchent à savoir, et les tâches qu'ils doivent pouvoir accomplir avec les données. Il suit la démarche du cours : partir des **objectifs** de l'utilisateur, en déduire des **tâches**, puis choisir les **visualisations** qui les servent. C'est la démarche que le cours applique à la carte de John Snow. Chaque tâche est classée avec les taxonomies du cours et reliée aux colonnes de la table commune qui la rendent possible (`docs/schema.md`).

## 1. Utilisateur visé

**Un voyageur non expert qui prépare un court séjour à deux dans une grande ville européenne**, et qui hésite entre un hôtel et un Airbnb.

| Caractéristique | Description |
|---|---|
| Qui | Un couple ou deux amis : 2 personnes. Le prix Airbnb du dataset est calculé pour 2 personnes, et les offres Booking sont en grande majorité des chambres doubles. |
| Séjour | 2 à 4 nuits, à Londres, Berlin, Paris ou Rome. |
| Moment | Avant la réservation, pendant la phase de préparation, sur ordinateur. |
| Contrainte principale | Un **budget par nuit** en tête, par exemple « 150 € maximum ». |
| Questions qu'il se pose | Hôtel ou Airbnb ? Dans quel secteur ? Est-ce que je perds en qualité ou en accès aux transports si je m'éloigne du centre pour payer moins ? |
| Compétences | Il lit une carte, un classement et un graphique simple. Il n'est **pas** statisticien : pas de jargon, pas de graphique qui demande une formation. |
| Ce qu'il n'est pas | Un professionnel du tourisme ou un analyste du marché locatif. La problématique est **descriptive** : montrer où et comment les offres diffèrent, sans expliquer pourquoi. |

### Trois situations types

Ces situations servent à vérifier que chaque tâche répond à un besoin réel.

- **Situation A : un couple, un week-end à Paris, 150 € par nuit au plus.** Il veut être central, près d'un métro, dans un logement bien noté. Sa question : « Pour ce budget, l'hôtel ou l'Airbnb me rapproche-t-il le plus du centre ? »
- **Situation B : deux amis qui hésitent entre Berlin et Londres.** Ils veulent savoir dans quelle ville leur budget va le plus loin, et si la réponse dépend du type d'hébergement. Leur question : « Dans quelle ville l'écart entre hôtel et Airbnb nous est-il le plus favorable ? »
- **Situation C : un voyageur qui a choisi sa ville et cherche un logement précis.** Il veut d'abord la vue d'ensemble des quartiers, puis comparer quelques offres concrètes avant d'aller réserver sur le site. Sa question : « Dans ce quartier, quelles sont les meilleures offres sous mon budget ? »

## 2. Besoins

Les besoins sont formulés avec les mots de l'utilisateur. La colonne de droite indique les données qui y répondent.

| Besoin | Ce que l'utilisateur veut savoir | Données |
|---|---|---|
| B1. Le prix | Combien coûte une nuit, selon le type d'offre, dans la ville choisie ? | `prix_nuit_eur`, `source`, `type`, `ville` |
| B2. L'emplacement | Dans quel secteur loger pour un bon rapport qualité-prix ? | `quartier` et ses contours, `lat`/`lon` |
| B3. Le compromis distance / prix | Que gagne-t-on à s'éloigner du centre ? | `dist_centre_km`, `tranche_dist`, `prix_nuit_eur` |
| B4. La qualité | Les offres moins chères sont-elles moins bien notées ? | `note_100`, `etoiles`, `superhost`, `nb_avis` |
| B5. Les transports | Pourra-t-on rejoindre le centre en métro ? | `metro_proche` |
| B6. Le choix final | Quelles offres précises correspondent à mes critères, et que valent-elles ? | toutes les colonnes d'une ligne |
| B7. La ville | Dans quelle ville le budget va-t-il le plus loin ? | `ville` (un fichier par ville) |

## 3. Des objectifs aux tâches

Comme dans l'exemple de John Snow, on décompose l'objectif principal en objectifs intermédiaires, puis en tâches que la visualisation doit rendre possibles.

- **Objectif principal** : choisir un type d'hébergement et un secteur de la ville qui respectent le budget.
  - **Objectif 1 : comprendre le marché de la ville** (B1, B3, B7).
    - Tâches : comparer les prix des deux offres (T1), voir comment le prix évolue avec la distance au centre (T2), comparer les villes (T7) et les périodes (T8).
  - **Objectif 2 : repérer les bons secteurs** (B2, B5).
    - Tâches : localiser les quartiers favorables à l'une ou l'autre offre (T3), vérifier l'accès au métro selon les secteurs (T10).
  - **Objectif 3 : choisir une offre** (B4, B6).
    - Tâches : restreindre aux offres compatibles avec ses contraintes (T4), trouver les mieux notées sous le budget (T5), repérer les bonnes affaires (T9), consulter le détail d'une offre (T6).

## 4. Catalogue des tâches utilisateur

Abréviations des taxonomies du cours :
- **Sh** : Shneiderman (1996), *overview, zoom, filter, details on demand, relate, history, extract* ;
- **KK** : Keller et Keller (1994), *identify, locate, distinguish, categorize, cluster, order, compare, associate, correlate* ;
- **AS** : Amar et Stasko (2005), tâches analytiques de bas niveau ;
- **Mu** : Munzner (2014), action et cible.

| # | Tâche (formulée par l'utilisateur) | Classement | Données utilisées | Niveau |
|---|---|---|---|---|
| T1 | « Dans cette ville, un hôtel coûte-t-il plus cher qu'un Airbnb ? De combien ? » | Sh *overview*, *relate* ; KK *compare* ; AS *compute derived value* (médiane), *characterize distribution* ; Mu *compare* / distribution | `ville`, `source`, `prix_nuit_eur` | vue d'ensemble |
| T2 | « À partir de quelle distance du centre l'une des offres devient-elle moins chère que l'autre ? » | Sh *relate* ; KK *correlate* ; AS *determine threshold*, *correlate* ; Mu *discover* / tendance | `dist_centre_km`, `tranche_dist`, `prix_nuit_eur`, `source` | vue d'ensemble |
| T3 | « Dans quels quartiers l'Airbnb est-il le plus avantageux par rapport à l'hôtel, et inversement ? » | Sh *overview*, *zoom* ; KK *locate*, *compare* ; AS *find extremum* ; Mu *locate* / spatial | `quartier` + `quartiers_<ville>.geojson`, `prix_nuit_eur`, `note_100`, `source` | vue d'ensemble, puis zoom |
| T4 | « Je ne veux voir que ce qui respecte mon budget, une note minimale, près d'un métro. » | Sh *filter* ; AS *filter* | `prix_nuit_eur`, `note_100`, `type`, `etoiles`, `metro_proche`, `periode`, `superhost` | toutes vues |
| T5 | « Quelles sont les offres les mieux notées sous 150 € ? » | KK *order* ; AS *sort*, *find extremum* ; Mu *lookup* | `prix_nuit_eur`, `note_100`, `source` | détail |
| T6 | « Que vaut exactement cette offre ? » | Sh *details on demand* ; KK *identify* ; AS *retrieve value* ; Mu *identify* | `nom`, `type`, `etoiles`, `note_100`, `nb_avis`, `capacite`, `superhost`, `dist_centre_km`, `metro_proche`, `quartier` | détail |
| T7 | « Dans quelle ville mon budget va-t-il le plus loin ? » | Sh *relate* ; KK *compare*, *order* ; changement de dataset (consigne du projet) | `ville`, `offres_<ville>.csv` | vue d'ensemble |
| T8 | « Un Airbnb est-il plus cher le week-end ? » | KK *compare* ; AS *characterize distribution* | `periode`, `prix_nuit_eur` (Airbnb seulement) | vue d'ensemble |
| T9 | « Y a-t-il des offres très bien notées pour un prix bas ? » | KK *distinguish* ; AS *find anomalies* ; Mu *discover* / valeurs atypiques | `note_100`, `prix_nuit_eur` | détail |
| T10 | « Les quartiers moins chers sont-ils mal desservis ? » | KK *associate* ; AS *correlate* | `metro_proche`, `quartier`, `tranche_dist`, `prix_nuit_eur` | vue d'ensemble |

### Lien avec le mantra de Shneiderman et les deux niveaux de vue

La consigne demande deux niveaux de visualisation : une vue d'ensemble et des détails. Les tâches s'y répartissent selon le mantra « *overview first, zoom and filter, then details on demand* » :

| Étape du mantra | Tâches | Ce que l'interface doit offrir |
|---|---|---|
| *Overview* | T1, T2, T3, T7, T8, T10 | Comparaison des deux offres par ville, par tranche de distance et par quartier. |
| *Zoom & filter* | T3, T4 | Sélection d'une ville (changement de dataset), d'un quartier ou d'une tranche ; filtres de budget, de note, de type, d'étoiles, de métro et de période. |
| *Details on demand* | T5, T6, T9 | Liste ou distribution des offres d'une sélection, puis fiche d'une offre au survol ou au clic. |

## 5. Ce que les données permettent, et leurs limites

Les tâches ci-dessus ne promettent que ce que les données savent dire. Les limites suivantes doivent être visibles dans l'interface, sous forme d'avertissement ou de zone grisée, et dans le rapport.

| Limite | Effet sur les tâches | Référence |
|---|---|---|
| Les prix des hôtels de Rome sont 2 à 5 fois plus élevés qu'ailleurs, sans correction possible. | T1, T2, T3, T7 : un avertissement s'affiche dès que Rome est sélectionnée (`prix_comparable = false`). | D7 |
| Les notes Airbnb (médiane 95/100) et Booking (médiane 80/100) ne suivent pas le même barème. | T5, T9 : comparer les notes **au sein** d'une source, ou relativement, pas en absolu entre sources. | D9 |
| Le prix Booking n'inclut pas les taxes (taxe de séjour de 2 à 5 % ailleurs qu'à Londres). | T1 : léger avantage apparent pour les hôtels. | D4 |
| Le dataset Airbnb ne couvre que 14 boroughs centraux de Londres sur 33. | T3 : les boroughs sans données sont grisés. | D16 |
| 156 hôtels sur 207 sont dans le Municipio I à Rome. | T3 : une seule zone de Rome permet de comparer les deux offres. | D16 |
| 69 % des hôtels ont une position GPS, surtout les chaînes. | T3, T6 : une carte de points d'hôtels surreprésente les chaînes. Les comparaisons par quartier utilisent tous les hôtels. | D19 |
| Aucune date de séjour ni disponibilité. | Les prix sont des ordres de grandeur, pas des tarifs réservables. | D3, D4 |
| Pas de capacité côté hôtels. | Pas de comparaison du prix par personne pour un groupe de plus de 2. | D11 |

## 6. Liste des tâches à présenter en soutenance

Voici la version courte, à projeter :

1. **T1** : comparer le prix d'un hôtel et d'un Airbnb dans une ville.
2. **T2** : trouver à quelle distance du centre l'une des offres devient moins chère que l'autre.
3. **T3** : localiser les quartiers favorables à l'hôtel ou à l'Airbnb.
4. **T4** : filtrer selon le budget, la note, le type, les étoiles, le métro et la période.
5. **T5** : trouver les offres les mieux notées sous un budget.
6. **T6** : consulter le détail d'une offre.
7. **T7** : comparer les quatre villes, en changeant de dataset.
8. **T8** : comparer la semaine et le week-end côté Airbnb.
9. **T9** : repérer les offres atypiques, très bien notées pour un prix bas.
10. **T10** : vérifier si les secteurs moins chers sont moins bien desservis par le métro.
