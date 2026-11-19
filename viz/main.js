// Point d'entrée : crée l'état partagé, monte les composants communs et les deux techniques,
// puis charge la ville demandée dans l'URL (?ville=rome), Paris par défaut.
// ?vue=1 ou ?vue=2 n'affiche qu'une technique (pratique pour travailler sur la sienne).
//
// Chaque composant reçoit son élément et l'état : creerX(conteneur, etat). Ils ne se parlent jamais
// directement, ils lisent et modifient l'état et réagissent à ses événements (noyau/etat.js).

import { VILLES } from "./noyau/charte.js";
import { creerEtat } from "./noyau/etat.js";
import { creerControles } from "./composants/controles/controles.js";
import { creerAvertissements } from "./composants/avertissements/avertissements.js";
import { creerFiche } from "./composants/fiche/fiche.js";
import { creerPanneauPoi } from "./composants/points-interet/points-interet.js";
import { creerVue as creerTechnique1 } from "./technique-1/vue.js";
import { creerVue as creerTechnique2 } from "./technique-2/vue.js";

const etat = creerEtat();
const parametres = new URLSearchParams(location.search);
const element = (selecteur) => document.querySelector(selecteur);

creerControles(element("#controles"), etat);
creerAvertissements(element("#avertissements"), etat);
creerFiche(element("#fiche"), etat);
creerPanneauPoi(element("#points-interet"), etat);
creerTechnique1(element("#technique-1 .vue-contenu"), etat);
creerTechnique2(element("#technique-2 .vue-contenu"), etat);

const vueSeule = parametres.get("vue");
if (vueSeule === "1" || vueSeule === "2") document.body.dataset.vueSeule = vueSeule;

// Pendant un chargement, les vues sont estompées ; l'URL suit la ville chargée.
etat.on("chargement", () => document.body.classList.add("en-chargement"));
etat.on("erreur", () => document.body.classList.remove("en-chargement"));
etat.on("donnees", () => {
  document.body.classList.remove("en-chargement");
  parametres.set("ville", etat.ville.id);
  history.replaceState(null, "", `?${parametres}`);
});

// Échap efface la sélection.
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") etat.selectionner(null);
});

const demandee = parametres.get("ville");
etat.changerVille(VILLES.some((v) => v.id === demandee) ? demandee : "paris");
