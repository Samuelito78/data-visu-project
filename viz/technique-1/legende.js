// Technique 1 : légende de la carte. Sens du triangle, dégradé d'éloignement à la médiane
// par source, et médianes de référence de la ville.

import { SOURCES, classeSource, formatPrix } from "../noyau/charte.js";
import { TRIANGLE } from "./triangles.js";

const d3 = window.d3;

const L = 200;               // longueur d'une barre de dégradé, en pixels
const H = 10;                // hauteur d'une barre

const nomPluriel = (s) => (s === "Hôtel" ? "Hôtels" : "Airbnb");

function bloc(legende, titre) {
  const b = legende.append("div").attr("class", "t1-legende-bloc");
  b.append("span").attr("class", "t1-legende-titre").text(titre);
  return b;
}

function sensDuTriangle(legende) {
  const sens = bloc(legende, "Prix par rapport à la médiane (hôtels ou Airbnb)");
  for (const [haut, texte] of [[true, "Plus cher que la médiane"], [false, "Moins cher que la médiane"]]) {
    const item = sens.append("span").attr("class", "t1-legende-item");
    item.append("svg").attr("width", 14).attr("height", 14).attr("viewBox", [-7, -7, 14, 14])
      .append("path").attr("d", TRIANGLE).attr("transform", `scale(0.85)${haut ? "" : " rotate(180)"}`)
      .style("fill", "var(--texte-secondaire)");
    item.append("span").text(texte);
  }
  sens.append("span").attr("class", "t1-legende-note").text("La taille diminue quand on zoome, pour séparer les offres proches.");
}

// Une barre de dégradé par source ; la dernière porte l'axe.
function eloignement(legende, prix) {
  const couleur = bloc(legende, "Éloignement de la médiane");
  for (const s of SOURCES) {
    const avecAxe = s === SOURCES[SOURCES.length - 1];
    const ligne = couleur.append("div").attr("class", "t1-legende-barre");
    ligne.append("span").text(nomPluriel(s));
    const hBarre = avecAxe ? H + 18 : H + 2;
    const g = ligne.append("svg").attr("width", L + 30).attr("height", hBarre).attr("viewBox", [0, 0, L + 30, hBarre]);
    const id = `t1-degrade-${classeSource(s)}`;
    g.append("defs").append("linearGradient").attr("id", id)
      .selectAll("stop").data(d3.range(11)).join("stop")
      .attr("offset", (i) => i / 10)
      .attr("stop-color", (i) => prix.echelle(s)(i / 10));
    g.append("rect").attr("x", 10).attr("y", 1).attr("width", L).attr("height", H).attr("rx", 2).attr("fill", `url(#${id})`);
    if (avecAxe) {
      const x = d3.scaleLinear([0, 1], [10, 10 + L]);
      g.append("g").attr("class", "axe").attr("transform", `translate(0,${H + 1})`)
        .call(d3.axisBottom(x).tickValues([0, 0.5, 1]).tickSize(4)
          .tickFormat((v) => (v === 0 ? "médiane" : v === 0.5 ? "×1,4 ou ÷1,4" : "×2 ou ÷2 et +")))
        .call((a) => a.select(".domain").remove());
    }
  }
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
      sensDuTriangle(legende);
      eloignement(legende, prix);
      medianesDeReference(legende, prix, ville);
    },
  };
}
