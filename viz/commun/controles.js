// Barre de contrôles commune : changer de ville (changer de dataset) et filtrer (T4).
// Les filtres s'appliquent aux deux techniques à la fois.

import {
  VILLES, SOURCES, TYPES, BUDGET, DISTANCE_CENTRE, classeSource, formatPrix, formatEntier, formatKm,
} from "./charte.js";

const d3 = window.d3;

function groupe(racine, libelle) {
  const g = racine.append("div").attr("class", "controle");
  g.append("span").attr("class", "controle-libelle").text(libelle);
  return g;
}

function casesACocher(g, valeurs, cle, etat, avecPastille) {
  const options = g.append("div").attr("class", "controle-options")
    .selectAll("label").data(valeurs).join("label");
  options.append("input").attr("type", "checkbox").attr("value", (d) => d)
    .on("change", function () {
      const ensemble = new Set(etat.filtres[cle]);
      if (this.checked) ensemble.add(this.value);
      else ensemble.delete(this.value);
      etat.modifierFiltres({ [cle]: ensemble });
    });
  if (avecPastille) options.append("span").attr("class", (d) => `pastille ${classeSource(d)}`);
  options.append("span").text((d) => d);
  return options.select("input");
}

export function creerControles(conteneur, etat) {
  const racine = d3.select(conteneur);

  // Ville
  const selectVille = groupe(racine, "Ville").append("select")
    .attr("aria-label", "Ville")
    .on("change", (e) => etat.changerVille(e.target.value));
  selectVille.selectAll("option").data(VILLES).join("option")
    .attr("value", (d) => d.id).text((d) => d.nom);

  // Période (Airbnb seulement)
  const selectPeriode = groupe(racine, "Période Airbnb").append("select")
    .attr("aria-label", "Période Airbnb")
    .on("change", (e) => etat.modifierFiltres({ periode: e.target.value }));
  selectPeriode.selectAll("option")
    .data([["toutes", "Semaine et week-end"], ["semaine", "Semaine"], ["weekend", "Week-end"]])
    .join("option").attr("value", (d) => d[0]).text((d) => d[1]);

  // Budget par nuit
  const gBudget = groupe(racine, "Budget max / nuit");
  const valeurBudget = gBudget.append("output");
  const curseurBudget = gBudget.append("input").attr("type", "range")
    .attr("aria-label", "Budget maximal par nuit")
    .attr("min", BUDGET.min).attr("max", BUDGET.max).attr("step", BUDGET.pas)
    .on("input", (e) => {
      const v = +e.target.value;
      etat.modifierFiltres({ prixMax: v >= BUDGET.max ? null : v });
    });

  // Distance max au centre
  const gDistance = groupe(racine, "Distance max centre");
  const valeurDistance = gDistance.append("output");
  const curseurDistance = gDistance.append("input").attr("type", "range")
    .attr("aria-label", "Distance maximale au centre")
    .attr("min", DISTANCE_CENTRE.min).attr("max", DISTANCE_CENTRE.max).attr("step", DISTANCE_CENTRE.pas)
    .on("input", (e) => {
      const v = +e.target.value;
      etat.modifierFiltres({ distanceMax: v >= DISTANCE_CENTRE.max ? null : v });
    });

  // Note minimale
  const gNote = groupe(racine, "Note min.");
  const valeurNote = gNote.append("output");
  const curseurNote = gNote.append("input").attr("type", "range")
    .attr("aria-label", "Note minimale sur 100")
    .attr("min", 0).attr("max", 100).attr("step", 5)
    .on("input", (e) => etat.modifierFiltres({ noteMin: +e.target.value }));

  // Étoiles minimales (hôtels seulement)
  const selectEtoiles = groupe(racine, "Étoiles min. (hôtels)").append("select")
    .attr("aria-label", "Étoiles minimales des hôtels")
    .on("change", (e) => etat.modifierFiltres({ etoilesMin: +e.target.value }));
  selectEtoiles.selectAll("option")
    .data([[0, "Toutes"], [2, "2 ★ et +"], [3, "3 ★ et +"], [4, "4 ★ et +"], [5, "5 ★"]])
    .join("option").attr("value", (d) => d[0]).text((d) => d[1]);

  // Sources, types, métro
  const casesSources = casesACocher(groupe(racine, "Source"), SOURCES, "sources", etat, true);
  const casesTypes = casesACocher(groupe(racine, "Type"), TYPES, "types", etat, false);
  const caseMetro = groupe(racine, "Métro").append("label").attr("class", "controle-options");
  const inputMetro = caseMetro.append("input").attr("type", "checkbox")
    .on("change", (e) => etat.modifierFiltres({ metroSeulement: e.target.checked }));
  caseMetro.append("span").text("Proche seulement");

  // Réinitialisation et compteur
  const gFin = racine.append("div").attr("class", "controle controle-fin");
  gFin.append("button").attr("type", "button").text("Réinitialiser les filtres")
    .on("click", () => etat.reinitialiserFiltres());
  const compteur = gFin.append("p").attr("class", "compteur").attr("aria-live", "polite");

  // Remet les champs en accord avec l'état (après une réinitialisation, ou au chargement).
  function synchroniser() {
    const f = etat.filtres;
    if (etat.ville) selectVille.property("value", etat.ville.id);
    selectPeriode.property("value", f.periode);
    curseurBudget.property("value", f.prixMax ?? BUDGET.max);
    valeurBudget.text(f.prixMax == null ? "sans limite" : formatPrix(f.prixMax));
    curseurDistance.property("value", f.distanceMax ?? DISTANCE_CENTRE.max);
    valeurDistance.text(f.distanceMax == null ? "sans limite" : formatKm(f.distanceMax));
    curseurNote.property("value", f.noteMin);
    valeurNote.text(f.noteMin === 0 ? "toutes" : `${f.noteMin}/100`);
    selectEtoiles.property("value", f.etoilesMin);
    casesSources.property("checked", (d) => f.sources.has(d));
    casesTypes.property("checked", (d) => f.types.has(d));
    inputMetro.property("checked", f.metroSeulement);

    if (!etat.donnees) return;
    const total = etat.donnees.offres.length;
    const filtrees = etat.offresFiltrees();
    const n = d3.rollup(filtrees, (v) => v.length, (o) => o.source);
    compteur.text(
      `${formatEntier(filtrees.length)} offres sur ${formatEntier(total)} : ` +
      `${formatEntier(n.get("Hôtel") ?? 0)} hôtels, ${formatEntier(n.get("Airbnb") ?? 0)} Airbnb`
    );
  }

  etat.on("donnees", synchroniser).on("filtres", synchroniser);
  synchroniser();
}
