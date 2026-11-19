# Visualisation D3

Application D3.js qui affiche la table commune (`data/processed/`). Pas de build, pas de dépendance à installer : du HTML, du CSS et des modules JavaScript natifs, avec D3 7.9.0 embarqué dans `lib/`.

## Lancer

```bash
./scripts/serve.sh        # depuis la racine du dépôt
```

Puis ouvrir <http://localhost:8000/viz/>. Le serveur doit tourner **à la racine du dépôt**, sinon les fichiers de `data/processed/` sont introuvables. Ouvrir `index.html` directement (`file://`) ne marche pas : le navigateur bloque `d3.csv`.

Paramètres d'URL :

| Paramètre | Effet |
|---|---|
| `?ville=rome` | ville chargée au démarrage (`paris`, `berlin`, `londres`, `rome`) ; mis à jour quand on change de ville |
| `?vue=1` ou `?vue=2` | n'affiche qu'une des deux techniques, pour travailler sur la sienne |

## Organisation

Le code est découpé par composant : chaque composant a son dossier, avec son JavaScript et sa feuille de style. Un composant exporte une fonction `creerX(conteneur, etat)` : il dessine dans `conteneur` et ne communique avec le reste que par l'état partagé.

```
viz/
  index.html            la page : contrôles, message d'erreur, deux vues, panneau latéral ; charge les CSS
  main.js               point d'entrée : crée l'état partagé et monte les composants et les vues
  lib/                  D3 embarqué (ne pas modifier)
  styles/
    theme.css           toutes les couleurs, en clair et en sombre
    base.css            mise en forme générale, formulaires, disposition, éléments partagés (pastille, axes)
  noyau/                données et état, sans affichage
    charte.js           villes, valeurs autorisées, couleurs des sources, formats, seuils
    donnees.js          chargement d'une ville (offres + contours + couverture des quartiers)
    etat.js             état partagé et événements : c'est lui qui lie les vues
    filtres.js          filtres communs (T4)
    geo.js              distances et caps sur la sphère (point d'intérêt, nuage)
  composants/           éléments d'interface communs aux deux techniques
    controles/          barre de contrôles : ville (changer de dataset) et filtres
    avertissements/     message d'erreur quand une ville ne se charge pas
    fiche/              fiche de l'offre sélectionnée (détails à la demande, T6)
    points-interet/     lieux prédéfinis (lieux.js, avec leurs sources) et point perso à glisser sur la carte
    infobulle/          infobulle partagée
  technique-1/          carte des offres (Samuel)
    vue.js              assemble la carte et la redessine quand l'état change
    fond.js             SVG, calques, projection, zoom
    quartiers.js        contours, étiquettes, comptages par quartier
    triangles.js        les offres (un triangle par offre)
    prix.js             médianes, écart à la médiane, couleurs
    poi.js              outil point d'intérêt (cercles de recherche, dépôt du point perso)
    entete.js           résumé et boutons au-dessus de la carte
    legende.js          légende
    carte.css
  technique-2/          nuage de points distance × prix (Luca)
    vue.js              assemble la vue
    axes.js             échelles, grille, axes
    points.js           les offres (un cercle par offre)
    legende.js          légende
    nuage.css
```

Pour ajouter un composant : un dossier dans `composants/` avec `nom.js` et `nom.css`, la feuille ajoutée dans `index.html`, et l'appel `creerX(element, etat)` dans `main.js`. Dans une technique, `vue.js` reste le seul point d'entrée (`creerVue`) ; les autres fichiers du dossier sont ses morceaux.

## Contrat d'une vue

Chaque technique exporte une seule fonction :

```js
export function creerVue(conteneur, etat) { … }
```

- `conteneur` : l'élément `<div>` réservé à la vue. La vue n'écrit jamais en dehors.
- `etat` : l'état partagé (`noyau/etat.js`). La vue ne parle jamais directement à l'autre vue : elle lit et modifie l'état, et réagit à ses événements.

