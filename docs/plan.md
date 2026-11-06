# Plan du projet

## Analyze data from a list of datasets from Kaggle

Nous avons comparé plusieurs jeux Airbnb, immobiliers et hôteliers sur Kaggle. Nous avons retenu *Airbnb Prices in European Cities* et *7500 hotels from Airbnb, Booking and Hotels.com*, qui ont quatre villes en commun : Londres, Berlin, Paris et Rome.

## Choose a dataset that contains multivariate data

La table commune mêle des variables :

- **quantitatives** : prix, note, distance au centre ;
- **catégorielles** : source, type de logement, étoiles, ville ;
- **booléennes** : métro proche, superhost ;
- **spatiales** : coordonnées des Airbnb.

## Validate the choice with supervisor

À faire. Nous voulons son accord sur le croisement des deux sources et sur leurs limites : dates de collecte différentes et pas de coordonnées GPS pour les hôtels.

## Describe the visualization pipeline

1. **Transformation des données** : JSON des hôtels mis en table, prix convertis en euros par nuit, notes ramenées sur 100, variable « métro proche » alignée entre les deux sources.
2. **Table commune** : création d'une table unique avec des tranches de distance au centre.
3. **Filtrage** : selon les choix de l'utilisateur.
4. **Mapping visuel** : source vers la teinte, prix et distance vers des positions sur des axes, coordonnées vers la carte pour les Airbnb.

## Describe the target users

Des voyageurs non experts qui préparent un séjour en couple ou en petit groupe et hésitent entre un hôtel et un Airbnb.

## Describe the visualization goals and the user tasks

Comparer le prix et la qualité des hôtels et des Airbnb selon la ville et la distance au centre, puis trouver l'hébergement au meilleur rapport qualité-prix.

## Propose 1 visualization technique by student

Chaque étudiant choisit sa technique parmi les pistes envisagées : carte, anneaux de distance, nuage de points, boîtes à moustaches, matrice, haltères, coordonnées parallèles, petits multiples.

### Include interactive tasks

- Filtres : budget, type d'hébergement, note minimale, étoiles
- Sélection d'une ville ou d'une tranche de distance
- Sélection liée entre les vues
- Zoom sur la carte des Airbnb
- Info-bulles au survol

### Include two levels of visualization (overview + details)

- **Vue d'ensemble** : comparaison des deux offres par ville et par tranche de distance.
- **Détails à la demande**, dans un panneau séparé : la distribution des prix d'une tranche, puis la fiche d'un hôtel ou d'une annonce.

### Allow to change the dataset

Un menu change de ville parmi les quatre communes. Côté Airbnb, on peut aussi passer de semaine à week-end. Côté hôtels, le même format JSON permet de charger une autre ville.

### User tasks

- Comparer le prix médian des hôtels et des Airbnb dans une ville
- Repérer à quelle distance du centre un type devient moins cher que l'autre
- Trouver les hébergements bien notés sous un budget
- Consulter le détail d'un hébergement
- Comparer les villes entre elles

## Document de présentation

Le fichier `plan-projet-visu.html` reprend tout ça pour votre collègue. Il présente la problématique, les deux sources avec leurs variables et leurs limites, la table qui relie les deux sources, le pipeline et le plan consigne par consigne. Il propose aussi huit pistes de visualisation avec un petit croquis chacune, sans ordre de préférence. Il se termine par la liste des points à vérifier, dont un important : savoir si le prix des hôtels est donné par nuit ou pour tout le séjour.