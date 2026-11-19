// Technique 1 : les offres, un triangle par offre qui a une position.
//   ▲ : prix au-dessus de la médiane de sa source ; ▼ : en dessous. Couleur : éloignement à la médiane (prix.js).
// Plus on zoome, plus les triangles sont petits, jusqu'à une taille minimale qui reste cliquable.

import { afficherInfobulle, masquerInfobulle, htmlInfobulleOffre } from "../composants/infobulle/infobulle.js";

const d3 = window.d3;

// La taille est une aire à l'écran, en px² : aire = AIRE_BASE × zoom^−EXPOSANT,
// sans descendre sous AIRE_MIN (environ 8 px de côté) pour que les offres restent faciles à cliquer.
export const TRIANGLE = d3.symbol(d3.symbolTriangle, 100)(); // tracé d'aire 100, mis à l'échelle par transform
const AIRE_BASE = 46;        // environ 10 px de côté au zoom 1
const AIRE_MIN = 30;         // environ 8 px de côté
const EXPOSANT = 0.25;
const AGRANDI = 3.5;         // facteur d'aire de l'offre sélectionnée
const AGRANDI_SURVOL = 3;    // facteur de taille (côté) de l'offre survolée
const aire = (k) => Math.max(AIRE_MIN, AIRE_BASE * Math.pow(k, -EXPOSANT));

// onClic(evenement, offre) : clic sur un triangle.
export function creerTriangles(calque, { etat, prix, onClic }) {
  let positions = new Map();   // id d'offre → [x, y] projetés (sans zoom)

  // Position, taille (qui dépend du zoom) et sens du triangle, en une seule transformation.
  function transformOffre(o, t) {
    const [x, y] = t.apply(positions.get(o.id));
    const a = aire(t.k) * (o === etat.selection ? AGRANDI : 1);
    const s = Math.sqrt(a / 100) * (o === etat.survol ? AGRANDI_SURVOL : 1);
    return `translate(${x},${y}) scale(${s})${prix.ecart(o).haut ? "" : " rotate(180)"}`;
  }

  // Petit triangle de la couleur de l'offre, pour l'infobulle.
  function pastille(o) {
    return `<svg class="t1-pastille-triangle" width="12" height="12" viewBox="-6 -6 12 12" aria-hidden="true">` +
      `<path d="${TRIANGLE}" transform="scale(0.75)${prix.ecart(o).haut ? "" : " rotate(180)"}" style="fill:${prix.couleur(o)}"></path></svg>`;
  }
  const htmlOffre = (o) => `${htmlInfobulleOffre(o)}<br>${pastille(o)}<strong>${prix.texteEcart(o)}</strong>`;

  return {
    // Nouvelle ville ou nouveau calage : positions projetées des offres (longitude d'abord).
    positionner(offres, projection) {
      positions = new Map();
      for (const o of offres) {
        if (o.lat != null && o.lon != null) positions.set(o.id, projection([o.lon, o.lat]));
      }
    },

    // Offres dont le triangle tombe dans la vue courante (avec une marge de 5 px).
    visibles(offres, t, largeur, hauteur) {
      const [x0, y0] = t.invert([0, 0]);
      const [x1, y1] = t.invert([largeur, hauteur]);
      return offres.filter((o) => {
        const p = positions.get(o.id);
        return p && p[0] >= x0 - 5 && p[0] <= x1 + 5 && p[1] >= y0 - 5 && p[1] <= y1 + 5;
      });
    },

    // Ordre de dessin : Airbnb puis hôtels, et dans chaque source les plus proches de la médiane
    // d'abord (les écarts forts restent au-dessus). `proches` : ids dans le cercle du point d'intérêt.
    dessiner(offres, t, proches) {
      const triees = [...offres].sort((a, b) => d3.ascending(a.source === "Hôtel", b.source === "Hôtel")
        || d3.ascending(prix.ecart(a).t, prix.ecart(b).t));
      calque.selectAll("path")
        .data(triees, (o) => o.id)
        .join("path")
        .attr("d", TRIANGLE)
        .attr("transform", (o) => transformOffre(o, t))
        .style("fill", prix.couleur)
        .classed("t1-proche-poi", (o) => proches.has(o.id))
        .on("pointerenter", (e, o) => { etat.survoler(o); afficherInfobulle(e, htmlOffre(o)); })
        .on("pointermove", (e, o) => afficherInfobulle(e, htmlOffre(o)))
        .on("pointerleave", () => { etat.survoler(null); masquerInfobulle(); })
        .on("click", (e, o) => { e.stopPropagation(); onClic(e, o); })
        .order();
    },

    // Pendant un zoom : position et taille seulement.
    placer(t) {
      calque.selectAll("path").attr("transform", (o) => transformOffre(o, t));
    },

    // Surlignage lié : l'offre sélectionnée grandit, l'offre survolée aussi ; toutes deux passent devant.
    surligner(t) {
      calque.selectAll("path")
        .attr("transform", (o) => transformOffre(o, t))
        .classed("selectionnee", (o) => o === etat.selection)
        .classed("survolee", (o) => o === etat.survol);
      calque.selectAll("path.selectionnee, path.survolee").raise();
    },

    contient: (o) => calque.selectAll("path").filter((p) => p === o).size() > 0,
    aUnePosition: (o) => positions.has(o.id),
    // Changement de ville : les offres précédentes n'ont ni position ni écart dans la nouvelle.
    vider() { calque.selectAll("path").remove(); },
  };
}
