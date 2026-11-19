// Panneau des points d'intérêt, sous la fiche de détail : des lieux prédéfinis par ville,
// puis un repère « point perso » à faire glisser sur la carte (technique 1).
// Choisir un lieu appelle etat.choisirPoi(lieu) ; la carte place le point et compte les offres autour.
// Le dépôt du repère n'est accepté que par la carte : elle seule lit TYPE_DEPOT_POI pendant le glisser.
// Les lieux et leurs sources sont dans lieux.js.

import { POINTS_INTERET, TYPE_DEPOT_POI } from "./lieux.js";

const d3 = window.d3;

// Repère du point d'intérêt, même dessin que sur la carte.
const REPERE = '<svg class="poi-repere" width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true"><circle r="5"></circle></svg>';

export function creerPanneauPoi(conteneur, etat) {
  const racine = d3.select(conteneur);
  racine.append("h2").attr("class", "poi-titre").text("Points d'intérêt");
  racine.append("p").attr("class", "poi-intro")
    .text("Choisissez un lieu : la carte le place en mode point d'intérêt. Réglez ensuite les cercles à la souris sur la carte (un clic fige chaque cercle) pour voir les offres autour.");
  const liste = racine.append("ul").attr("class", "poi-liste");

  // Repère à glisser : seule la carte accepte le dépôt (voir technique-1/poi.js).
  const perso = racine.append("div").attr("class", "poi-perso")
    .attr("draggable", "true")
    .attr("title", "Faites glisser ce repère sur la carte");
  perso.append("span").attr("class", "poi-perso-poignee").attr("aria-hidden", "true").text("⠿");
  perso.append("span").html(REPERE);
  const textePerso = perso.append("span").attr("class", "poi-perso-texte");

  perso.on("dragstart", (e) => {
    e.dataTransfer.setData(TYPE_DEPOT_POI, "perso");
    e.dataTransfer.effectAllowed = "copy";
    // La classe signale la zone de dépôt (la carte) pendant le glisser.
    document.body.classList.add("poi-en-glisse");
  });
  perso.on("dragend", () => document.body.classList.remove("poi-en-glisse"));

  function dessiner() {
    const lieux = POINTS_INTERET[etat.ville?.id] ?? [];
    liste.selectAll("li")
      .data(lieux, (l) => l.id)
      .join((entree) => {
        const li = entree.append("li");
        li.append("button").attr("type", "button")
          .attr("title", (l) => (l.source ? `Position : ${l.source}` : null))
          .html((l) => `${REPERE}<span>${l.nom}</span>`)
          // Un second clic sur le lieu actif l'efface.
          .on("click", (e, l) => etat.choisirPoi(etat.poi?.id === l.id ? null : l));
        return li;
      })
      .select("button")
      .attr("aria-pressed", (l) => (etat.poi?.id === l.id ? "true" : "false"));

    const persoActif = etat.poi?.perso === true;
    perso.classed("actif", persoActif);
    textePerso.text(persoActif
      ? "Point perso posé : glissez-en un autre pour le déplacer"
      : "Point perso : glissez-le sur la carte");
  }

  etat.on("donnees", dessiner).on("poi", dessiner);
  dessiner();
}
