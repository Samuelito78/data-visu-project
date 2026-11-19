// Technique 2 : les offres, un cercle par offre, et leur surlignage lié avec la technique 1.

import { couleurSource } from "../noyau/charte.js";
import { afficherInfobulle, masquerInfobulle, htmlInfobulleOffre } from "../composants/infobulle/infobulle.js";

const RAYON = 3;
const OPACITE = 0.72;

export function creerPoints(svg, etat) {
  const g = svg.append("g").attr("class", "t2-points");

  function dessiner(offres, { x, y }) {
    g.selectAll("circle")
      .data(offres, (o) => o.id)
      .join("circle")
      .attr("cx", (o) => x(o.dist_centre_km))
      .attr("cy", (o) => y(o.prix_nuit_eur))
      .attr("r", RAYON)
      .style("fill", (o) => couleurSource(o.source))
      .style("opacity", OPACITE)
      .on("pointerenter", (e, o) => { etat.survoler(o); afficherInfobulle(e, htmlInfobulleOffre(o)); })
      .on("pointermove", (e, o) => afficherInfobulle(e, htmlInfobulleOffre(o)))
      .on("pointerleave", () => { etat.survoler(null); masquerInfobulle(); })
      .on("click", (_, o) => etat.selectionner(o));
    surligner();
  }

  // L'offre survolée ou sélectionnée (ici ou dans la carte) passe au premier plan.
  function surligner() {
    g.selectAll("circle")
      .classed("survolee", (o) => o === etat.survol)
      .classed("selectionnee", (o) => o === etat.selection);
    g.selectAll("circle.selectionnee, circle.survolee").raise();
  }

  return { dessiner, surligner };
}
