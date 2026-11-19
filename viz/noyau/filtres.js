// Filtres communs (tâche T4 de docs/2-utilisateurs-taches.md).
// Un filtre qui ne concerne qu'une source laisse passer l'autre :
// les étoiles ne filtrent que les hôtels, la période que les Airbnb.

import { SOURCES, TYPES } from "./charte.js";

export function filtresParDefaut() {
  return {
    sources: new Set(SOURCES),
    types: new Set(TYPES),
    prixMax: null,        // euros par nuit ; null = sans limite
    distanceMax: null,    // km du centre ; null = sans limite
    noteMin: 0,           // sur 100 ; au-dessus de 0, les offres sans note sont exclues
    etoilesMin: 0,        // hôtels seulement ; au-dessus de 0, les hôtels sans étoiles sont exclus
    metroSeulement: false,
    periode: "toutes",    // "toutes", "semaine" ou "weekend" ; Airbnb seulement
  };
}

export function passeFiltres(o, f) {
  if (!f.sources.has(o.source)) return false;
  if (!f.types.has(o.type)) return false;
  if (f.prixMax != null && o.prix_nuit_eur > f.prixMax) return false;
  if (f.distanceMax != null && (o.dist_centre_km == null || o.dist_centre_km > f.distanceMax)) return false;
  if (f.noteMin > 0 && (o.note_100 == null || o.note_100 < f.noteMin)) return false;
  if (f.etoilesMin > 0 && o.source === "Hôtel" && (o.etoiles == null || o.etoiles < f.etoilesMin)) return false;
  if (f.metroSeulement && !o.metro_proche) return false;
  if (f.periode !== "toutes" && o.source === "Airbnb" && o.periode !== f.periode) return false;
  return true;
}

export function appliquerFiltres(offres, f) {
  return offres.filter((o) => passeFiltres(o, f));
}
