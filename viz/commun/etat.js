// État partagé entre les vues : ville chargée, filtres, offre sélectionnée, offre survolée.
// C'est lui qui lie les vues : une vue ne parle jamais directement à l'autre,
// elle modifie l'état, et chaque vue réagit aux événements qui l'intéressent.
//
// Événements (le rappel reçoit l'état complet) :
//   "donnees"   une nouvelle ville est chargée (etat.donnees a changé) ; redessiner entièrement
//   "filtres"   les filtres ont changé ; recalculer etat.offresFiltrees()
//   "selection" une offre a été cliquée, ou la sélection est effacée (etat.selection vaut null)
//   "survol"    une offre est survolée, ou plus aucune (etat.survol vaut null)
//   "poi"       un point d'intérêt est choisi ou posé, ou effacé (etat.poi vaut null)

import { chargerVille } from "./donnees.js";
import { filtresParDefaut, appliquerFiltres } from "./filtres.js";

const d3 = window.d3;

export function creerEtat() {
  const evenements = d3.dispatch("donnees", "filtres", "selection", "survol", "poi", "chargement", "erreur");
  let compteur = 0;
  let filtreesCache = null;

  const etat = {
    donnees: null,          // { ville, offres, quartiers, couverture } (voir donnees.js)
    filtres: filtresParDefaut(),
    selection: null,        // une offre (ligne de la table) ou null
    survol: null,           // une offre ou null
    poi: null,              // point d'intérêt { id, nom, lon, lat, perso } ou null (commun/points-interet.js)

    get ville() {
      return this.donnees?.ville ?? null;
    },

    // S'abonner à un événement. Plusieurs vues peuvent écouter le même événement.
    on(type, rappel) {
      evenements.on(`${type}.ecouteur${++compteur}`, rappel);
      return etat;
    },

    // Offres de la ville courante qui passent les filtres (calcul mis en cache).
    offresFiltrees() {
      if (!etat.donnees) return [];
      filtreesCache ??= appliquerFiltres(etat.donnees.offres, etat.filtres);
      return filtreesCache;
    },

    async changerVille(id) {
      evenements.call("chargement", null, etat);
      try {
        const donnees = await chargerVille(id);
        etat.donnees = donnees;
        etat.selection = null;
        etat.survol = null;
        etat.poi = null;    // les points d'intérêt sont propres à chaque ville
        filtreesCache = null;
        evenements.call("donnees", null, etat);
        evenements.call("selection", null, etat);
      } catch (erreur) {
        console.error(erreur);
        evenements.call("erreur", null, etat, erreur);
      }
    },

    // Modifier une partie des filtres : etat.modifierFiltres({ prixMax: 150 }).
    modifierFiltres(partiel) {
      Object.assign(etat.filtres, partiel);
      filtreesCache = null;
      // La sélection est gardée même si elle ne passe plus les filtres : les vues décident.
      evenements.call("filtres", null, etat);
    },

    reinitialiserFiltres() {
      etat.filtres = filtresParDefaut();
      filtreesCache = null;
      evenements.call("filtres", null, etat);
    },

    selectionner(offre) {
      etat.selection = offre ?? null;
      evenements.call("selection", null, etat);
    },

    // Choisir un point d'intérêt (lieu prédéfini ou point posé sur la carte), ou l'effacer avec null.
    choisirPoi(poi) {
      etat.poi = poi ?? null;
      evenements.call("poi", null, etat);
    },

    survoler(offre) {
      if (etat.survol === (offre ?? null)) return;
      etat.survol = offre ?? null;
      evenements.call("survol", null, etat);
    },
  };

  return etat;
}