| Lire | Contenu |
|---|---|
| `etat.ville` | `{ id: "paris", nom: "Paris" }` |
| `etat.donnees.offres` | toutes les offres de la ville (une ligne de `offres_<ville>.csv`, déjà typée : nombres, booléens, `null`) |
| `etat.offresFiltrees()` | les offres qui passent les filtres (mis en cache) |
| `etat.donnees.quartiers` | le GeoJSON des quartiers, prêt pour `d3.geoPath` (`feature.properties.quartier` = `offre.quartier`) |
| `etat.donnees.couverture` | `Map` quartier → `{ airbnb, hotel, sansDonnees, comparable }` (au moins 30 Airbnb et 10 hôtels) |
| `etat.filtres` | les filtres courants (`noyau/filtres.js`) |
| `etat.selection`, `etat.survol` | l'offre cliquée et l'offre survolée, ou `null` |
| `etat.poi` | le point d'intérêt choisi `{ id, nom, lon, lat, perso }`, ou `null` |
| `etat.zonePoi` | en mode point d'intérêt : `{ centre, ids }`, le centre du 1er cercle et les offres du 2e ; sinon `null` |

| Écrire | Effet |
|---|---|
| `etat.selectionner(offre)` / `etat.selectionner(null)` | ouvre ou ferme la fiche de détail, surligne l'offre dans les deux vues |
| `etat.survoler(offre)` / `etat.survoler(null)` | surligne l'offre dans les deux vues |
| `etat.modifierFiltres({ prixMax: 150 })` | change un filtre (par exemple un brossage sur un axe de prix) |
| `etat.changerVille("rome")` | change de dataset |
| `etat.choisirPoi(lieu)` / `etat.choisirPoi(null)` | place ou efface le point d'intérêt (panneau latéral, carte) |

| Événement (`etat.on(type, rappel)`) | Quand | Que faire |
|---|---|---|
| `"donnees"` | une ville est chargée | tout redessiner |
| `"filtres"` | un filtre a changé | redessiner avec `etat.offresFiltrees()` |
| `"selection"` | une offre est cliquée ou désélectionnée | mettre à jour le surlignage |
| `"survol"` | une offre est survolée ou plus aucune | idem |
| `"poi"` | un point d'intérêt est choisi, posé ou effacé | placer ou retirer le point |
| `"zonePoi"` | la zone de recherche du point d'intérêt change | redessiner ce qui en dépend (le nuage) |

Plusieurs vues peuvent écouter le même événement. Le fichier `technique-1/vue.js` montre aussi le redessin au redimensionnement (`ResizeObserver`), et `technique-1/triangles.js` l'infobulle.

Pour une vue qui compare les quatre villes (T7), `chargerToutesLesVilles()` dans `noyau/donnees.js` renvoie la table complète.

## Règles communes

- **Couleurs** : toujours par `couleurSource(o.source)` (`noyau/charte.js`), appliquée avec `.style("fill", …)`, pas `.attr()`, car ce sont des variables CSS qui changent en mode sombre. Hôtel = bleu, Airbnb = orange, dans les deux vues. La paire a été vérifiée : contraste ≥ 3:1 et lisible par les daltoniens. Pour une troisième couleur, l'ajouter dans `styles/theme.css` et `charte.js`, pas en dur dans la vue.
- **Quartiers sans données** : `COULEUR_SANS_DONNEES` (gris). Une zone non `comparable` doit se voir comme telle.
- **Limites des données** : ne pas comparer les prix hôtel / Airbnb de Rome (`prix_comparable = false`), ni les notes entre sources en absolu. Ces limites sont rappelées dans `docs/2-utilisateurs-taches.md`.
- **Texte venant des données** (noms d'hôtels) : l'insérer avec `.text()`, ou passer par `echapper()` si on construit du HTML.
- **Préparation des données** : aucune ici. S'il manque une colonne ou une agrégation lourde, l'ajouter côté Python (`src/prep/`, notebooks), pas dans le navigateur.
- **Fichiers partagés** (`noyau/`, `composants/`, `styles/`, `index.html`, `main.js`) : les modifier dans une PR à part, ou prévenir l'autre, pour éviter les conflits.
