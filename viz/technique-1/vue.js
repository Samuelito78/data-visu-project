// Technique 1 : carte des quartiers.
//
// Vue d'ensemble : une carte choroplèthe. Chaque quartier est coloré selon l'écart entre le prix médian
// des hôtels et celui des Airbnb (bleu : les hôtels sont moins chers ; orange : les Airbnb sont moins chers).
// Si une seule source est cochée dans les filtres, la couleur donne le prix médian de cette source.
// Détails : un clic sur un quartier zoome dessus et affiche ses offres une par une (zoom sémantique,
// cours 2 p. 97-100). Un clic sur une offre ouvre sa fiche et la surligne dans la technique 2.
//
// Données lues : etat.donnees.quartiers (contours) et etat.offresFiltrees() (offres qui passent les filtres).
// Aucune préparation ici : seulement une agrégation légère (médiane par quartier) qui dépend des filtres.
// Les styles propres à la carte sont dans technique-1/carte.css, chargé par ce fichier.

import {
  SOURCES, SEUIL_COMPARABLE, COULEUR_SANS_DONNEES, couleurSource, classeSource,
  formatPrix, formatEntier, echapper,
} from "../commun/charte.js";
import { afficherInfobulle, masquerInfobulle, htmlInfobulleOffre } from "../commun/infobulle.js";

const d3 = window.d3;

const MARGE = 12;            // marge autour de la ville, en pixels
const HAUTEUR_MAX = 560;     // hauteur maximale de la carte
const ZOOM_MAX = 12;
const SEUIL_POINTS = 2;      // à partir de ce facteur de zoom, les offres s'affichent une par une
const DUREE = 750;           // durée des transitions de zoom, en ms
// Forme des points : la source est codée deux fois, par la couleur et par la forme (redondance),
// pour qu'un hôtel bleu reste reconnaissable sur un quartier bleu. Taille = aire en px².
const FORME = { "Hôtel": d3.symbolSquare, "Airbnb": d3.symbolCircle };
const AIRE = { "Hôtel": 64, "Airbnb": 26 };
const AGRANDI = 3;           // facteur d'aire de l'offre sélectionnée
const symbole = (o, agrandi = false) => d3.symbol(FORME[o.source], AIRE[o.source] * (agrandi ? AGRANDI : 1))();
const ID_HACHURES = "t1-hachures";
const ID_DEGRADE = "t1-degrade";

const seuil = (source) => (source === "Hôtel" ? SEUIL_COMPARABLE.hotel : SEUIL_COMPARABLE.airbnb);
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

// Ce que montre la couleur : l'écart hôtel − Airbnb si les deux sources sont cochées,
// sinon le prix médian de la seule source cochée.
function choisirIndicateur(filtres) {
  const actives = SOURCES.filter((s) => filtres.sources.has(s));
  if (actives.length === 1) {
    const source = actives[0];
    return {
      type: "prix",
      source,
      actives,
      titre: `Prix médian par nuit des ${pluriel(source)}`,
      consigne: `Prix médian par nuit des ${pluriel(source)}, par quartier. Cliquez sur un quartier pour voir ses offres.`,
    };
  }
  return {
    type: "ecart",
    actives,
    titre: "Écart de prix médian par nuit (hôtel − Airbnb)",
    consigne: "Écart entre le prix médian des hôtels et celui des Airbnb, par quartier. Cliquez sur un quartier pour voir ses offres.",
  };
}

// Résumé de chaque quartier pour les offres filtrées : nombre d'offres et prix médian par source,
// puis la valeur à colorer, ou la raison pour laquelle on ne peut pas la calculer.
//   statut "valeur"      : la valeur est calculée
//   statut "insuffisant" : des offres, mais pas de quoi comparer (seuils D16, ou prix non comparables D7)
//   statut "vide"        : aucune offre
function resumerQuartiers(offres, quartiers, indicateur) {
  const parQuartier = d3.group(offres, (o) => o.quartier);
  return new Map(quartiers.features.map((f) => {
    const nom = f.properties.quartier;
    const liste = parQuartier.get(nom) ?? [];
    const r = { quartier: nom, nombre: {}, mediane: {}, valeur: null, statut: "vide", raison: "" };
    for (const s of SOURCES) {
      const prix = liste.filter((o) => o.source === s).map((o) => o.prix_nuit_eur);
      r.nombre[s] = prix.length;
      r.mediane[s] = d3.median(prix) ?? null;
    }

    if (liste.length === 0) {
      r.raison = "Aucune offre avec les filtres actuels.";
    } else if (indicateur.type === "prix") {
      const s = indicateur.source;
      if (r.nombre[s] >= seuil(s)) {
        r.statut = "valeur";
        r.valeur = r.mediane[s];
      } else {
        r.statut = "insuffisant";
        r.raison = `Moins de ${seuil(s)} ${pluriel(s)} : médiane peu fiable.`;
      }
    } else if (liste.some((o) => o.source === "Hôtel" && o.prix_comparable === false)) {
      r.statut = "insuffisant";
      r.raison = "Prix des hôtels non comparables avec les Airbnb (D7).";
    } else if (r.nombre["Airbnb"] < SEUIL_COMPARABLE.airbnb || r.nombre["Hôtel"] < SEUIL_COMPARABLE.hotel) {
      r.statut = "insuffisant";
      r.raison = `Comparaison impossible : il faut au moins ${SEUIL_COMPARABLE.airbnb} Airbnb et ${SEUIL_COMPARABLE.hotel} hôtels (D16).`;
    } else {
      r.statut = "valeur";
      r.valeur = r.mediane["Hôtel"] - r.mediane["Airbnb"]; // négatif : les hôtels sont moins chers
    }
    return [nom, r];
  }));
}

