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

```
viz/
  index.html          la page : contrôles, avertissements, deux vues, fiche de détail
  main.js             point d'entrée : crée l'état partagé et monte tout
  style.css           styles communs et variables de couleur (clair / sombre)
  lib/                D3 embarqué (ne pas modifier)
  commun/             le socle partagé, à modifier à deux
    charte.js         villes, valeurs autorisées, couleurs des sources, formats, seuils
    donnees.js        chargement d'une ville (offres + contours + couverture des quartiers)
    etat.js           état partagé et événements : c'est lui qui lie les vues
    filtres.js        filtres communs (T4)
    controles.js      barre de contrôles : ville (changer de dataset) et filtres
    avertissements.js limites des données affichées selon la ville (Rome, Londres…)
    detail.js         fiche de l'offre sélectionnée (détails à la demande, T6)
    infobulle.js      infobulle partagée
  technique-1/vue.js  la technique de l'étudiant 1   ← chacun travaille ici
  technique-2/vue.js  la technique de l'étudiant 2   ←
```

Les deux `vue.js` actuels sont des **exemples à remplacer** : un nuage de points prix × source et une liste des offres les mieux notées. Ils servent uniquement à montrer le contrat ci-dessous et la sélection liée.

## Contrat d'une vue

Chaque technique exporte une seule fonction :

```js
export function creerVue(conteneur, etat) { … }
```

- `conteneur` : l'élément `<div>` réservé à la vue. La vue n'écrit jamais en dehors.
- `etat` : l'état partagé (`commun/etat.js`). La vue ne parle jamais directement à l'autre vue : elle lit et modifie l'état, et réagit à ses événements.

| Lire | Contenu |
|---|---|
| `etat.ville` | `{ id: "paris", nom: "Paris" }` |
| `etat.donnees.offres` | toutes les offres de la ville (une ligne de `offres_<ville>.csv`, déjà typée : nombres, booléens, `null`) |
| `etat.offresFiltrees()` | les offres qui passent les filtres (mis en cache) |
| `etat.donnees.quartiers` | le GeoJSON des quartiers, prêt pour `d3.geoPath` (`feature.properties.quartier` = `offre.quartier`) |
| `etat.donnees.couverture` | `Map` quartier → `{ airbnb, hotel, sansDonnees, comparable }` (seuils de D16) |
| `etat.filtres` | les filtres courants (`commun/filtres.js`) |
| `etat.selection`, `etat.survol` | l'offre cliquée et l'offre survolée, ou `null` |

| Écrire | Effet |
|---|---|
| `etat.selectionner(offre)` / `etat.selectionner(null)` | ouvre ou ferme la fiche de détail, surligne l'offre dans les deux vues |
| `etat.survoler(offre)` / `etat.survoler(null)` | surligne l'offre dans les deux vues |
| `etat.modifierFiltres({ prixMax: 150 })` | change un filtre (par exemple un brossage sur un axe de prix) |
| `etat.changerVille("rome")` | change de dataset |

| Événement (`etat.on(type, rappel)`) | Quand | Que faire |
|---|---|---|
| `"donnees"` | une ville est chargée | tout redessiner |
| `"filtres"` | un filtre a changé | redessiner avec `etat.offresFiltrees()` |
| `"selection"` | une offre est cliquée ou désélectionnée | mettre à jour le surlignage |
| `"survol"` | une offre est survolée ou plus aucune | idem |

Plusieurs vues peuvent écouter le même événement. Le fichier `technique-1/vue.js` montre aussi le redessin au redimensionnement (`ResizeObserver`) et l'infobulle.

Pour une vue qui compare les quatre villes (T7), `chargerToutesLesVilles()` dans `commun/donnees.js` renvoie la table complète.

## Règles communes

- **Couleurs** : toujours par `couleurSource(o.source)` (`commun/charte.js`), appliquée avec `.style("fill", …)`, pas `.attr()`, car ce sont des variables CSS qui changent en mode sombre. Hôtel = bleu, Airbnb = orange, dans les deux vues. La paire a été vérifiée : contraste ≥ 3:1 et lisible par les daltoniens. Pour une troisième couleur, l'ajouter dans `style.css` et `charte.js`, pas en dur dans la vue.
- **Quartiers sans données** : `COULEUR_SANS_DONNEES` (gris). Une zone non `comparable` doit se voir comme telle (D16).
- **Limites des données** : ne pas comparer les prix hôtel / Airbnb de Rome (`prix_comparable = false`, D7), ni les notes entre sources en absolu (D9). La liste complète est dans `docs/utilisateurs_taches.md`, section 5.
- **Texte venant des données** (noms d'hôtels) : l'insérer avec `.text()`, ou passer par `echapper()` si on construit du HTML.
- **Préparation des données** : aucune ici. S'il manque une colonne ou une agrégation lourde, l'ajouter côté Python (`src/prep/`, notebooks), pas dans le navigateur.
- **Fichiers partagés** (`commun/`, `style.css`, `index.html`, `main.js`) : les modifier dans une PR à part, ou prévenir l'autre, pour éviter les conflits.
