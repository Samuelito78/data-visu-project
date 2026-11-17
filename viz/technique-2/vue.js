// Technique 2 : nuage de points distance au centre × prix par nuit.
//
// Cette vue montre la relation entre l'éloignement et le prix, pour les deux sources
// (hôtels en bleu, Airbnb en orange) selon les filtres actifs.
// Survol et clic utilisent l'état partagé pour la sélection liée avec la technique 1.

import {
  classeSource, couleurSource, formatPrix, formatKm, formatEntier,
} from "../commun/charte.js";
import { afficherInfobulle, masquerInfobulle, htmlInfobulleOffre } from "../commun/infobulle.js";

const d3 = window.d3;
const HAUTEUR = 320;
const MARGES = { haut: 12, droite: 18, bas: 42, gauche: 68 };
const RAYON = 3;
const OPACITE = 0.72;

export function creerVue(conteneur, etat) {
  const racine = d3.select(conteneur);
  const resume = racine.append("p").attr("class", "exemple-resume");

  const svg = racine.append("svg")
    .attr("role", "img")
    .attr("aria-label", "Nuage de points : distance au centre et prix par nuit");
  const gGrille = svg.append("g").attr("class", "axe");
  const gAxeX = svg.append("g").attr("class", "axe");
  const gAxeY = svg.append("g").attr("class", "axe");
  const gPoints = svg.append("g");

  const legende = racine.append("p").attr("class", "exemple-resume");
  for (const source of ["Hôtel", "Airbnb"]) {
    legende.append("span").attr("class", `pastille ${classeSource(source)}`);
    legende.append("span").text(source);
    legende.append("span").text("  ");
  }

  function dessiner() {
    if (!etat.donnees) return;
    const largeur = conteneur.clientWidth || 640;
    svg.attr("viewBox", `0 0 ${largeur} ${HAUTEUR}`).attr("width", largeur).attr("height", HAUTEUR);

    const offres = etat.offresFiltrees()
      .filter((o) => o.dist_centre_km != null && o.prix_nuit_eur != null);

    const maxDistance = d3.max(offres, (o) => o.dist_centre_km) ?? 1;
    const maxPrix = d3.max(offres, (o) => o.prix_nuit_eur) ?? 1;
    const maxDistanceAffichee = etat.filtres.distanceMax ?? maxDistance;
    const x = d3.scaleLinear([0, Math.max(1, maxDistanceAffichee)], [MARGES.gauche, largeur - MARGES.droite]).nice();
    const y = d3.scaleLinear([0, Math.max(1, maxPrix)], [HAUTEUR - MARGES.bas, MARGES.haut]).nice();

    gGrille.attr("transform", `translate(0,${HAUTEUR - MARGES.bas})`)
      .call(
        d3.axisBottom(x)
          .ticks(6)
          .tickSize(-(HAUTEUR - MARGES.bas - MARGES.haut))
          .tickFormat("")
      )
      .call((g) => g.select(".domain").remove());

    gAxeX.attr("transform", `translate(0,${HAUTEUR - MARGES.bas})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(formatKm));
    gAxeY.attr("transform", `translate(${MARGES.gauche},0)`)
      .call(d3.axisLeft(y).ticks(6).tickFormat(formatPrix));

    gAxeX.selectAll(".titre-axe").data([0]).join("text")
      .attr("class", "titre-axe")
      .attr("x", (largeur + MARGES.gauche - MARGES.droite) / 2)
      .attr("y", 34)
      .attr("fill", "var(--texte-secondaire)")
      .style("text-anchor", "middle")
      .text("Distance au centre");

    gAxeY.selectAll(".titre-axe").data([0]).join("text")
      .attr("class", "titre-axe")
      .attr("transform", "rotate(-90)")
      .attr("x", -(MARGES.haut + (HAUTEUR - MARGES.bas)) / 2)
      .attr("y", -50)
      .attr("fill", "var(--texte-secondaire)")
      .style("text-anchor", "middle")
      .text("Prix par nuit");

    gPoints.selectAll("circle")
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

    const comptes = d3.rollup(offres, (v) => v.length, (o) => o.source);
    resume.text(
      `${etat.ville.nom} : ${formatEntier(offres.length)} offres affichées `
      + `(${formatEntier(comptes.get("Hôtel") ?? 0)} hôtels, ${formatEntier(comptes.get("Airbnb") ?? 0)} Airbnb).`
    );
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
