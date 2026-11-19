// Infobulle partagée : une seule bulle dans la page, positionnée près du pointeur.

import {
  echapper, libelleOffre, classeSource, formatPrix, formatNote, formatKm, formatEtoiles,
} from "../../noyau/charte.js";

const d3 = window.d3;
let bulle = null;

export function afficherInfobulle(evenement, html) {
  bulle ??= d3.select("body").append("div").attr("class", "infobulle").attr("role", "tooltip");
  bulle.html(html).classed("visible", true);
  // Placée à droite et en dessous du pointeur, retournée si elle sort de la fenêtre.
  const { width, height } = bulle.node().getBoundingClientRect();
  const marge = 14;
  let x = evenement.clientX + marge;
  let y = evenement.clientY + marge;
  if (x + width > window.innerWidth - 8) x = evenement.clientX - width - marge;
  if (y + height > window.innerHeight - 8) y = evenement.clientY - height - marge;
  bulle.style("left", `${Math.max(8, x)}px`).style("top", `${Math.max(8, y)}px`);
}

export function masquerInfobulle() {
  bulle?.classed("visible", false);
}

// Contenu standard pour une offre. Une vue peut en écrire un autre.
export function htmlInfobulleOffre(o) {
  const lignes = [
    `<strong>${echapper(libelleOffre(o))}</strong>`,
    `<span class="pastille ${classeSource(o.source)}"></span>${echapper(o.source)} · ${formatPrix(o.prix_nuit_eur)} / nuit`,
    `Note ${formatNote(o.note_100)}${o.etoiles ? ` · ${formatEtoiles(o.etoiles)}` : ""}`,
    `${formatKm(o.dist_centre_km)} du centre · ${echapper(o.quartier ?? "quartier inconnu")}`,
  ];
  return lignes.join("<br>");
}