// Échelle de couleur de l'indicateur, construite avec les couleurs du thème courant (clair ou sombre).
function creerEchelle(resumes, indicateur) {
  const valeurs = [...resumes.values()].filter((r) => r.statut === "valeur").map((r) => r.valeur);
  const surface = lireCouleur("--surface");

  if (indicateur.type === "ecart") {
    // Échelle divergente : zéro (prix médians égaux) au centre, domaine symétrique.
    const max = d3.max(valeurs, Math.abs) || 1;
    const interpolateur = d3.piecewise(d3.interpolateLab, [
      lireCouleur("--couleur-hotel"), surface, lireCouleur("--couleur-airbnb"),
    ]);
    return d3.scaleDiverging([-max, 0, max], interpolateur).clamp(true);
  }

  // Échelle séquentielle : du plus clair (prix bas) à la couleur de la source (prix haut).
  const couleur = lireCouleur(indicateur.source === "Hôtel" ? "--couleur-hotel" : "--couleur-airbnb");
  let [min, max] = d3.extent(valeurs);
  if (min == null) [min, max] = [0, 1];
  if (min === max) max = min + 1;
  const depart = d3.interpolateLab(surface, couleur)(0.12);
  return d3.scaleSequential([min, max], d3.interpolateLab(depart, couleur)).clamp(true);
}

function texteEcart(v) {
  if (v < 0) return `Hôtels moins chers de ${formatPrix(-v)} (médianes)`;
  if (v > 0) return `Airbnb moins chers de ${formatPrix(v)} (médianes)`;
  return "Prix médians égaux";
}

function htmlQuartier(r, indicateur, estZoome) {
  const lignes = [`<strong>${echapper(r.quartier)}</strong>`];
  for (const s of indicateur.actives) {
    lignes.push(
      `<span class="pastille ${classeSource(s)}"></span>${pluriel(s)} : ${formatEntier(r.nombre[s])} offre(s)` +
      (r.nombre[s] > 0 ? `, médiane ${formatPrix(r.mediane[s])}` : "")
    );
  }
  if (r.statut === "valeur") {
    lignes.push(indicateur.type === "ecart" ? `<strong>${texteEcart(r.valeur)}</strong>` : `<strong>Médiane : ${formatPrix(r.valeur)}</strong>`);
  } else {
    lignes.push(`<em>${echapper(r.raison)}</em>`);
  }
  if (!estZoome && r.statut !== "vide") lignes.push("Cliquez pour voir les offres.");
  return lignes.join("<br>");
}

// Motif de hachures : quartiers où la comparaison n'est pas possible (D16, D7).
function remplirHachures(motif) {
  motif.attr("patternUnits", "userSpaceOnUse").attr("width", 6).attr("height", 6);
  motif.append("rect").attr("width", 6).attr("height", 6).style("fill", COULEUR_SANS_DONNEES);
  motif.append("path").attr("d", "M0,0V6").style("stroke", "var(--texte-discret)").style("stroke-width", 1.2);
  return motif;
}

