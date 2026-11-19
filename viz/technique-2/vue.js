// Technique 2 : nuage de points distance au centre × prix par nuit.
//
// Cette vue montre la relation entre l'éloignement et le prix, pour les deux sources
// (hôtels en bleu, Airbnb en orange) selon les filtres actifs. En mode point d'intérêt, l'éloignement
// est mesuré depuis le point choisi sur la carte, pour les seules offres du 2e cercle.
// Survol et clic utilisent l'état partagé pour la sélection liée avec la technique 1.
//
// Organisation : axes.js (échelles, grille, axes), points.js (les offres), legende.js ;
// ce fichier assemble la vue et la redessine quand l'état change.

import { formatEntier } from "../noyau/charte.js";
import { distanceKm } from "../noyau/geo.js";
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

  // Deux modes. Par défaut : distance au centre de la ville, toutes les offres filtrées.
  // En mode point d'intérêt (etat.zonePoi, publié par la carte) : distance au point d'intérêt,
  // et seulement les offres du 2e cercle de recherche.
  function dessiner() {
    if (!etat.donnees) return;
    const largeur = conteneur.clientWidth || 640;
    svg.attr("viewBox", `0 0 ${largeur} ${HAUTEUR}`).attr("width", largeur).attr("height", HAUTEUR);

    const zone = etat.zonePoi;
    let offres, distance, distanceMax, titreX;
    if (zone) {
      const distances = new Map();
      offres = etat.offresFiltrees().filter((o) => zone.ids.has(o.id) && o.prix_nuit_eur != null);
      for (const o of offres) distances.set(o.id, distanceKm(zone.centre, [o.lon, o.lat]));
      distance = (o) => distances.get(o.id);
      distanceMax = null;
      titreX = "Distance au point d'intérêt";
    } else {
      offres = etat.offresFiltrees().filter((o) => o.dist_centre_km != null && o.prix_nuit_eur != null);
      distance = (o) => o.dist_centre_km;
      distanceMax = etat.filtres.distanceMax;
      titreX = "Distance au centre";
    }
    const echelles = creerEchelles(offres, { distance, distanceMax }, largeur);
    axes.dessiner(echelles, largeur, titreX);
    points.dessiner(offres, echelles, distance);
    ecrireResume(offres, zone);
  }

  function ecrireResume(offres, zone) {
    const comptes = d3.rollup(offres, (v) => v.length, (o) => o.source);
    const detail = `(${formatEntier(comptes.get("Hôtel") ?? 0)} hôtels, ${formatEntier(comptes.get("Airbnb") ?? 0)} Airbnb)`;
    if (!zone) {
      resume.text(`${etat.ville.nom} : ${formatEntier(offres.length)} offres affichées ${detail}.`);
    } else if (zone.ids.size === 0) {
      resume.text("Mode point d'intérêt : figez le 1er cercle sur la carte, puis tracez le 2e pour voir ses offres ici.");
    } else {
      resume.text(`Autour de ${etat.poi?.nom ?? "ce point"} : ${formatEntier(offres.length)} offres dans le 2e cercle ${detail}, selon leur distance au point.`);
    }
  }

  etat.on("donnees", dessiner).on("filtres", dessiner).on("zonePoi", dessiner)
    .on("selection", points.surligner).on("survol", points.surligner);
  new ResizeObserver(() => dessiner()).observe(conteneur);
}
