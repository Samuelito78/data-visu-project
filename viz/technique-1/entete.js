// Technique 1 : en-tête de la carte. Phrase d'explication ou résumé du quartier zoomé,
// zone des boutons du point d'intérêt (poi.js) et bouton de retour à la vue d'ensemble.

import { formatEntier } from "../noyau/charte.js";
import { pluriel } from "./prix.js";

const SEUIL_POINTS = 2;      // à partir de ce facteur de zoom, le résumé compte les offres visibles

const nomSource = (c) => (c.nombre > 1 ? pluriel(c.source) : c.source === "Hôtel" ? "hôtel" : "Airbnb");

export function creerEntete(racine, { onRetour }) {
  const entete = racine.append("div").attr("class", "t1-entete");
  const resume = entete.append("p").attr("class", "t1-resume").attr("aria-live", "polite");
  const zoneBoutons = entete.append("div").attr("class", "t1-poi-controles");
  const boutonRetour = entete.append("button").attr("type", "button").attr("class", "t1-retour")
    .text("← Vue d'ensemble").property("hidden", true)
    .on("click", onRetour);

  return {
    zoneBoutons,
    SEUIL_POINTS,
    afficherRetour(visible) { boutonRetour.property("hidden", !visible); },

    // Le résumé ne contient aucun chiffre qui dépend du cercle du point d'intérêt : ceux-là sont
    // dans l'encart sur la carte, pour que la hauteur de l'en-tête ne change pas pendant le tracé.
    //   quartier : { nom, comptes (quartiers.compter), sansPosition } ou null
    ecrire({ quartier, modePoi, zoom, nbVisibles }) {
      resume.selectAll("*").remove();
      resume.text("");
      if (quartier) {
        resume.append("strong").text(`${quartier.nom} : `);
        const morceaux = quartier.comptes
          .map((c) => `${formatEntier(c.nombre)} ${nomSource(c)} (${formatEntier(c.haut)} ▲, ${formatEntier(c.bas)} ▼)`);
        resume.append("span").text(
          (morceaux.join(" et ") || "aucune offre") +
          (quartier.sansPosition > 0 ? `, dont ${formatEntier(quartier.sansPosition)} hôtel(s) sans position, absent(s) de la carte` : "") +
          ". Cliquez sur une offre pour afficher sa fiche."
        );
      } else if (modePoi) {
        resume.text("Mode point d'intérêt : seules les offres du cercle de recherche sont affichées.");
      } else if (zoom >= SEUIL_POINTS) {
        resume.text(`${formatEntier(nbVisibles)} offres visibles. Cliquez sur une offre pour afficher sa fiche.`);
      } else {
        resume.text("Chaque triangle est une offre, comparée au prix médian des hôtels ou des Airbnb de la ville. Survolez un triangle pour voir l'offre, cliquez entre les triangles pour zoomer sur un quartier.");
      }
    },
  };
}
