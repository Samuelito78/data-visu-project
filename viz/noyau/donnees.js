// Chargement des données préparées (data/processed/). Aucune transformation ici :
// la préparation est faite en Python, en amont (docs/workflow.md).

import { VILLES, SEUIL_COMPARABLE } from "./charte.js";

const d3 = window.d3;

// Chemin résolu depuis ce fichier (viz/noyau/) : marche quelle que soit la page qui l'importe,
// à condition que le serveur soit lancé à la racine du dépôt (scripts/serve.sh).
const DOSSIER = new URL("../../data/processed/", import.meta.url);

const cache = new Map();

// Lit une ligne de offres_<ville>.csv. d3.autoType convertit les nombres, `true`/`false`
// en booléens et les cellules vides en null. On force en texte les colonnes qui doivent le rester.
function lireLigne(ligne) {
  const o = d3.autoType(ligne);
  o.id = String(o.id);
  if (o.nom != null) o.nom = String(o.nom);
  if (o.quartier != null) o.quartier = String(o.quartier);
  return o;
}

// Nombre d'offres de chaque source par quartier, et zones où la comparaison a un sens (D16).
// Contient tous les quartiers du GeoJSON, même ceux sans aucune offre.
export function couvertureQuartiers(offres, quartiers) {
  const parQuartier = new Map(
    quartiers.features.map((f) => [f.properties.quartier, { quartier: f.properties.quartier, airbnb: 0, hotel: 0 }])
  );
  for (const o of offres) {
    const z = parQuartier.get(o.quartier);
    if (!z) continue; // 1 à 5 % des hôtels n'ont pas de quartier (docs/schema.md)
    if (o.source === "Hôtel") z.hotel += 1;
    else z.airbnb += 1;
  }
  for (const z of parQuartier.values()) {
    z.sansDonnees = z.airbnb === 0 && z.hotel === 0;
    z.comparable = z.airbnb >= SEUIL_COMPARABLE.airbnb && z.hotel >= SEUIL_COMPARABLE.hotel;
  }
  return parQuartier;
}

// Charge une ville : ses offres, les contours de ses quartiers et leur couverture.
// Le résultat est mis en cache : revenir sur une ville déjà vue est instantané.
export function chargerVille(id) {
  const ville = VILLES.find((v) => v.id === id);
  if (!ville) return Promise.reject(new Error(`Ville inconnue : ${id}`));
  if (!cache.has(id)) {
    const promesse = Promise.all([
      d3.csv(new URL(`offres_${id}.csv`, DOSSIER).href, lireLigne),
      d3.json(new URL(`quartiers_${id}.geojson`, DOSSIER).href),
    ]).then(([offres, quartiers]) => ({
      ville,
      offres,
      quartiers,
      couverture: couvertureQuartiers(offres, quartiers),
    }));
    promesse.catch(() => cache.delete(id)); // permettre de réessayer après une erreur réseau
    cache.set(id, promesse);
  }
  return cache.get(id);
}

// Les quatre villes en une seule table (pour une vue qui compare les villes, T7).
export async function chargerToutesLesVilles() {
  return d3.csv(new URL("offres.csv", DOSSIER).href, lireLigne);
}
