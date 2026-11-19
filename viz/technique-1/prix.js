// Technique 1 : position de chaque offre par rapport au prix médian de sa source, et couleurs.
//
// Médiane de chaque source sur toute la ville (sans filtre) : médiane des hôtels pour un hôtel,
// médiane des Airbnb pour un Airbnb. Les hôtels sans position comptent dans la médiane.
// La couleur dit l'éloignement à cette médiane : claire à la médiane, de plus en plus foncée
// jusqu'à ×2 ou ÷2 (LOG_MAX), bleue pour les hôtels, rouge pour les Airbnb (variables de carte.css).

import { formatPrix } from "../noyau/charte.js";

const d3 = window.d3;

const LOG_MAX = 1;           // écart log2 à partir duquel la couleur est la plus foncée : ×2 ou ÷2
const fPct = d3.formatLocale({ decimal: ",", thousands: " ", grouping: [3], currency: ["", " €"] }).format("+.0%");

export const pluriel = (source) => (source === "Hôtel" ? "hôtels" : "Airbnb");

// Lit une variable CSS du thème courant : une échelle D3 a besoin d'une vraie couleur, pas de var(--…).
function lireCouleur(nom) {
  return getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
}

// Une échelle par source, de la couleur claire (à la médiane) à la plus foncée.
function lireEchelles() {
  const piste = (s) => d3.piecewise(d3.interpolateLab, ["mediane", "moyen", "loin"].map((n) => lireCouleur(`--t1-${s}-${n}`)));
  return { "Hôtel": piste("hotel"), "Airbnb": piste("airbnb") };
}

export function creerPrix() {
  let medianes = new Map();  // source → prix médian dans la ville
  let ecarts = new Map();    // id d'offre → { mediane, rapport, haut, t }
  let echelles = lireEchelles();

  return {
    // Nouvelle ville : médianes et écart de chaque offre à la médiane de sa source.
    calculer(offres) {
      medianes = d3.rollup(offres, (v) => d3.median(v, (o) => o.prix_nuit_eur), (o) => o.source);
      ecarts = new Map();
      for (const o of offres) {
        const mediane = medianes.get(o.source);
        const rapport = o.prix_nuit_eur / mediane;
        ecarts.set(o.id, {
          mediane,
          rapport,
          haut: o.prix_nuit_eur >= mediane,
          t: Math.min(Math.abs(Math.log2(rapport)) / LOG_MAX, 1), // 0 à la médiane, 1 au plus loin
        });
      }
    },
    // Passage clair / sombre : les couleurs sont relues dans le thème.
    relireCouleurs() { echelles = lireEchelles(); },

    get medianes() { return medianes; },
    ecart: (o) => ecarts.get(o.id),
    couleur: (o) => echelles[o.source](ecarts.get(o.id).t),
    echelle: (source) => echelles[source],

    // « +35 % par rapport à la médiane des Airbnb (120 €) », pour l'infobulle.
    texteEcart(o) {
      const e = ecarts.get(o.id);
      const ecart = e.rapport - 1;
      if (Math.abs(ecart) < 0.005) return `Au prix médian des ${pluriel(o.source)} (${formatPrix(e.mediane)})`;
      return `${fPct(ecart)} par rapport à la médiane des ${pluriel(o.source)} (${formatPrix(e.mediane)})`;
    },
  };
}
