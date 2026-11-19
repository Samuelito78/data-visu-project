// Technique 1 : les quartiers. Contours sur fond neutre (non colorés, pour ne pas orienter la lecture
// par quartier), étiquettes qui ne s'affichent que si elles tiennent, infobulle de comptage.

import { SOURCES, classeSource, formatEntier, echapper } from "../noyau/charte.js";
import { afficherInfobulle, masquerInfobulle } from "../composants/infobulle/infobulle.js";
import { pluriel } from "./prix.js";

const d3 = window.d3;

// Étiquette courte d'un quartier : « 11e » pour Paris, « XIII » pour Rome, le nom complet ailleurs.
function etiquette(nom) {
  if (nom.endsWith(" arrondissement")) return nom.split(" ")[0];
  if (nom.startsWith("Municipio ")) return nom.slice("Municipio ".length);
  return nom;
}

// onClic(evenement, feature) : clic sur un quartier (entre les triangles).
export function creerQuartiers(calqueContours, calqueEtiquettes, { etat, prix, fond, onClic }) {
  let centres = new Map();     // quartier → [x, y] du centre de l'étiquette
  let tailles = new Map();     // quartier → [largeur, hauteur] du contour, en pixels sans zoom
  const longueurs = new Map(); // quartier → longueur de son étiquette, en pixels

  // Nombre de triangles vers le haut et vers le bas d'un quartier, par source cochée.
  function compter(nom) {
    const liste = etat.offresFiltrees().filter((o) => o.quartier === nom);
    return SOURCES.filter((s) => etat.filtres.sources.has(s)).map((s) => {
      const l = liste.filter((o) => o.source === s);
      const haut = l.filter((o) => prix.ecart(o).haut).length;
      return { source: s, nombre: l.length, haut, bas: l.length - haut };
    });
  }

  function htmlQuartier(nom) {
    const lignes = [`<strong>${echapper(nom)}</strong>`];
    for (const c of compter(nom)) {
      lignes.push(
        `<span class="pastille ${classeSource(c.source)}"></span>${pluriel(c.source)} : ${formatEntier(c.nombre)}` +
        (c.nombre > 0 ? ` · ${formatEntier(c.haut)} ▲ ${formatEntier(c.bas)} ▼` : "")
      );
    }
    if (nom !== fond.quartierZoome) lignes.push("Cliquez pour zoomer sur le quartier.");
    return lignes.join("<br>");
  }

  // Contours et étiquettes : ne changent qu'avec la ville ou la taille (après fond.caler).
  function dessiner(geo) {
    centres = new Map();
    tailles = new Map();
    for (const f of geo.features) {
      const [[x0, y0], [x1, y1]] = fond.chemin.bounds(f);
      centres.set(f.properties.quartier, fond.chemin.centroid(f));
      tailles.set(f.properties.quartier, [x1 - x0, y1 - y0]);
    }

    calqueContours.selectAll("path")
      .data(geo.features, (f) => f.properties.quartier)
      .join("path")
      .attr("d", fond.chemin)
      .on("pointerenter", function (e, f) {
        d3.select(this).raise();
        afficherInfobulle(e, htmlQuartier(f.properties.quartier));
      })
      .on("pointermove", (e, f) => afficherInfobulle(e, htmlQuartier(f.properties.quartier)))
      .on("pointerleave", () => masquerInfobulle())
      .on("click", (e, f) => { e.stopPropagation(); onClic(e, f); });

    calqueEtiquettes.selectAll("text")
      .data(geo.features, (f) => f.properties.quartier)
      .join("text")
      .text((f) => etiquette(f.properties.quartier))
      .each(function (f) {
        // Longueur réelle du texte : sert à n'afficher que les étiquettes qui tiennent dans leur quartier.
        // Un texte masqué mesure 0 : on le réaffiche le temps de la mesure.
        this.removeAttribute("display");
        longueurs.set(f.properties.quartier, this.getComputedTextLength());
      });
  }

  // Une étiquette n'est affichée que si elle tient dans son quartier et ne chevauche pas une autre.
  // Les grands quartiers passent en premier : en cas de conflit, c'est le petit qui perd son étiquette.
  function placerEtiquettes(t) {
    const placees = [];  // rectangles [x0, y0, x1, y1] des étiquettes déjà affichées
    const visibles = new Set();
    const parTaille = [...tailles.entries()].sort((a, b) => d3.descending(a[1][0] * a[1][1], b[1][0] * b[1][1]));
    for (const [nom, [l, h]] of parTaille) {
      const w = longueurs.get(nom) ?? 0;
      if (l * t.k * 0.75 < w + 4 || h * t.k < 18) continue;
      const [x, y] = t.apply(centres.get(nom));
      const r = [x - w / 2 - 3, y - 8, x + w / 2 + 3, y + 8];
      if (placees.some((p) => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1])) continue;
      placees.push(r);
      visibles.add(nom);
    }
    calqueEtiquettes.selectAll("text")
      .attr("transform", (f) => `translate(${t.apply(centres.get(f.properties.quartier))})`)
      .attr("display", (f) => (visibles.has(f.properties.quartier) && f.properties.quartier !== fond.quartierZoome ? null : "none"));
  }

  return {
    dessiner,
    placerEtiquettes,
    compter,
    // Le quartier zoomé est souligné, les autres estompés.
    marquerZoome() {
      const zoome = fond.quartierZoome;
      calqueContours.selectAll("path")
        .classed("t1-zoome", (f) => f.properties.quartier === zoome)
        .classed("t1-estompe", (f) => zoome != null && f.properties.quartier !== zoome);
    },
    // Surlignage lié : le quartier de l'offre survolée ou sélectionnée (ici ou dans l'autre vue).
    surligner(noms) {
      calqueContours.selectAll("path").classed("t1-lie", (f) => noms.has(f.properties.quartier));
      calqueContours.selectAll("path.t1-zoome, path.t1-lie").raise();
    },
    trouver: (nom) => etat.donnees?.quartiers.features.find((f) => f.properties.quartier === nom),
  };
}
