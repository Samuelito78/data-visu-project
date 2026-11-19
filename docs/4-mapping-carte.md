# Technique 1 : la carte des offres

![Carte des offres de Paris : un triangle par offre sur les arrondissements](images/technique-1.png)

Chaque offre géolocalisée devient un triangle sur la carte. Il ne montre pas son prix, mais sa place par rapport à la médiane de sa source (hôtels ou Airbnb) dans la ville.

En prix absolu, les hôtels de Rome (médiane 537 €, contre 91 € pour les Airbnb) écraseraient l'échelle, d'où cette comparaison relative. La comparaison absolue hôtel / Airbnb se fait dans le nuage de points.

## Données et variables visuelles

| Donnée | Type | Variable visuelle | À quoi elle sert |
|---|---|---|---|
| `lat`, `lon` | spatial (position) | position, projection de Mercator | situer l'offre (T3) |
| `prix_nuit_eur` comparé à la médiane | ordinal : moins cher, plus cher | orientation : ▲ plus cher, ▼ moins cher | voir où l'on paie plus ou moins (T3) |
| écart à la médiane | quantitatif | luminosité, la plus foncée à ×2 ou ÷2 | repérer les écarts forts |
| `source` | catégoriel | teinte : bleu (hôtels), rouge (Airbnb) | distinguer les deux offres |
| `quartier` et ses contours | spatial (géométrie) | aires grises neutres, étiquettes | se repérer, zoomer sur un quartier |
| toutes les colonnes | tous | infobulle au survol, fiche au clic | détails à la demande (T6) |

La luminosité, ordonnée, code une intensité ; la teinte, sans ordre perçu, le nominal ; l'orientation sépare bien deux classes. La taille ne code rien ; elle grandit au survol et à la sélection.

L'infobulle donne le prix, la médiane de référence et l'écart en pourcentage.

## Interactions

- Un clic entre les triangles zoome sur le quartier ; la molette zoome, le glisser déplace. C'est un zoom géométrique (pan & zoom) : l'encodage ne change pas, la taille des triangles diminue pour séparer les offres proches.
- Le survol et le clic d'une offre la surlignent aussi dans le nuage de points (brushing & linking).
- Filtres et choix de la ville changent les triangles affichés.
- Les points d'intérêt (technique 2) se posent ici.

La médiane, calculée sur toute la ville, ignore les filtres.
