# Utilisateurs visés et tâches

## Utilisateur visé

Un voyageur non expert qui prépare un séjour de 2 à 4 nuits à deux, avant de réserver. Il a un budget par nuit en tête, par exemple 150 €. Il lit une carte et un graphique simple, sans être statisticien.

Ses questions : hôtel ou Airbnb ? Dans quel secteur ? Que perd-il en s'éloignant du centre pour payer moins ?

## Tâches

Les tâches sont dans ses mots, classées selon Shneiderman (Sh) et Keller et Keller (KK).

| Tâche | Classement | Données | Où |
|---|---|---|---|
| T1. « Ici, un hôtel coûte-t-il plus cher qu'un Airbnb ? » | Sh vue d'ensemble ; KK comparer | `prix_nuit_eur`, `source` | nuage |
| T2. « Les prix baissent-ils loin du centre ? » | KK corréler | `dist_centre_km`, `prix_nuit_eur` | nuage |
| T3. « Dans quels quartiers est-ce moins cher que d'habitude ? » | Sh zoom ; KK localiser | `lat`, `lon`, `quartier` | carte |
| T4. « Seulement mon budget, une bonne note, près d'un métro. » | Sh filtrer | `prix_nuit_eur`, `note_100`, `type`, `etoiles`, `metro_proche` | filtres communs |
| T5. « Que trouve-t-on près de la tour Eiffel ? » | KK localiser ; Sh filtrer | `lat`, `lon` | points d'intérêt |
| T6. « Que vaut exactement cette offre ? » | Sh détails à la demande ; KK identifier | toutes les colonnes | infobulle, fiche |
| T7. « Dans quelle ville mon budget va-t-il le plus loin ? » | KK comparer ; changement de dataset | `ville` | sélecteur de ville |
| T8. « Un Airbnb est-il plus cher le week-end ? » | KK comparer | `periode` | filtre de période |

Les tâches suivent le mantra de Shneiderman : vue d'ensemble (T1, T2, T7), zoom et filtre (T3, T4, T5, T8), puis détails (T6).

## Limites des données

- Les hôtels de Rome sont 2 à 5 fois plus chers qu'ailleurs : prix non comparables aux Airbnb.
- Les notes Airbnb et Booking n'ont pas le même barème : on les compare au sein d'une source.
- 69 % des hôtels seulement ont une position sur la carte.
