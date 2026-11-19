// Technique 2 : nuage de points distance au centre × prix par nuit.
//
// Cette vue montre la relation entre l'éloignement et le prix, pour les deux sources
// (hôtels en bleu, Airbnb en orange) selon les filtres actifs.
// Survol et clic utilisent l'état partagé pour la sélection liée avec la technique 1.
//
// Organisation : axes.js (échelles, grille, axes), points.js (les offres), legende.js ;
// ce fichier assemble la vue et la redessine quand l'état change.

import { formatEntier } from "../noyau/charte.js";
import { HAUTEUR, creerEchelles, creerAxes } from "./axes.js";
import { creerPoints } from "./points.js";
import { creerLegende } from "./legende.js";

const d3 = window.d3;

export function creerVue(conteneur, etat) {
  const racine = d3.select(conteneur);
  const resume = racine.append("p").attr("class", "t2-resume");
  const svg = racine.append("svg")
    .attr("role", "img")
    .attr("aria-label", "Nuage de points : distance au centre et prix par nuit");
  const axes = creerAxes(svg);
  const points = creerPoints(svg, etat);
  creerLegende(racine);

  function dessiner() {
    if (!etat.donnees) return;
    const largeur = conteneur.clientWidth || 640;
    svg.attr("viewBox", `0 0 ${largeur} ${HAUTEUR}`).attr("width", largeur).attr("height", HAUTEUR);

    const offres = etat.offresFiltrees()
      .filter((o) => o.dist_centre_km != null && o.prix_nuit_eur != null);
    const echelles = creerEchelles(offres, etat.filtres, largeur);
    axes.dessiner(echelles, largeur);
    points.dessiner(offres, echelles);

    const comptes = d3.rollup(offres, (v) => v.length, (o) => o.source);
    resume.text(
      `${etat.ville.nom} : ${formatEntier(offres.length)} offres affichées `
      + `(${formatEntier(comptes.get("Hôtel") ?? 0)} hôtels, ${formatEntier(comptes.get("Airbnb") ?? 0)} Airbnb).`
    );
  }

  etat.on("donnees", dessiner).on("filtres", dessiner)
    .on("selection", points.surligner).on("survol", points.surligner);
  new ResizeObserver(() => dessiner()).observe(conteneur);
}
