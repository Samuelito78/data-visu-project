// Technique 1 : carte des offres.
//
// Vue d'ensemble : chaque offre qui a une position est un triangle posé sur la carte des quartiers.
//   ▲ : prix au-dessus de la médiane de sa source dans la ville (médiane des hôtels pour un hôtel,
//       médiane des Airbnb pour un Airbnb) ;
//   ▼ : prix en dessous.
// La couleur donne l'éloignement à cette médiane : bleu de plus en plus foncé pour les hôtels,
// rouge de plus en plus foncé pour les Airbnb. Les quartiers ont un fond neutre, sans couleur,
// pour ne pas orienter la lecture par quartier.
// Plus on zoome, plus les triangles sont petits, jusqu'à une taille minimale qui reste cliquable.
// Point d'intérêt : un lieu choisi dans le panneau de droite (commun/points-interet.js), un repère
// « point perso » glissé depuis ce panneau et déposé sur la carte, ou un clic en mode point d'intérêt.
// Les offres autour du point sont comptées et, en mode point d'intérêt, seules elles sont dessinées.
// Détails : un clic sur un quartier (entre les triangles) zoome dessus ; à tout niveau de zoom, le survol
// d'une offre affiche son infobulle et un clic ouvre sa fiche et la surligne dans la technique 2
// (zoom sémantique, cours 2 p. 97-100).
//
// Données lues : etat.donnees.quartiers (contours), etat.donnees.offres (médianes de référence, sans filtre)
// et etat.offresFiltrees() (les triangles affichés).
// Les styles et les couleurs des triangles sont dans technique-1/carte.css, chargé par ce fichier.

import { SOURCES, classeSource, formatPrix, formatEntier, echapper } from "../commun/charte.js";
import { afficherInfobulle, masquerInfobulle, htmlInfobulleOffre } from "../commun/infobulle.js";
import { TYPE_DEPOT_POI } from "../commun/points-interet.js";

const d3 = window.d3;

const MARGE = 12;            // marge autour de la ville, en pixels
const HAUTEUR_MAX = 560;     // hauteur maximale de la carte
const ZOOM_MAX = 16;
const SEUIL_POINTS = 2;      // à partir de ce facteur de zoom, le résumé compte les offres visibles
const DUREE = 750;           // durée des transitions de zoom, en ms
const RAYON_SECOND_PAR_DEFAUT = 0.8;
const RAYON_LIEU_PAR_DEFAUT = 1; // rayon de départ, en km, d'un lieu choisi dans le panneau des points d'intérêt

// Triangles. La taille est une aire à l'écran, en px² : aire = AIRE_BASE × zoom^−EXPOSANT,
// sans descendre sous AIRE_MIN (environ 8 px de côté) pour que les offres restent faciles à cliquer.
const TRIANGLE = d3.symbol(d3.symbolTriangle, 100)(); // tracé d'aire 100, mis à l'échelle par transform
const AIRE_BASE = 46;        // environ 10 px de côté au zoom 1
const AIRE_MIN = 30;         // environ 8 px de côté
const EXPOSANT = 0.25;
const AGRANDI = 3.5;         // facteur d'aire de l'offre sélectionnée
const AGRANDI_SURVOL = 3;    // facteur de taille (côté) de l'offre survolée
const LOG_MAX = 1;           // écart log2 à partir duquel la couleur est la plus foncée : ×2 ou ÷2
const aire = (k) => Math.max(AIRE_MIN, AIRE_BASE * Math.pow(k, -EXPOSANT));

const fPct = d3.formatLocale({ decimal: ",", thousands: " ", grouping: [3], currency: ["", " €"] }).format("+.0%");
const pluriel = (source) => (source === "Hôtel" ? "hôtels" : "Airbnb");

// Étiquette courte d'un quartier : « 11e » pour Paris, « XIII » pour Rome, le nom complet ailleurs.
function etiquette(nom) {
  if (nom.endsWith(" arrondissement")) return nom.split(" ")[0];
  if (nom.startsWith("Municipio ")) return nom.slice("Municipio ".length);
  return nom;
}

// Lit une variable CSS du thème courant : une échelle D3 a besoin d'une vraie couleur, pas de var(--…).
function lireCouleur(nom) {
  return getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
}

// Charge carte.css une seule fois, sans toucher à index.html (fichier commun).
function chargerStyle() {
  const href = new URL("carte.css", import.meta.url).href;
  if (document.querySelector(`link[href="${href}"]`)) return;
  const lien = document.createElement("link");
  lien.rel = "stylesheet";
  lien.href = href;
  document.head.append(lien);
}

// Médiane de chaque source sur toute la ville (sans filtre), puis l'écart de chaque offre à celle de sa source.
// Les hôtels sans position comptent dans la médiane, même s'ils n'ont pas de triangle.
function calculerEcarts(offres) {
  const medianes = d3.rollup(offres, (v) => d3.median(v, (o) => o.prix_nuit_eur), (o) => o.source);
  const ecarts = new Map();
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
  return { medianes, ecarts };
}

// Une échelle par source, de la couleur claire (à la médiane) à la plus foncée, lue dans le thème courant.
function creerEchelles() {
  const piste = (s) => d3.piecewise(d3.interpolateLab, ["mediane", "moyen", "loin"].map((n) => lireCouleur(`--t1-${s}-${n}`)));
  return { "Hôtel": piste("hotel"), "Airbnb": piste("airbnb") };
}

