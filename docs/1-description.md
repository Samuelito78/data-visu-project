# Description du projet

> Pour un voyageur avec un budget donné, vaut-il mieux réserver un hôtel ou un Airbnb, et dans quel secteur de la ville ?

Pour un court séjour en ville, on hésite souvent entre un hôtel et un Airbnb. Les sites de réservation les présentent séparément, ce qui empêche de les comparer.

Notre projet les réunit dans une même visualisation interactive, pour Londres, Berlin, Paris et Rome. Il s'adresse à un voyageur non expert qui part à deux avec un budget par nuit en tête. Il compare les deux offres sur le prix par nuit, la note, la distance au centre et l'accès au métro, quartier par quartier.

Les données viennent de deux datasets Kaggle sous licence CC0 : 28 192 annonces Airbnb et 1 705 hôtels Booking. Nous les avons unifiées en une seule table de 29 315 offres : prix en euros par nuit, notes sur 100, distances mesurées depuis un même centre et quartier officiel pour chaque offre. Les hôtels, sans coordonnées au départ, ont été géolocalisés à 69 %.

L'application, écrite en D3.js, relie trois techniques par un état partagé :
- une carte des offres, où chaque triangle indique si l'offre est plus ou moins chère que la médiane de sa source ;
- des points d'intérêt sur cette carte, pour ne garder que les offres autour d'un lieu ;
- un nuage de points qui croise la distance au centre et le prix.

Une offre survolée ou cliquée dans une vue est surlignée dans l'autre. Des filtres communs, le changement de ville et une fiche détaillée complètent la vue d'ensemble. La problématique reste descriptive : montrer où et comment les deux offres diffèrent, sans chercher à l'expliquer.

Luca VIZIO et Samuel BOIX-SEGURA, Master MIAGE MBDS, Université Côte d'Azur.
