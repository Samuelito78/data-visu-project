// Point d'entrée : crée l'état partagé, monte les éléments communs et les deux techniques,
// puis charge la ville demandée dans l'URL (?ville=rome), Paris par défaut.
// ?vue=1 ou ?vue=2 n'affiche qu'une technique (pratique pour travailler sur la sienne).

import { VILLES } from "./commun/charte.js";
import { creerEtat } from "./commun/etat.js";
import { creerControles } from "./commun/controles.js";
import { creerAvertissements } from "./commun/avertissements.js";
import { creerPanneauDetail } from "./commun/detail.js";
import { creerPanneauPoi } from "./commun/points-interet.js";
import { creerVue as creerTechnique1 } from "./technique-1/vue.js";
import { creerVue as creerTechnique2 } from "./technique-2/vue.js";

const etat = creerEtat();
const parametres = new URLSearchParams(location.search);

creerControles(document.querySelector("#controles"), etat);
creerAvertissements(document.querySelector("#avertissements"), etat);
creerPanneauDetail(document.querySelector("#detail"), etat);
creerPanneauPoi(document.querySelector("#points-interet"), etat);
creerTechnique1(document.querySelector("#technique-1 .vue-contenu"), etat);
creerTechnique2(document.querySelector("#technique-2 .vue-contenu"), etat);

const vueSeule = parametres.get("vue");
if (vueSeule === "1" || vueSeule === "2") document.body.dataset.vueSeule = vueSeule;

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
