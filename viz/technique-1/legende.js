// Technique 1 : légende de la carte. Une barre à deux côtés par source (moins cher à gauche,
// médiane au centre, plus cher à droite, la couleur fonçant des deux côtés, comme sur la carte),
// puis les médianes de référence de la ville.

import { SOURCES, classeSource, formatPrix } from "../noyau/charte.js";
import { TRIANGLE } from "./triangles.js";

const d3 = window.d3;

const L = 240;               // longueur d'une barre, en pixels
const H = 10;                // hauteur d'une barre
const BORD = 16;             // place réservée au triangle à chaque bout de la barre

const nomPluriel = (s) => (s === "Hôtel" ? "Hôtels" : "Airbnb");

function bloc(legende, titre) {
  const b = legende.append("div").attr("class", "t1-legende-bloc");
  b.append("span").attr("class", "t1-legende-titre").text(titre);
  return b;
}

// La barre va de « deux fois moins cher » à « deux fois plus cher » (échelle logarithmique, comme prix.js) :
// la teinte en un point est |log2(rapport)|, donc 0 au centre et 1 aux deux bouts.
function prixParRapportALaMediane(legende, prix) {
  const b = bloc(legende, "Prix par rapport à la médiane de la ville");
  for (const s of SOURCES) {
    const avecAxe = s === SOURCES[SOURCES.length - 1];
    const couleur = prix.echelle(s);
    const ligne = b.append("div").attr("class", "t1-legende-barre");
    ligne.append("span").text(nomPluriel(s));
    const largeur = L + 2 * BORD;
    const hauteur = avecAxe ? H + 20 : H + 2;
    const g = ligne.append("svg").attr("width", largeur).attr("height", hauteur).attr("viewBox", [0, 0, largeur, hauteur]);
    const id = `t1-degrade-${classeSource(s)}`;
    g.append("defs").append("linearGradient").attr("id", id)
      .selectAll("stop").data(d3.range(21)).join("stop")
      .attr("offset", (i) => i / 20)
      .attr("stop-color", (i) => couleur(Math.abs(i / 10 - 1)));
    g.append("rect").attr("x", BORD).attr("y", 1).attr("width", L).attr("height", H).attr("rx", 2).attr("fill", `url(#${id})`);
    // ▼ à gauche, ▲ à droite, dans la couleur la plus foncée.
    for (const [x, haut] of [[BORD / 2, false], [BORD + L + BORD / 2, true]]) {
      g.append("path").attr("d", TRIANGLE)
        .attr("transform", `translate(${x},${1 + H / 2}) scale(0.7)${haut ? "" : " rotate(180)"}`)
        .style("fill", couleur(1));
    }
    if (avecAxe) {
      // Libellés alignés sur les bords de la barre pour ne jamais déborder du SVG.
      const axe = g.append("g").attr("class", "axe");
      for (const [x, texte, ancre] of [[BORD, "moins cher", "start"], [BORD + L / 2, "médiane", "middle"], [BORD + L, "plus cher", "end"]]) {
        axe.append("line").attr("x1", x).attr("x2", x).attr("y1", H + 2).attr("y2", H + 6);
        axe.append("text").attr("x", x).attr("y", H + 18).attr("text-anchor", ancre).text(texte);
      }
    }
  }
  b.append("span").attr("class", "t1-legende-note")
    .text("Plus le triangle est foncé, plus son prix s'éloigne de la médiane. Sa taille diminue quand on zoome, pour séparer les offres proches.");
}

function medianesDeReference(legende, prix, ville) {
  const ref = bloc(legende, `Médianes de référence à ${ville.nom}`);
  const dl = ref.append("dl").attr("class", "t1-medianes");
  for (const s of SOURCES) {
    if (!prix.medianes.has(s)) continue;
    dl.append("dt").text(nomPluriel(s));
    dl.append("dd").text(`${formatPrix(prix.medianes.get(s))} / nuit`);
  }
  ref.append("span").attr("class", "t1-legende-note")
    .text("Toutes les offres de la ville, sans filtre. Environ 30 % des hôtels n'ont pas de position : ils comptent dans la médiane, sans triangle.");
}

export function creerLegende(racine) {
  const legende = racine.append("div").attr("class", "t1-legende");
  return {
    // Redessinée à chaque ville et à chaque changement de thème (les couleurs sont relues).
    dessiner(prix, ville) {
      legende.selectAll("*").remove();
      prixParRapportALaMediane(legende, prix);
      medianesDeReference(legende, prix, ville);
    },
  };
}
