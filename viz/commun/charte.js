// Charte commune aux deux techniques : listes de valeurs, couleurs, formats, seuils.
// Une seule source de vérité : si une vue a besoin d'une couleur ou d'un libellé, elle le prend ici.

const d3 = window.d3;

// Les quatre villes, dans l'ordre du menu. `id` est le suffixe des fichiers de data/processed/.
export const VILLES = [
  { id: "paris", nom: "Paris" },
  { id: "berlin", nom: "Berlin" },
  { id: "londres", nom: "Londres" },
  { id: "rome", nom: "Rome" },
];

// Valeurs autorisées par src/prep/schema.py (docs/schema.md). Ordre = ordre d'affichage.
export const SOURCES = ["Hôtel", "Airbnb"];
export const TYPES = ["Hôtel", "Logement entier", "Chambre privée", "Chambre partagée"];
export const TRANCHES = ["0–1 km", "1–2 km", "2–4 km", "> 4 km"];
export const PERIODES = ["semaine", "weekend"];

// Couleur de la source : la variable principale de la comparaison.
// Les valeurs sont des variables CSS (viz/style.css) pour suivre le mode sombre :
// les appliquer avec .style("fill", …) ou .style("stroke", …), pas avec .attr().
// Paire bleu / orange vérifiée : contraste ≥ 3:1 et lisible par les daltoniens, en clair et en sombre.
export const COULEUR_SOURCE = {
  "Hôtel": "var(--couleur-hotel)",
  "Airbnb": "var(--couleur-airbnb)",
};
export const couleurSource = (source) => COULEUR_SOURCE[source] ?? "var(--texte-discret)";

// Classe CSS de la source (.hotel / .airbnb), pour les pastilles et légendes.
export const classeSource = (source) => (source === "Hôtel" ? "hotel" : "airbnb");

// Gris des quartiers sans données (utilisateurs_taches.md, section 5).
export const COULEUR_SANS_DONNEES = "var(--sans-donnees)";

// Une zone permet la comparaison si elle a au moins 30 Airbnb et 10 hôtels (D16).
export const SEUIL_COMPARABLE = { airbnb: 30, hotel: 10 };

// Plage du filtre de budget, identique pour toutes les villes pour pouvoir les comparer (T7).
// Le cran maximal signifie « sans limite » : il couvre au moins 99 % des offres hors hôtels de Rome.
export const BUDGET = { min: 30, max: 600, pas: 10 };

// Formats à la française.
const fr = d3.formatLocale({
  decimal: ",",
  thousands: " ",
  grouping: [3],
  currency: ["", " €"],
});
const fPrix = fr.format("$,.0f");
const fKm = fr.format(",.1f");
const fNote = fr.format(".0f");
const fEntier = fr.format(",d");

export const formatPrix = (v) => (v == null ? "—" : fPrix(v));
export const formatKm = (v) => (v == null ? "—" : `${fKm(v)} km`);
export const formatNote = (v) => (v == null ? "—" : `${fNote(v)}/100`);
export const formatEntier = (v) => (v == null ? "—" : fEntier(v));
export const formatEtoiles = (v) => (v == null ? "—" : "★".repeat(v));

// Libellé d'une offre : nom de l'hôtel, ou type pour une annonce Airbnb (qui n'a pas de nom).
export const libelleOffre = (o) => o.nom ?? `${o.type} (Airbnb)`;

// Échappe un texte avant de l'insérer en HTML (noms d'hôtels venant des données).
export function echapper(texte) {
  return String(texte ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}
