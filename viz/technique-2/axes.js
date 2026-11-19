// Technique 2 : échelles, grille et axes du nuage de points (distance au centre × prix par nuit).

import { formatPrix, formatKm } from "../noyau/charte.js";

const d3 = window.d3;

export const HAUTEUR = 320;
export const MARGES = { haut: 12, droite: 18, bas: 42, gauche: 68 };

// Échelles x (distance) et y (prix) pour les offres affichées. `distance(o)` donne l'abscisse d'une offre ;
// `distanceMax`, s'il est donné (filtre « distance max »), fixe la fin de l'axe pour que le nuage occupe la largeur.
export function creerEchelles(offres, { distance, distanceMax }, largeur) {
  const maxDistance = d3.max(offres, distance) ?? 1;
  const maxPrix = d3.max(offres, (o) => o.prix_nuit_eur) ?? 1;
  const maxDistanceAffichee = distanceMax ?? maxDistance;
  return {
    x: d3.scaleLinear([0, Math.max(1, maxDistanceAffichee)], [MARGES.gauche, largeur - MARGES.droite]).nice(),
    y: d3.scaleLinear([0, Math.max(1, maxPrix)], [HAUTEUR - MARGES.bas, MARGES.haut]).nice(),
  };
}

// Grille verticale et deux axes titrés, dans le SVG de la vue.
export function creerAxes(svg) {
  const gGrille = svg.append("g").attr("class", "axe");
  const gAxeX = svg.append("g").attr("class", "axe");
  const gAxeY = svg.append("g").attr("class", "axe");

  function titre(g, texte) {
    return g.selectAll(".titre-axe").data([texte]).join("text")
      .attr("class", "titre-axe")
      .attr("fill", "var(--texte-secondaire)")
      .style("text-anchor", "middle")
      .text((d) => d);
  }

  function dessiner({ x, y }, largeur, titreX) {
    gGrille.attr("transform", `translate(0,${HAUTEUR - MARGES.bas})`)
      .call(d3.axisBottom(x).ticks(6).tickSize(-(HAUTEUR - MARGES.bas - MARGES.haut)).tickFormat(""))
      .call((g) => g.select(".domain").remove());

    gAxeX.attr("transform", `translate(0,${HAUTEUR - MARGES.bas})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(formatKm));
    gAxeY.attr("transform", `translate(${MARGES.gauche},0)`)
      .call(d3.axisLeft(y).ticks(6).tickFormat(formatPrix));

    titre(gAxeX, titreX)
      .attr("x", (largeur + MARGES.gauche - MARGES.droite) / 2)
      .attr("y", 34);
    titre(gAxeY, "Prix par nuit")
      .attr("transform", "rotate(-90)")
      .attr("x", -(MARGES.haut + (HAUTEUR - MARGES.bas)) / 2)
      .attr("y", -50);
  }

  return { dessiner };
}
