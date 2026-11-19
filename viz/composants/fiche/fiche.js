// Fiche de l'offre sélectionnée (tâche T6, niveau « détails à la demande »), en haut du panneau latéral.

import {
  libelleOffre, classeSource, formatPrix, formatNote, formatKm, formatEtoiles, formatEntier,
} from "../../noyau/charte.js";

const d3 = window.d3;

function lignesFiche(o) {
  const lignes = [
    ["Prix", `${formatPrix(o.prix_nuit_eur)} / nuit${o.source === "Hôtel" ? " (hors taxes)" : ""}`],
    ["Note", formatNote(o.note_100)],
  ];
  if (o.source === "Hôtel") {
    lignes.push(["Avis", formatEntier(o.nb_avis)], ["Étoiles", formatEtoiles(o.etoiles)]);
  } else {
    lignes.push(
      ["Capacité", o.capacite == null ? "—" : `${o.capacite} personnes`],
      ["Superhost", o.superhost ? "oui" : "non"],
      ["Période", o.periode === "weekend" ? "week-end" : "semaine"],
    );
  }
  lignes.push(
    ["Type", o.type],
    ["Distance", `${formatKm(o.dist_centre_km)} du centre (${o.tranche_dist})`],
    ["Quartier", o.quartier ?? "inconnu"],
    ["Métro", o.metro_proche ? "station proche" : "pas de station proche"],
    ["Identifiant", o.id],
  );
  return lignes;
}

export function creerFiche(conteneur, etat) {
  const racine = d3.select(conteneur).classed("fiche", true);

  function afficher() {
    racine.selectAll("*").remove();
    const o = etat.selection;
    if (!o) {
      racine.append("p").attr("class", "fiche-vide")
        .text("Cliquez sur une offre dans une vue pour afficher sa fiche.");
      return;
    }
    const entete = racine.append("div").attr("class", "fiche-entete");
    entete.append("h2").text(libelleOffre(o));
    entete.append("button").attr("type", "button").attr("aria-label", "Fermer la fiche").text("×")
      .on("click", () => etat.selectionner(null));
    const sous = racine.append("p").attr("class", "fiche-source");
    sous.append("span").attr("class", `pastille ${classeSource(o.source)}`);
    sous.append("span").text(o.source);

    if (o.prix_comparable === false) {
      racine.append("p").attr("class", "avertissement")
        .text("Prix non comparable avec les Airbnb (hôtels de Rome, D7).");
    }
    const dl = racine.append("dl");
    for (const [cle, valeur] of lignesFiche(o)) {
      dl.append("dt").text(cle);
      dl.append("dd").text(valeur);
    }
  }

  etat.on("selection", afficher);
  afficher();
}
