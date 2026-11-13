// Limites des données à rendre visibles dans l'interface (docs/utilisateurs_taches.md, section 5).

import { formatEntier } from "./charte.js";

const d3 = window.d3;

const PAR_VILLE = {
  rome: "Rome : les prix des hôtels sont 2 à 5 fois plus élevés qu'ailleurs à étoiles égales, sans correction possible. " +
        "Ne pas comparer les prix hôtel / Airbnb de Rome (D7). Par ailleurs, 156 hôtels sur 207 sont dans le Municipio I (D16).",
  londres: "Londres : les annonces Airbnb ne couvrent que 14 boroughs centraux sur 33. Les autres boroughs sont grisés (D16).",
};

export function creerAvertissements(conteneur, etat) {
  const racine = d3.select(conteneur);

  function afficher() {
    const messages = [];
    if (etat.ville && PAR_VILLE[etat.ville.id]) messages.push(PAR_VILLE[etat.ville.id]);
    if (etat.filtres.periode === "toutes" && etat.filtres.sources.has("Airbnb")) {
      messages.push("Période « semaine et week-end » : une même annonce Airbnb peut figurer deux fois, une fois par période.");
    }
    if (etat.donnees) {
      const sansQuartier = etat.donnees.offres.filter((o) => o.quartier == null).length;
      if (sansQuartier > 0) {
        messages.push(`${formatEntier(sansQuartier)} hôtel(s) sans quartier connu : comptés dans les totaux, absents des vues par quartier.`);
      }
    }
    racine.selectAll("p.avertissement").data(messages, (d) => d).join("p")
      .attr("class", "avertissement").text((d) => d);
  }

  etat.on("donnees", afficher).on("filtres", afficher);
  etat.on("erreur", (_, erreur) => {
    racine.selectAll("p").remove();
    racine.append("p").attr("class", "avertissement erreur")
      .text(`Impossible de charger les données (${erreur.message}). Lancez ./scripts/serve.sh à la racine du dépôt, puis ouvrez http://localhost:8000/viz/.`);
  });
}
