// Technique 2 : EXEMPLE À REMPLACER par la vraie visualisation.
//
// Même contrat que la technique 1, en HTML plutôt qu'en SVG :
// la liste des offres les mieux notées parmi celles qui passent les filtres (une ébauche de T5).
// Cliquer une ligne met à jour la fiche de détail et le surlignage dans la technique 1 : c'est la sélection liée.

import { classeSource, formatPrix, formatNote, libelleOffre } from "../commun/charte.js";

const d3 = window.d3;
const NOMBRE = 10;

export function creerVue(conteneur, etat) {
  const racine = d3.select(conteneur);
  const titre = racine.append("p").attr("class", "exemple-resume");
  const liste = racine.append("ol").attr("class", "exemple-liste");

  function dessiner() {
    if (!etat.donnees) return;
    const meilleures = d3.sort(
      etat.offresFiltrees().filter((o) => o.note_100 != null),
      (a, b) => d3.descending(a.note_100, b.note_100) || d3.ascending(a.prix_nuit_eur, b.prix_nuit_eur)
    ).slice(0, NOMBRE);
    titre.text(`${etat.ville.nom} : les ${NOMBRE} offres les mieux notées, puis les moins chères à note égale`);

    liste.selectAll("li")
      .data(meilleures, (o) => o.id)
      .join((entree) => {
        const li = entree.append("li");
        const bouton = li.append("button").attr("type", "button");
        bouton.append("span").attr("class", (o) => `pastille ${classeSource(o.source)}`);
        bouton.append("span").attr("class", "exemple-nom");
        bouton.append("span").attr("class", "exemple-valeurs");
        return li;
      })
      .call((li) => {
        li.select(".exemple-nom").text(libelleOffre);
        li.select(".exemple-valeurs").text((o) => `${formatNote(o.note_100)} · ${formatPrix(o.prix_nuit_eur)}`);
        li.select("button")
          .on("click", (_, o) => etat.selectionner(o))
          .on("pointerenter", (_, o) => etat.survoler(o))
          .on("pointerleave", () => etat.survoler(null));
      });
    surligner();
  }

  function surligner() {
    liste.selectAll("li")
      .classed("selectionnee", (o) => o === etat.selection)
      .classed("survolee", (o) => o === etat.survol);
  }

  etat.on("donnees", dessiner).on("filtres", dessiner)
    .on("selection", surligner).on("survol", surligner);
}