function distanceKm([lon1, lat1], [lon2, lat2]) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function capInitial([lon1, lat1], [lon2, lat2]) {
  const rad = Math.PI / 180;
  const y = Math.sin((lon2 - lon1) * rad) * Math.cos(lat2 * rad);
  const x = Math.cos(lat1 * rad) * Math.sin(lat2 * rad)
    - Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos((lon2 - lon1) * rad);
  return Math.atan2(y, x);
}

function destination([lon, lat], distance, cap) {
  const R = 6371;
  const rad = Math.PI / 180;
  const d = distance / R;
  const phi1 = lat * rad;
  const lambda1 = lon * rad;
  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(d) + Math.cos(phi1) * Math.sin(d) * Math.cos(cap)
  );
  const lambda2 = lambda1 + Math.atan2(
    Math.sin(cap) * Math.sin(d) * Math.cos(phi1),
    Math.cos(d) - Math.sin(phi1) * Math.sin(phi2)
  );
  return [((lambda2 * 180 / Math.PI + 540) % 360) - 180, phi2 * 180 / Math.PI];
}

function formatKmCourt(v) {
  return `${d3.format(",.1f")(v).replace(".", ",")} km`;
}

export function creerVue(conteneur, etat) {
  chargerStyle();
  const racine = d3.select(conteneur);

  // En-tête : phrase d'explication (ou résumé du quartier zoomé) et bouton de retour.
  const entete = racine.append("div").attr("class", "t1-entete");
  const resume = entete.append("p").attr("class", "t1-resume").attr("aria-live", "polite");
  const controlesPoi = entete.append("div").attr("class", "t1-poi-controles");
  const boutonPoi = controlesPoi.append("button").attr("type", "button").attr("class", "t1-poi-bouton")
    .attr("aria-pressed", "false")
    .text("Mode point d'intérêt : désactivé");
  const boutonEffacerPoi = controlesPoi.append("button").attr("type", "button")
    .attr("class", "t1-poi-effacer").text("Effacer le point").property("disabled", true);
  const boutonRetour = entete.append("button").attr("type", "button").attr("class", "t1-retour")
    .text("← Vue d'ensemble").property("hidden", true)
    .on("click", () => dezoomer());

  // La carte : un groupe `carte` qui reçoit la transformation du zoom (les contours),
  // puis les triangles et les étiquettes, placés à la main pour contrôler leur taille à l'écran.
  const cadre = racine.append("div").attr("class", "t1-cadre");
  const svg = cadre.append("svg").attr("class", "t1-carte")
    .attr("role", "img")
    .attr("aria-label", "Carte des offres : chaque triangle indique si l'offre est plus ou moins chère que la médiane des hôtels ou des Airbnb");
  const carte = svg.append("g");
  const gQuartiers = carte.append("g").attr("class", "t1-quartiers");
  const gPoints = svg.append("g").attr("class", "t1-points");
  const gEtiquettes = svg.append("g").attr("class", "t1-etiquettes");
  const gPoi = svg.append("g").attr("class", "t1-poi").style("display", "none");
  gPoi.append("circle").attr("class", "t1-poi-halo").attr("r", 0);
  gPoi.append("circle").attr("class", "t1-poi-marqueur").attr("r", 5);
  gPoi.append("circle").attr("class", "t1-poi-halo-secondaire").style("display", "none").attr("r", 0);
  gPoi.append("circle").attr("class", "t1-poi-centre-secondaire").style("display", "none").attr("r", 4);

  // Encart du point d'intérêt, posé sur la carte (position absolue) : son texte change à chaque mouvement
  // de souris pendant le tracé des cercles. Dans l'en-tête, il changeait la hauteur de la page et décalait
  // la carte sous le curseur, ce qui changeait le rayon, donc le texte : la page tremblait.
  const bandeauPoi = cadre.append("div").attr("class", "t1-poi-bandeau").attr("aria-live", "polite")
    .property("hidden", true);
  const infoPoi = bandeauPoi.append("span").attr("class", "t1-poi-info");
  const comptePoi = bandeauPoi.append("span").attr("class", "t1-poi-compte");

  const legende = racine.append("div").attr("class", "t1-legende");

  const projection = d3.geoMercator();
  const chemin = d3.geoPath(projection);
  let largeur = 0;
  let hauteur = 0;
  let largeurPrecedente = 0;   // pour ne recaler que si la largeur change
  let quartierZoome = null;    // nom du quartier sur lequel on a cliqué, ou null
  let medianes = new Map();    // source → prix médian dans la ville
  let ecarts = new Map();      // id d'offre → { mediane, rapport, haut, t } (calculerEcarts)
  let echelles = creerEchelles();
  let positions = new Map();   // id d'offre → [x, y] projetés (sans zoom)
  let centres = new Map();     // quartier → [x, y] du centre de l'étiquette
  let tailles = new Map();     // quartier → [largeur, hauteur] du contour, en pixels sans zoom
  const longueurs = new Map(); // quartier → longueur de son étiquette, en pixels
  let transformDebut = null;   // transformation au début d'un geste de zoom
  let modePoi = false;
  let poiGeo = null;           // [lon, lat]
  let rayonPoiKm = null;
  let rayonPoiPx = 0;
  let rayonPoiFige = false;
  let poiSecondaireGeo = null;
  let rayonPoiSecondaireKm = null;
  let rayonPoiSecondairePx = 0;
  let rayonPoiSecondaireFige = false;
  let idsProchesPoi = new Set();
  let resumePoi = null;

  const couleurOffre = (o) => echelles[o.source](ecarts.get(o.id).t);

  const zoom = d3.zoom()
    .scaleExtent([1, ZOOM_MAX])
    .clickDistance(4)        // un petit glissement ne compte pas comme un déplacement
    // Molette et pincement zooment ; glisser avec le bouton gauche déplace (les autres boutons sont ignorés).
    .filter((e) => !e.button)
    .on("start", ({ transform }) => { transformDebut = transform; })
    .on("zoom", ({ transform }) => placer(transform))
    .on("end", ({ transform }) => {
      // Simple clic (la vue n'a pas bougé) : ne rien redessiner. d3.zoom émet « end » au relâchement,
      // juste avant l'événement click ; redessiner ici réordonne les éléments (join, raise) et le navigateur
      // envoie alors le clic au groupe parent au lieu de l'offre ou du quartier cliqué.
      const t0 = transformDebut;
      if (t0 && t0.k === transform.k && t0.x === transform.x && t0.y === transform.y) return;
      if (transform.k <= 1.01) quartierZoome = null;
      dessinerPoints();
    });
  svg.call(zoom).on("dblclick.zoom", null);

  let repereDeplace = false;   // le repère a-t-il bougé pendant le geste (un simple clic ne compte pas)
  const dragPoi = d3.drag()
    .on("start", (e) => { e.sourceEvent.stopPropagation(); repereDeplace = false; })
    .on("end", () => { if (repereDeplace) signalerPoiPerso(); })
    .on("drag", (e) => {
      repereDeplace = true;
      const t = d3.zoomTransform(svg.node());
      const [xCarte, yCarte] = t.invert([e.x, e.y]);
      const geo = projection.invert([xCarte, yCarte]);
      if (!geo) return;
      poiGeo = geo;
      rayonPoiKm = 0;
      rayonPoiPx = 0;
      rayonPoiFige = false;
      poiSecondaireGeo = null;
      rayonPoiSecondaireKm = null;
      rayonPoiSecondairePx = 0;
      rayonPoiSecondaireFige = false;
      mettreAJourPoi();
    });
  gPoi.call(dragPoi);

  function calculerRayonPixels(centreGeo, rayonKm) {
    if (!centreGeo || rayonKm == null || rayonKm <= 0) return 0;
    const p0 = projection(centreGeo);
    const p1 = projection(destination(centreGeo, rayonKm, Math.PI / 2));
    if (!p0 || !p1) return 0;
    const t = d3.zoomTransform(svg.node());
    const a = t.apply(p0);
    const b = t.apply(p1);
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  }

  function synchroniserControlesPoi() {
    boutonPoi.attr("aria-pressed", modePoi ? "true" : "false")
      .text(`Mode point d'intérêt : ${modePoi ? "activé" : "désactivé"}`);
    boutonEffacerPoi.property("disabled", !poiGeo);
    svg.classed("t1-mode-poi", modePoi);
    ecrireBandeauPoi();
  }

  // Encart sur la carte : l'étape du tracé, puis le nombre d'offres dans le cercle de recherche.
  function ecrireBandeauPoi() {
    bandeauPoi.property("hidden", !modePoi && !resumePoi);
    infoPoi.text(!modePoi ? ""
      : !poiGeo ? "Cliquez sur la carte, choisissez un lieu ou glissez le point perso."
        : !rayonPoiFige
          ? (rayonPoiKm == null || rayonPoiKm <= 0
            ? "Déplacez la souris puis cliquez pour figer le 1er rayon."
            : `1er rayon : ${formatKmCourt(rayonPoiKm)} (cliquez pour figer)`)
          : (!rayonPoiSecondaireFige
            ? `1er rayon : ${formatKmCourt(rayonPoiKm)} · 2e rayon : ${formatKmCourt(rayonPoiSecondaireKm ?? 0)} (cliquez pour figer le 2e cercle)`
            : `2e cercle figé (${formatKmCourt(rayonPoiSecondaireKm)}). Cliquez sur la carte pour le reprendre.`));
    comptePoi.text(!resumePoi ? ""
      : `${resumePoi.secondaire ? "2e cercle" : "Point d'intérêt"} (${formatKmCourt(resumePoi.rayon)}) : `
        + `${formatEntier(resumePoi.total)} offre(s) proche(s) `
        + `(${formatEntier(resumePoi.hotel)} hôtels, ${formatEntier(resumePoi.airbnb)} Airbnb).`);
  }

  function placerPoi() {
    if (!poiGeo) {
      gPoi.style("display", "none");
      return;
    }
    const proj = projection(poiGeo);
    if (!proj) {
      gPoi.style("display", "none");
      return;
    }
    const [x, y] = d3.zoomTransform(svg.node()).apply(proj);
    rayonPoiPx = calculerRayonPixels(poiGeo, rayonPoiKm);
    rayonPoiSecondairePx = calculerRayonPixels(poiSecondaireGeo, rayonPoiSecondaireKm);
    gPoi.style("display", null).attr("transform", `translate(${x},${y})`);
    gPoi.select(".t1-poi-halo").attr("r", rayonPoiPx);
    if (poiSecondaireGeo && rayonPoiFige) {
      const projSecondaire = projection(poiSecondaireGeo);
      if (projSecondaire) {
        const [x2, y2] = d3.zoomTransform(svg.node()).apply(projSecondaire);
        gPoi.select(".t1-poi-halo-secondaire")
          .style("display", null)
          .attr("cx", x2 - x)
          .attr("cy", y2 - y)
          .attr("r", rayonPoiSecondairePx);
        gPoi.select(".t1-poi-centre-secondaire")
          .style("display", null)
          .attr("cx", x2 - x)
          .attr("cy", y2 - y);
      } else {
        gPoi.select(".t1-poi-halo-secondaire").style("display", "none");
        gPoi.select(".t1-poi-centre-secondaire").style("display", "none");
      }
    } else {
      gPoi.select(".t1-poi-halo-secondaire").style("display", "none");
      gPoi.select(".t1-poi-centre-secondaire").style("display", "none");
    }
  }

  function definirPoiDepuisEcran([x, y]) {
    const t = d3.zoomTransform(svg.node());
    const [xCarte, yCarte] = t.invert([x, y]);
    const geo = projection.invert([xCarte, yCarte]);
    if (!geo) return;
    poiGeo = geo;
    rayonPoiKm = 0;
    rayonPoiPx = 0;
    rayonPoiFige = false;
    poiSecondaireGeo = null;
    rayonPoiSecondaireKm = null;
    rayonPoiSecondairePx = 0;
    rayonPoiSecondaireFige = false;
    mettreAJourPoi();
  }

  function mettrePremierRayonDepuisEcran([x, y]) {
    if (!poiGeo) return;
    const t = d3.zoomTransform(svg.node());
    const [xCarte, yCarte] = t.invert([x, y]);
    const geoSouris = projection.invert([xCarte, yCarte]);
    rayonPoiKm = geoSouris ? distanceKm(poiGeo, geoSouris) : null;
  }

  function mettreSecondRayonDepuisEcran([x, y]) {
    if (!poiGeo || !rayonPoiFige || rayonPoiKm == null) return;
    const t = d3.zoomTransform(svg.node());
    const [xCarte, yCarte] = t.invert([x, y]);
    const geoSouris = projection.invert([xCarte, yCarte]);
    if (!geoSouris) return;
    const cap = capInitial(poiGeo, geoSouris);
    poiSecondaireGeo = destination(poiGeo, rayonPoiKm, cap);
    if (!rayonPoiSecondaireFige) rayonPoiSecondaireKm = distanceKm(poiSecondaireGeo, geoSouris);
  }

  function initialiserSecondCercle([x, y]) {
    if (!poiGeo || rayonPoiKm == null || rayonPoiKm <= 0) return;
    const t = d3.zoomTransform(svg.node());
    const [xCarte, yCarte] = t.invert([x, y]);
    const geoSouris = projection.invert([xCarte, yCarte]);
    const cap = geoSouris ? capInitial(poiGeo, geoSouris) : 0;
    poiSecondaireGeo = destination(poiGeo, rayonPoiKm, cap);
    rayonPoiSecondaireKm = Math.max(0.2, Math.min(RAYON_SECOND_PAR_DEFAUT, rayonPoiKm));
    rayonPoiSecondaireFige = false;
  }

  function mettreAJourPoi() {
    placerPoi();
    dessinerPoints();
    synchroniserControlesPoi();
  }

  // Un point posé ou déplacé sur la carte devient le point perso de l'état (le panneau le signale).
  // L'état renvoie l'événement « poi » : surPoi voit que c'est déjà le point affiché et ne fait rien.
  function signalerPoiPerso() {
    if (!poiGeo) return;
    etat.choisirPoi({ id: "perso", nom: "Point perso", lon: poiGeo[0], lat: poiGeo[1], perso: true });
  }

  function gererClicPoi(e) {
    if (!modePoi) return false;
    const pointeur = d3.pointer(e, svg.node());
    if (!poiGeo) {
      definirPoiDepuisEcran(pointeur);
      signalerPoiPerso();
    } else if (!rayonPoiFige) {
      mettrePremierRayonDepuisEcran(pointeur);
      rayonPoiFige = true;
      initialiserSecondCercle(pointeur);
    } else if (!rayonPoiSecondaireFige) {
      mettreSecondRayonDepuisEcran(pointeur);
      rayonPoiSecondaireFige = true;
    } else {
      // 2e cercle figé : un clic le reprend, il suit de nouveau la souris.
      rayonPoiSecondaireFige = false;
      mettreSecondRayonDepuisEcran(pointeur);
    }
    mettreAJourPoi();
    return true;
  }

  // Remet le point d'intérêt et ses deux cercles à zéro (bouton « Effacer », changement de ville).
  function effacerPoi() {
    poiGeo = null;
    rayonPoiKm = null;
    rayonPoiPx = 0;
    rayonPoiFige = false;
    poiSecondaireGeo = null;
    rayonPoiSecondaireKm = null;
    rayonPoiSecondairePx = 0;
    rayonPoiSecondaireFige = false;
    idsProchesPoi = new Set();
    resumePoi = null;
  }

  boutonPoi.on("click", () => {
    modePoi = !modePoi;
    synchroniserControlesPoi();
  });
  boutonEffacerPoi.on("click", () => {
    effacerPoi();
    mettreAJourPoi();
    etat.choisirPoi(null);
  });

  // Lieu choisi dans le panneau (ou point effacé) : le point est placé avec un rayon de départ,
  // le mode point d'intérêt s'active et, si le lieu est hors de l'écran, la carte revient à la vue d'ensemble.
  function surPoi() {
    const p = etat.poi;
    if (!p) {
      if (poiGeo) { effacerPoi(); mettreAJourPoi(); }
      return;
    }
    if (poiGeo && poiGeo[0] === p.lon && poiGeo[1] === p.lat) return; // déjà affiché (posé sur la carte)
    effacerPoi();
    poiGeo = [p.lon, p.lat];
    rayonPoiKm = p.perso ? 0 : RAYON_LIEU_PAR_DEFAUT;
    modePoi = true;
    const proj = projection(poiGeo);
    const [x, y] = proj ? d3.zoomTransform(svg.node()).apply(proj) : [-1, -1];
    if (x < 0 || x > largeur || y < 0 || y > hauteur) dezoomer();
    mettreAJourPoi();
  }

  // Dépôt du repère « point perso » glissé depuis le panneau : seule la carte l'accepte.
  const estDepotPoi = (e) => e.dataTransfer && [...e.dataTransfer.types].includes(TYPE_DEPOT_POI);
  svg.on("dragover", (e) => {
    if (!estDepotPoi(e)) return;
    e.preventDefault();      // autorise le dépôt ici, et seulement ici
    e.dataTransfer.dropEffect = "copy";
    svg.classed("t1-cible-depot", true);
  })
    .on("dragleave", (e) => {
      if (!svg.node().contains(e.relatedTarget)) svg.classed("t1-cible-depot", false);
    })
    .on("drop", (e) => {
      if (!estDepotPoi(e)) return;
      e.preventDefault();
      svg.classed("t1-cible-depot", false);
      document.body.classList.remove("poi-en-glisse");
      modePoi = true;
      definirPoiDepuisEcran(d3.pointer(e, svg.node()));
      signalerPoiPerso();
    });
  synchroniserControlesPoi();

  // Clic dans le vide (hors des quartiers) : retour à la vue d'ensemble.
  svg.on("click", (e) => {
    if (gererClicPoi(e)) return;
    if (quartierZoome || d3.zoomTransform(svg.node()).k > 1) dezoomer();
  });
  let pointeurEnAttente = null; // dernière position de la souris, dessinée à la prochaine image
  svg.on("pointermove", (e) => {
    if (!modePoi || !poiGeo || rayonPoiSecondaireFige) return;
    const dejaPrevu = pointeurEnAttente != null;
    pointeurEnAttente = d3.pointer(e, svg.node());
    if (dejaPrevu) return;
    requestAnimationFrame(() => {
      const pointeur = pointeurEnAttente;
      pointeurEnAttente = null;
      if (!modePoi || !poiGeo || rayonPoiSecondaireFige) return;
      if (!rayonPoiFige) mettrePremierRayonDepuisEcran(pointeur);
      else mettreSecondRayonDepuisEcran(pointeur);
      mettreAJourPoi();
    });
  });

  // Cale la projection sur la ville : la largeur vient du conteneur, la hauteur de la forme de la ville.
  function caler() {
    const geo = etat.donnees.quartiers;
    largeur = conteneur.clientWidth || 640;
    largeurPrecedente = conteneur.clientWidth;
    projection.fitWidth(largeur - 2 * MARGE, geo);
    const [[, y0], [, y1]] = chemin.bounds(geo);
    hauteur = Math.min(Math.ceil(y1 - y0) + 2 * MARGE, HAUTEUR_MAX);
    projection.fitExtent([[MARGE, MARGE], [largeur - MARGE, hauteur - MARGE]], geo);

    svg.attr("viewBox", [0, 0, largeur, hauteur]).attr("width", largeur).attr("height", hauteur);
    zoom.extent([[0, 0], [largeur, hauteur]]).translateExtent([[0, 0], [largeur, hauteur]]);

    positions = new Map();
    for (const o of etat.donnees.offres) {
      if (o.lat != null && o.lon != null) positions.set(o.id, projection([o.lon, o.lat])); // longitude d'abord
    }
    centres = new Map();
    tailles = new Map();
    for (const f of geo.features) {
      const [[x0, y0b], [x1, y1b]] = chemin.bounds(f);
      centres.set(f.properties.quartier, chemin.centroid(f));
      tailles.set(f.properties.quartier, [x1 - x0, y1b - y0b]);
    }
  }

  // Petit triangle de la couleur de l'offre, pour l'infobulle.
  function pastilleTriangle(o) {
    const e = ecarts.get(o.id);
    return `<svg class="t1-pastille-triangle" width="12" height="12" viewBox="-6 -6 12 12" aria-hidden="true">` +
      `<path d="${TRIANGLE}" transform="scale(0.75)${e.haut ? "" : " rotate(180)"}" style="fill:${couleurOffre(o)}"></path></svg>`;
  }

  function texteEcart(o) {
    const e = ecarts.get(o.id);
    const ecart = e.rapport - 1;
    if (Math.abs(ecart) < 0.005) return `Au prix médian des ${pluriel(o.source)} (${formatPrix(e.mediane)})`;
    return `${fPct(ecart)} par rapport à la médiane des ${pluriel(o.source)} (${formatPrix(e.mediane)})`;
  }

  const htmlOffre = (o) => `${htmlInfobulleOffre(o)}<br>${pastilleTriangle(o)}<strong>${texteEcart(o)}</strong>`;

  // Nombre de triangles vers le haut et vers le bas d'un quartier, par source cochée.
  function compterQuartier(nom) {
    const liste = etat.offresFiltrees().filter((o) => o.quartier === nom);
    return SOURCES.filter((s) => etat.filtres.sources.has(s)).map((s) => {
      const l = liste.filter((o) => o.source === s);
      const haut = l.filter((o) => ecarts.get(o.id).haut).length;
      return { source: s, nombre: l.length, haut, bas: l.length - haut };
    });
  }

  function htmlQuartier(nom) {
    const lignes = [`<strong>${echapper(nom)}</strong>`];
    for (const c of compterQuartier(nom)) {
      lignes.push(
        `<span class="pastille ${classeSource(c.source)}"></span>${pluriel(c.source)} : ${formatEntier(c.nombre)}` +
        (c.nombre > 0 ? ` · ${formatEntier(c.haut)} ▲ ${formatEntier(c.bas)} ▼` : "")
      );
    }
    if (nom !== quartierZoome) lignes.push("Cliquez pour zoomer sur le quartier.");
    return lignes.join("<br>");
  }

  // Contours et étiquettes : ne changent qu'avec la ville ou la taille.
  function dessinerContours() {
    gQuartiers.selectAll("path")
      .data(etat.donnees.quartiers.features, (f) => f.properties.quartier)
      .join("path")
      .attr("d", chemin)
      .on("pointerenter", function (e, f) {
        d3.select(this).raise();
        afficherInfobulle(e, htmlQuartier(f.properties.quartier));
      })
      .on("pointermove", (e, f) => afficherInfobulle(e, htmlQuartier(f.properties.quartier)))
      .on("pointerleave", () => masquerInfobulle())
      .on("click", (e, f) => {
        e.stopPropagation();
        if (gererClicPoi(e)) return;
        // Clic sur le quartier déjà zoomé : on reste (c'est là qu'on vise les triangles).
        if (f.properties.quartier !== quartierZoome) zoomerSur(f);
      });

    gEtiquettes.selectAll("text")
      .data(etat.donnees.quartiers.features, (f) => f.properties.quartier)
      .join("text")
      .text((f) => etiquette(f.properties.quartier))
      .each(function (f) {
        // Longueur réelle du texte : sert à n'afficher que les étiquettes qui tiennent dans leur quartier.
        // Un texte masqué mesure 0 : on le réaffiche le temps de la mesure.
        this.removeAttribute("display");
        longueurs.set(f.properties.quartier, this.getComputedTextLength());
      });
  }

  // Position, taille (qui dépend du zoom) et sens du triangle, en une seule transformation.
  function transformOffre(o, t) {
    const [x, y] = t.apply(positions.get(o.id));
    const a = aire(t.k) * (o === etat.selection ? AGRANDI : 1);
    const s = Math.sqrt(a / 100) * (o === etat.survol ? AGRANDI_SURVOL : 1);
    return `translate(${x},${y}) scale(${s})${ecarts.get(o.id).haut ? "" : " rotate(180)"}`;
  }

  // Applique la transformation du zoom : le groupe des contours bouge,
  // les triangles et les étiquettes sont replacés (et les triangles redimensionnés).
  function placer(t) {
    carte.attr("transform", t);
    gPoints.selectAll("path").attr("transform", (o) => transformOffre(o, t));
    placerEtiquettes(t);
    placerPoi();
  }

  // Une étiquette n'est affichée que si elle tient dans son quartier et ne chevauche pas une autre.
  // Les grands quartiers passent en premier : en cas de conflit, c'est le petit qui perd son étiquette.
  function placerEtiquettes(t) {
    const placees = [];  // rectangles [x0, y0, x1, y1] des étiquettes déjà affichées
    const visibles = new Set();
    const parTaille = [...tailles.entries()].sort((a, b) => d3.descending(a[1][0] * a[1][1], b[1][0] * b[1][1]));
    for (const [nom, [l, h]] of parTaille) {
      const w = longueurs.get(nom) ?? 0;
      if (l * t.k * 0.75 < w + 4 || h * t.k < 18) continue;
      const [x, y] = t.apply(centres.get(nom));
      const r = [x - w / 2 - 3, y - 8, x + w / 2 + 3, y + 8];
      if (placees.some((p) => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1])) continue;
      placees.push(r);
      visibles.add(nom);
    }
    gEtiquettes.selectAll("text")
      .attr("transform", (f) => `translate(${t.apply(centres.get(f.properties.quartier))})`)
      .attr("display", (f) => (visibles.has(f.properties.quartier) && f.properties.quartier !== quartierZoome ? null : "none"));
  }

  // Les offres visibles à l'écran, dès la vue d'ensemble. Ordre de dessin : Airbnb puis hôtels,
  // et dans chaque source les plus proches de la médiane d'abord (les écarts forts restent au-dessus).
  // Les hôtels sans coordonnées (environ 30 %, D19) comptent dans la médiane mais n'ont pas de triangle.
  function dessinerPoints() {
    if (!etat.donnees) return;
    const t = d3.zoomTransform(svg.node());
    const toutes = etat.offresFiltrees();

    // Point d'intérêt : les offres (avec position) dans le cercle de recherche.
    idsProchesPoi = new Set();
    resumePoi = null;
    const centreRecherche = modePoi ? poiSecondaireGeo : (rayonPoiFige ? poiSecondaireGeo : poiGeo);
    const rayonRecherche = modePoi ? rayonPoiSecondaireKm : (rayonPoiFige ? rayonPoiSecondaireKm : rayonPoiKm);
    const rechercheActive = centreRecherche != null && rayonRecherche != null && rayonRecherche > 0;
    if (rechercheActive) {
      const proches = toutes.filter((o) => positions.has(o.id)
        && distanceKm(centreRecherche, [o.lon, o.lat]) <= rayonRecherche);
      idsProchesPoi = new Set(proches.map((o) => o.id));
      const comptes = d3.rollup(proches, (v) => v.length, (o) => o.source);
      resumePoi = {
        total: idsProchesPoi.size,
        hotel: comptes.get("Hôtel") ?? 0,
        airbnb: comptes.get("Airbnb") ?? 0,
        rayon: rayonRecherche,
        secondaire: rayonPoiFige,
      };
    }

    // Affichage ciblé : en mode point d'intérêt, ou en vue d'ensemble avec un cercle, seules les offres
    // du cercle sont dessinées. Sinon, toutes les offres visibles à l'écran.
    const zoome = quartierZoome != null || t.k >= SEUIL_POINTS;
    let offres;
    if (modePoi || (rechercheActive && !zoome)) {
      offres = toutes.filter((o) => idsProchesPoi.has(o.id));
    } else {
      const [x0, y0] = t.invert([0, 0]);
      const [x1, y1] = t.invert([largeur, hauteur]);
      offres = toutes.filter((o) => {
        const p = positions.get(o.id);
        return p && p[0] >= x0 - 5 && p[0] <= x1 + 5 && p[1] >= y0 - 5 && p[1] <= y1 + 5;
      });
    }
    offres.sort((a, b) => d3.ascending(a.source === "Hôtel", b.source === "Hôtel")
      || d3.ascending(ecarts.get(a.id).t, ecarts.get(b.id).t));

    gPoints.selectAll("path")
      .data(offres, (o) => o.id)
      .join("path")
      .attr("d", TRIANGLE)
      .attr("transform", (o) => transformOffre(o, t))
      .style("fill", couleurOffre)
      .classed("t1-proche-poi", (o) => poiGeo != null && idsProchesPoi.has(o.id))
      .on("pointerenter", (e, o) => { etat.survoler(o); afficherInfobulle(e, htmlOffre(o)); })
      .on("pointermove", (e, o) => afficherInfobulle(e, htmlOffre(o)))
      .on("pointerleave", () => { etat.survoler(null); masquerInfobulle(); })
      .on("click", (e, o) => {
        e.stopPropagation();
        if (!(modePoi && rayonPoiSecondaireFige) && gererClicPoi(e)) return;
        etat.selectionner(o);
      })
      .order();

    // Les triangles captent le survol et le clic à tous les niveaux de zoom ; le quartier ne reçoit
    // que ce qui tombe entre les triangles.
    gQuartiers.selectAll("path")
      .classed("t1-zoome", (f) => f.properties.quartier === quartierZoome)
      .classed("t1-estompe", (f) => quartierZoome != null && f.properties.quartier !== quartierZoome);
    boutonRetour.property("hidden", !(quartierZoome || t.k > 1));
    placerEtiquettes(t);
    ecrireResume(offres.length, t);
    surligner();
  }

  function ecrireResume(nbPoints, t) {
    resume.selectAll("*").remove();
    resume.text("");
    if (quartierZoome) {
      resume.append("strong").text(`${quartierZoome} : `);
      const morceaux = compterQuartier(quartierZoome)
        .map((c) => `${formatEntier(c.nombre)} ${c.nombre > 1 ? pluriel(c.source) : c.source === "Hôtel" ? "hôtel" : "Airbnb"} (${formatEntier(c.haut)} ▲, ${formatEntier(c.bas)} ▼)`);
      const sansPosition = etat.offresFiltrees()
        .filter((o) => o.quartier === quartierZoome && !positions.has(o.id)).length;
      resume.append("span").text(
        (morceaux.join(" et ") || "aucune offre") +
        (sansPosition > 0 ? `, dont ${formatEntier(sansPosition)} hôtel(s) sans position, absent(s) de la carte` : "") +
        ". Cliquez sur une offre pour afficher sa fiche."
      );
    } else if (modePoi) {
      // Le nombre d'offres du cercle est dans l'encart sur la carte (ecrireBandeauPoi).
      resume.text("Mode point d'intérêt : seules les offres du cercle de recherche sont affichées.");
    } else if (t.k >= SEUIL_POINTS) {
      resume.text(`${formatEntier(nbPoints)} offres visibles. Cliquez sur une offre pour afficher sa fiche.`);
    } else {
      resume.text("Chaque triangle est une offre, comparée au prix médian des hôtels ou des Airbnb de la ville. Survolez un triangle pour voir l'offre, cliquez entre les triangles pour zoomer sur un quartier.");
    }
    ecrireBandeauPoi();
  }

  function dessinerLegende() {
    legende.selectAll("*").remove();

    // Sens du triangle.
    const sens = legende.append("div").attr("class", "t1-legende-bloc");
    sens.append("span").attr("class", "t1-legende-titre").text("Prix par rapport à la médiane (hôtels ou Airbnb)");
    for (const [haut, texte] of [[true, "Plus cher que la médiane"], [false, "Moins cher que la médiane"]]) {
      const item = sens.append("span").attr("class", "t1-legende-item");
      item.append("svg").attr("width", 14).attr("height", 14).attr("viewBox", [-7, -7, 14, 14])
        .append("path").attr("d", TRIANGLE).attr("transform", `scale(0.85)${haut ? "" : " rotate(180)"}`)
        .style("fill", "var(--texte-secondaire)");
      item.append("span").text(texte);
    }
    sens.append("span").attr("class", "t1-legende-note").text("La taille diminue quand on zoome, pour séparer les offres proches.");

    // Éloignement de la médiane : une barre par source.
    const couleur = legende.append("div").attr("class", "t1-legende-bloc");
    couleur.append("span").attr("class", "t1-legende-titre").text("Éloignement de la médiane");
    const L = 200;
    const H = 10;
    for (const s of SOURCES) {
      const avecAxe = s === SOURCES[SOURCES.length - 1];
      const ligne = couleur.append("div").attr("class", "t1-legende-barre");
      ligne.append("span").text(s === "Hôtel" ? "Hôtels" : "Airbnb");
      const hBarre = avecAxe ? H + 18 : H + 2;
      const g = ligne.append("svg").attr("width", L + 30).attr("height", hBarre).attr("viewBox", [0, 0, L + 30, hBarre]);
      const id = `t1-degrade-${classeSource(s)}`;
      g.append("defs").append("linearGradient").attr("id", id)
        .selectAll("stop").data(d3.range(11)).join("stop")
        .attr("offset", (i) => i / 10)
        .attr("stop-color", (i) => echelles[s](i / 10));
      g.append("rect").attr("x", 10).attr("y", 1).attr("width", L).attr("height", H).attr("rx", 2).attr("fill", `url(#${id})`);
      if (avecAxe) {
        const x = d3.scaleLinear([0, 1], [10, 10 + L]);
        g.append("g").attr("class", "axe").attr("transform", `translate(0,${H + 1})`)
          .call(d3.axisBottom(x).tickValues([0, 0.5, 1]).tickSize(4)
            .tickFormat((v) => (v === 0 ? "médiane" : v === 0.5 ? "×1,4 ou ÷1,4" : "×2 ou ÷2 et +")))
          .call((a) => a.select(".domain").remove());
      }
    }

    // Médianes de référence.
    const ref = legende.append("div").attr("class", "t1-legende-bloc");
    ref.append("span").attr("class", "t1-legende-titre").text(`Médianes de référence à ${etat.ville.nom}`);
    const dl = ref.append("dl").attr("class", "t1-medianes");
    for (const s of SOURCES) {
      if (!medianes.has(s)) continue;
      dl.append("dt").text(s === "Hôtel" ? "Hôtels" : "Airbnb");
      dl.append("dd").text(`${formatPrix(medianes.get(s))} / nuit`);
    }
    ref.append("span").attr("class", "t1-legende-note")
      .text("Toutes les offres de la ville, sans filtre. Environ 30 % des hôtels n'ont pas de position : ils comptent dans la médiane, sans triangle.");
  }

  // Zoom sur un quartier : son rectangle occupe 90 % de la vue (modèle « Zoom to bounding box »).
  function zoomerSur(f, duree = DUREE) {
    quartierZoome = f.properties.quartier;
    masquerInfobulle();
    const [[x0, y0], [x1, y1]] = chemin.bounds(f);
    const k = Math.min(ZOOM_MAX, 0.9 / Math.max((x1 - x0) / largeur, (y1 - y0) / hauteur));
    const cible = d3.zoomIdentity
      .translate(largeur / 2, hauteur / 2)
      .scale(k)
      .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    if (duree > 0) svg.transition().duration(duree).call(zoom.transform, cible);
    else svg.call(zoom.transform, cible);
  }

  function dezoomer(duree = DUREE) {
    quartierZoome = null;
    if (duree > 0) svg.transition().duration(duree).call(zoom.transform, d3.zoomIdentity);
    else svg.call(zoom.transform, d3.zoomIdentity);
  }

  // Surlignage lié : l'offre survolée ou sélectionnée (ici ou dans l'autre vue) et son quartier.
  function surligner() {
    const lies = new Set([etat.survol?.quartier, etat.selection?.quartier].filter((q) => q != null));
    gQuartiers.selectAll("path").classed("t1-lie", (f) => lies.has(f.properties.quartier));
    gQuartiers.selectAll("path.t1-zoome, path.t1-lie").raise();
    const t = d3.zoomTransform(svg.node());
    gPoints.selectAll("path")
      .attr("transform", (o) => transformOffre(o, t))
      .classed("selectionnee", (o) => o === etat.selection)
      .classed("survolee", (o) => o === etat.survol);
    gPoints.selectAll("path.selectionnee, path.survolee").raise();
  }

  // Une offre sélectionnée ailleurs (autre vue) et absente de la carte : la carte zoome sur son quartier.
  function suivreSelection() {
    const o = etat.selection;
    const dejaVisible = o != null && gPoints.selectAll("path").filter((p) => p === o).size() > 0;
    if (o?.quartier != null && o.quartier !== quartierZoome && !dejaVisible) {
      const f = etat.donnees?.quartiers.features.find((g) => g.properties.quartier === o.quartier);
      if (f) zoomerSur(f);
    }
    surligner();
  }

  // Couleurs (thème), légende et triangles.
  function dessiner() {
    if (!etat.donnees) return;
    echelles = creerEchelles();
    dessinerLegende();
    dessinerPoints();
  }

  function surDonnees() {
    quartierZoome = null;
    effacerPoi();
    svg.interrupt();
    // Les offres de la ville précédente n'ont ni position ni écart dans la nouvelle : on retire leurs
    // triangles avant le retour au zoom initial, qui replace les triangles existants (placer).
    gPoints.selectAll("path").remove();
    ({ medianes, ecarts } = calculerEcarts(etat.donnees.offres));
    caler();
    dessinerContours();
    svg.call(zoom.transform, d3.zoomIdentity);
    dessiner();
    synchroniserControlesPoi();
  }

  // Redimensionnement : on recale la projection et on revient au même quartier, sans animation.
  new ResizeObserver(() => {
    if (!etat.donnees || conteneur.clientWidth === largeurPrecedente) return;
    const zoome = quartierZoome;
    svg.interrupt();
    caler();
    dessinerContours();
    const f = etat.donnees.quartiers.features.find((g) => g.properties.quartier === zoome);
    if (f) zoomerSur(f, 0);
    else dezoomer(0);
    dessiner();
  }).observe(conteneur);

  // Passage clair / sombre : les couleurs des échelles sont relues.
  matchMedia("(prefers-color-scheme: light)").addEventListener("change", dessiner);
  // Thème forcé par l'attribut data-theme="light" ou "dark" sur <html> (voir style.css).
  new MutationObserver(dessiner).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  etat.on("donnees", surDonnees)
    .on("filtres", dessinerPoints)
    .on("selection", suivreSelection)
    .on("survol", surligner)
    .on("poi", surPoi);
  if (etat.donnees) surDonnees();
}
