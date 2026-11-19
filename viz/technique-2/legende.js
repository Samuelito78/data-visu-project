// Technique 2 : légende des couleurs (une pastille par source).

import { SOURCES, classeSource } from "../noyau/charte.js";

export function creerLegende(racine) {
  const legende = racine.append("p").attr("class", "t2-legende");
  for (const source of SOURCES) {
    const item = legende.append("span").attr("class", "t2-legende-item");
    item.append("span").attr("class", `pastille ${classeSource(source)}`);
    item.append("span").text(source);
  }
  return legende;
}
