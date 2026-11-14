// Technique 1 : EXEMPLE À REMPLACER par la vraie visualisation.
//
// Il montre le contrat d'une vue et les gestes de base en SVG :
// dessiner à partir de l'état, redessiner au redimensionnement,
// survol → infobulle + etat.survoler(), clic → etat.selectionner(), surligner la sélection venue de l'autre vue.
//
// Ici : un nuage de points « prix par nuit × source », avec un léger décalage vertical aléatoire.

import { SOURCES, BUDGET, couleurSource, formatPrix } from "../commun/charte.js";
import { afficherInfobulle, masquerInfobulle, htmlInfobulleOffre } from "../commun/infobulle.js";

const d3 = window.d3;
const MARGES = { haut: 12, droite: 16, bas: 36, gauche: 64 };
const HAUTEUR = 260;

export function creerVue(conteneur, etat) {
  const svg = d3.select(conteneur).append("svg")
    .attr("role", "img").attr("aria-label", "Prix par nuit des offres, par source");
  const gAxeX = svg.append("g").attr("class", "axe");
  const gAxeY = svg.append("g").attr("class", "axe");
  const gPoints = svg.append("g");
  // Décalage vertical stable par offre, pour que les points ne sautent pas à chaque filtre.
  const decalage = new Map();

  function dessiner() {
    if (!etat.donnees) return;
    const largeur = conteneur.clientWidth || 600;
    svg.attr("viewBox", `0 0 ${largeur} ${HAUTEUR}`).attr("width", largeur).attr("height", HAUTEUR);

    const x = d3.scaleLinear([0, BUDGET.max], [MARGES.gauche, largeur - MARGES.droite]).clamp(true);
    const y = d3.scaleBand(SOURCES, [MARGES.haut, HAUTEUR - MARGES.bas]).padding(0.25);

    gAxeX.attr("transform", `translate(0,${HAUTEUR - MARGES.bas})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(formatPrix));
    gAxeY.attr("transform", `translate(${MARGES.gauche},0)`)
      .call(d3.axisLeft(y).tickSize(0)).call((g) => g.select(".domain").remove());

    const offres = etat.offresFiltrees();
    gPoints.selectAll("circle")
      .data(offres, (o) => o.id)
      .join("circle")
      .attr("cx", (o) => x(o.prix_nuit_eur))
      .attr("cy", (o) => {
        if (!decalage.has(o.id)) decalage.set(o.id, Math.random());
        return y(o.source) + decalage.get(o.id) * y.bandwidth();
      })
      .attr("r", 2.5)
      .style("fill", (o) => couleurSource(o.source))
      .on("pointerenter", (e, o) => { etat.survoler(o); afficherInfobulle(e, htmlInfobulleOffre(o)); })
      .on("pointermove", (e, o) => afficherInfobulle(e, htmlInfobulleOffre(o)))
      .on("pointerleave", () => { etat.survoler(null); masquerInfobulle(); })
      .on("click", (_, o) => etat.selectionner(o));
    surligner();
  }

  function surligner() {
    gPoints.selectAll("circle")
      .classed("selectionnee", (o) => o === etat.selection)
      .classed("survolee", (o) => o === etat.survol);
    gPoints.selectAll("circle.selectionnee, circle.survolee").raise();
  }

  etat.on("donnees", dessiner).on("filtres", dessiner)
    .on("selection", surligner).on("survol", surligner);
  new ResizeObserver(() => dessiner()).observe(conteneur);
}