export function creerVue(conteneur, etat) {
  chargerStyle();
  const racine = d3.select(conteneur);

  // En-tête : phrase d'explication (ou résumé du quartier zoomé) et bouton de retour.
  const entete = racine.append("div").attr("class", "t1-entete");
  const resume = entete.append("p").attr("class", "t1-resume").attr("aria-live", "polite");
  const boutonRetour = entete.append("button").attr("type", "button").attr("class", "t1-retour")
    .text("← Vue d'ensemble").property("hidden", true)
    .on("click", () => dezoomer());

  // La carte : un groupe `carte` qui reçoit la transformation du zoom (les contours),
  // puis les points et les étiquettes, placés à la main pour garder une taille fixe à l'écran.
  const svg = racine.append("svg").attr("class", "t1-carte")
    .attr("role", "img").attr("aria-label", "Carte des quartiers : écart de prix entre hôtels et Airbnb");
  const motif = svg.append("defs").append("pattern").attr("id", ID_HACHURES);
  remplirHachures(motif);

  const carte = svg.append("g");
  const gQuartiers = carte.append("g").attr("class", "t1-quartiers");
  const gEtiquettes = svg.append("g").attr("class", "t1-etiquettes");
  const gPoints = svg.append("g").attr("class", "t1-points");

  const legende = racine.append("div").attr("class", "t1-legende");

  const projection = d3.geoMercator();
  const chemin = d3.geoPath(projection);
  let largeur = 0;
  let hauteur = 0;
  let largeurPrecedente = 0;   // pour ne recaler que si la largeur change
  let quartierZoome = null;    // nom du quartier sur lequel on a cliqué, ou null
  let resumes = new Map();     // quartier → résumé (resumerQuartiers)
  let echelle = null;          // échelle de couleur courante (creerEchelle)
  let indicateur = choisirIndicateur(etat.filtres);
  let positions = new Map();   // id d'offre → [x, y] projetés (sans zoom)
  let centres = new Map();     // quartier → [x, y] du centre de l'étiquette
  let tailles = new Map();     // quartier → [largeur, hauteur] du contour, en pixels sans zoom
  const longueurs = new Map(); // quartier → longueur de son étiquette, en pixels

  const zoom = d3.zoom()
    .scaleExtent([1, ZOOM_MAX])
    .clickDistance(4)        // un petit glissement ne compte pas comme un déplacement
    // Molette et pincement zooment ; glisser avec le bouton gauche déplace (les autres boutons sont ignorés).
    .filter((e) => !e.button)
    .on("zoom", ({ transform }) => placer(transform))
    .on("end", ({ transform }) => {
      if (transform.k <= 1.01) quartierZoome = null;
      dessinerPoints();
    });
  svg.call(zoom).on("dblclick.zoom", null);

  // Clic dans le vide (hors des quartiers) : retour à la vue d'ensemble.
  svg.on("click", () => {
    if (quartierZoome || d3.zoomTransform(svg.node()).k > 1) dezoomer();
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

  // Contours et étiquettes : ne changent qu'avec la ville ou la taille.
  function dessinerContours() {
    gQuartiers.selectAll("path")
      .data(etat.donnees.quartiers.features, (f) => f.properties.quartier)
      .join("path")
      .attr("d", chemin)
      .on("pointerenter", function (e, f) {
        d3.select(this).raise();
        afficherInfobulle(e, htmlQuartier(resumes.get(f.properties.quartier), indicateur, f.properties.quartier === quartierZoome));
      })
      .on("pointermove", (e, f) => {
        afficherInfobulle(e, htmlQuartier(resumes.get(f.properties.quartier), indicateur, f.properties.quartier === quartierZoome));
      })
      .on("pointerleave", () => masquerInfobulle())
      .on("click", (e, f) => {
        e.stopPropagation();
        // Clic sur le quartier déjà zoomé : on reste (c'est là qu'on vise les points).
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

  // Couleurs, légende, résumé et points : changent avec les filtres.
  function dessiner() {
    if (!etat.donnees) return;
    indicateur = choisirIndicateur(etat.filtres);
    resumes = resumerQuartiers(etat.offresFiltrees(), etat.donnees.quartiers, indicateur);
    echelle = creerEchelle(resumes, indicateur);

    gQuartiers.selectAll("path").style("fill", (f) => {
      const r = resumes.get(f.properties.quartier);
      if (r.statut === "valeur") return echelle(r.valeur);
      if (r.statut === "insuffisant") return `url(#${ID_HACHURES})`;
      return COULEUR_SANS_DONNEES;
    });

    dessinerLegende(echelle);
    dessinerPoints();
  }

  // Applique la transformation du zoom : le groupe des contours bouge,
  // les points et les étiquettes sont replacés pour garder leur taille à l'écran.
  function placer(t) {
    carte.attr("transform", t);
    motif.attr("patternTransform", `scale(${1 / t.k}) rotate(45)`); // hachures de taille constante
    gPoints.selectAll("path").attr("transform", (o) => `translate(${t.apply(positions.get(o.id))})`);
    placerEtiquettes(t);
  }

  // Une étiquette n'est affichée que si elle tient dans son quartier et ne chevauche pas une autre.
  // Les grands quartiers passent en premier : en cas de conflit, c'est le petit qui perd son étiquette.
  function placerEtiquettes(t) {
    const pointsVisibles = !gPoints.select("path").empty();
    const placees = [];  // rectangles [x0, y0, x1, y1] des étiquettes déjà affichées
    const visibles = new Set();
    if (!pointsVisibles) {
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
    }
    gEtiquettes.selectAll("text")
      .attr("transform", (f) => `translate(${t.apply(centres.get(f.properties.quartier))})`)
      .attr("display", (f) => (visibles.has(f.properties.quartier) ? null : "none"));
  }

  // Zoom sémantique : au-delà de SEUIL_POINTS, ou dans un quartier zoomé, on montre les offres visibles.
  // Les hôtels sans coordonnées (environ 30 %, D19) comptent dans la couleur mais n'ont pas de point.
  function dessinerPoints() {
    if (!etat.donnees) return;
    const t = d3.zoomTransform(svg.node());
    let offres = [];
    if (quartierZoome || t.k >= SEUIL_POINTS) {
      const [x0, y0] = t.invert([0, 0]);
      const [x1, y1] = t.invert([largeur, hauteur]);
      offres = etat.offresFiltrees()
        .filter((o) => {
          const p = positions.get(o.id);
          return p && p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1;
        })
        .sort((a, b) => d3.ascending(a.source === "Hôtel", b.source === "Hôtel")); // hôtels au-dessus
    }

    gPoints.selectAll("path")
      .data(offres, (o) => o.id)
      .join("path")
      .attr("d", (o) => symbole(o, o === etat.selection))
      .attr("transform", (o) => `translate(${t.apply(positions.get(o.id))})`)
      .style("fill", (o) => couleurSource(o.source))
      .on("pointerenter", (e, o) => { etat.survoler(o); afficherInfobulle(e, htmlInfobulleOffre(o)); })
      .on("pointermove", (e, o) => afficherInfobulle(e, htmlInfobulleOffre(o)))
      .on("pointerleave", () => { etat.survoler(null); masquerInfobulle(); })
      .on("click", (e, o) => { e.stopPropagation(); etat.selectionner(o); });

    // Avec les points, les couleurs des quartiers passent au second plan (sinon un hôtel bleu disparaît sur un quartier bleu).
    gQuartiers.classed("t1-avec-points", offres.length > 0);
    gQuartiers.selectAll("path")
      .classed("t1-zoome", (f) => f.properties.quartier === quartierZoome)
      .classed("t1-estompe", (f) => quartierZoome != null && f.properties.quartier !== quartierZoome);
    boutonRetour.property("hidden", !(quartierZoome || t.k > 1));
    placerEtiquettes(t);
    ecrireResume(offres.length);
    surligner();
  }

  function ecrireResume(nbPoints) {
    resume.selectAll("*").remove();
    resume.text("");
    if (quartierZoome) {
      // Le quartier zoomé : sa valeur, avec une pastille de sa couleur (lisible même sous les points).
      const r = resumes.get(quartierZoome);
      resume.append("strong").text(`${quartierZoome} : `);
      if (r.statut === "valeur") {
        resume.append("span").attr("class", "t1-pastille-valeur").style("background", echelle(r.valeur));
        const texte = indicateur.type === "ecart" ? texteEcart(r.valeur) : `prix médian ${formatPrix(r.valeur)}`;
        resume.append("strong").text(texte.charAt(0).toLowerCase() + texte.slice(1));
      } else {
        resume.append("em").text(r.raison.replace(/\.$/, "").toLowerCase());
      }

      const sansPosition = etat.offresFiltrees()
        .filter((o) => o.quartier === quartierZoome && !positions.has(o.id)).length;
      const nombres = indicateur.actives
        .map((s) => `${formatEntier(r.nombre[s])} ${r.nombre[s] > 1 ? pluriel(s) : s === "Hôtel" ? "hôtel" : "Airbnb"}`)
        .join(" et ");
      resume.append("span").text(
        `. ${nombres || "Aucune offre"}` +
        (sansPosition > 0 ? `, dont ${formatEntier(sansPosition)} hôtel(s) sans position, absent(s) de la carte` : "") +
        ". Cliquez sur une offre pour afficher sa fiche."
      );
    } else if (nbPoints > 0) {
      resume.text(`${formatEntier(nbPoints)} offres visibles. Cliquez sur une offre pour afficher sa fiche.`);
    } else {
      resume.text(indicateur.consigne);
    }
  }

  function dessinerLegende(echelle) {
    legende.selectAll("*").remove();

    // Barre de couleur avec son axe, ou un message si aucun quartier n'a de valeur.
    const bloc = legende.append("div").attr("class", "t1-legende-bloc");
    bloc.append("span").attr("class", "t1-legende-titre").text(indicateur.titre);
    if ([...resumes.values()].some((r) => r.statut === "valeur")) {
      dessinerBarre(bloc, echelle);
    } else {
      bloc.append("span").attr("class", "t1-legende-note").text(
        indicateur.type === "ecart"
          ? "Aucun quartier comparable avec ces filtres. Décochez une source pour voir les prix médians de l'autre."
          : "Aucun quartier n'a assez d'offres avec ces filtres."
      );
    }

    // Cas particuliers : hachures et gris.
    const cas = legende.append("div").attr("class", "t1-legende-cas");
    const ajouterCas = (fond, texte) => {
      const item = cas.append("span").attr("class", "t1-legende-item");
      const pastille = item.append("svg").attr("width", 14).attr("height", 14);
      if (fond === "hachures") {
        // Motif propre à la légende : celui de la carte change d'échelle avec le zoom.
        remplirHachures(pastille.append("defs").append("pattern").attr("id", `${ID_HACHURES}-legende`)
          .attr("patternTransform", "rotate(45)"));
        fond = `url(#${ID_HACHURES}-legende)`;
      }
      pastille.append("rect").attr("width", 14).attr("height", 14).style("fill", fond);
      item.append("span").text(texte);
    };
    ajouterCas("hachures", "Pas assez d'offres pour comparer, ou prix non comparables");
    ajouterCas(COULEUR_SANS_DONNEES, "Aucune offre");

    // Points (visibles au zoom).
    const points = legende.append("div").attr("class", "t1-legende-cas");
    for (const s of SOURCES) {
      const item = points.append("span").attr("class", "t1-legende-item t1-points");
      item.append("svg").attr("width", 14).attr("height", 14).attr("viewBox", [-7, -7, 14, 14])
        .append("path").attr("d", symbole({ source: s })).style("fill", couleurSource(s));
      item.append("span").text(s === "Hôtel" ? "Hôtel (carré)" : "Airbnb (rond)");
    }
    points.append("span").attr("class", "t1-legende-note")
      .text("Points visibles au zoom. Environ 30 % des hôtels n'ont pas de position : ils comptent dans la couleur du quartier, sans point.");
  }

  // Dégradé de l'échelle de couleur, avec un axe gradué en euros.
  function dessinerBarre(bloc, echelle) {
    const L = 240;
    const H = 10;
    const domaine = echelle.domain();
    const [d0, d1] = [domaine[0], domaine[domaine.length - 1]];
    const svgL = bloc.append("svg").attr("width", L + 24).attr("height", H + 20).attr("viewBox", [0, 0, L + 24, H + 20]);
    svgL.append("defs").append("linearGradient").attr("id", ID_DEGRADE)
      .selectAll("stop").data(d3.range(11)).join("stop")
      .attr("offset", (i) => i / 10)
      .attr("stop-color", (i) => echelle(d0 + ((d1 - d0) * i) / 10));
    svgL.append("rect").attr("x", 12).attr("width", L).attr("height", H).attr("fill", `url(#${ID_DEGRADE})`);
    const x = d3.scaleLinear([d0, d1], [12, 12 + L]);
    const format = indicateur.type === "ecart"
      ? (v) => (v === 0 ? "0" : `${v < 0 ? "−" : "+"}${formatPrix(Math.abs(v))}`)
      : formatPrix;
    svgL.append("g").attr("class", "axe").attr("transform", `translate(0,${H})`)
      .call(d3.axisBottom(x).ticks(indicateur.type === "ecart" ? 5 : 4).tickFormat(format).tickSize(4))
      .call((g) => g.select(".domain").remove());
    if (indicateur.type === "ecart") {
      const sens = bloc.append("div").attr("class", "t1-legende-sens");
      sens.append("span").text("← hôtels moins chers");
      sens.append("span").text("Airbnb moins chers →");
    }
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
    gPoints.selectAll("path")
      .attr("d", (o) => symbole(o, o === etat.selection))
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

  function surDonnees() {
    quartierZoome = null;
    svg.interrupt();
    caler();
    dessinerContours();
    svg.call(zoom.transform, d3.zoomIdentity);
    dessiner();
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
    .on("filtres", dessiner)
    .on("selection", suivreSelection)
    .on("survol", surligner);
  if (etat.donnees) surDonnees();
}
