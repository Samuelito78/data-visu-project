// Technique 1 : l'outil point d'intérêt (fonction de Luca, voir aussi composants/points-interet).
//
// Étapes, en mode point d'intérêt :
//   1. un point est posé : clic sur la carte, lieu choisi dans le panneau, ou point perso déposé ;
//   2. le 1er rayon suit la souris ; un clic le fige et fait apparaître le 2e cercle ;
//   3. le 2e cercle a son centre sur le 1er cercle ; il tourne et change de rayon avec la souris ;
//      un clic le fige complètement (il ne suit plus la souris), un autre clic le reprend.
// La recherche porte sur le 2e cercle en mode point d'intérêt, sur le 1er sinon (rechercher).
//
// L'outil possède ses boutons (dans l'en-tête), son encart sur la carte et son calque SVG.
// onChangement() : le point ou un cercle a changé, la vue redessine les triangles.

import { formatEntier, formatKm } from "../noyau/charte.js";
import { TYPE_DEPOT_POI } from "../composants/points-interet/lieux.js";
import { distanceKm, capInitial, destination } from "./geo.js";

const d3 = window.d3;

const RAYON_SECOND_PAR_DEFAUT = 0.8; // km, rayon de départ du 2e cercle (plafonné au 1er rayon)
const RAYON_LIEU_PAR_DEFAUT = 1;     // km, 1er rayon de départ d'un lieu choisi dans le panneau

export function creerOutilPoi({ etat, fond, zoneBoutons, cadre, calque, onChangement }) {
  // Boutons dans l'en-tête de la vue.
  const boutonMode = zoneBoutons.append("button").attr("type", "button").attr("class", "t1-poi-bouton");
  const boutonEffacer = zoneBoutons.append("button").attr("type", "button")
    .attr("class", "t1-poi-effacer").text("Effacer le point");

  // Encart posé sur la carte (position absolue) : son texte change à chaque mouvement de souris pendant
  // le tracé. Dans l'en-tête, il changeait la hauteur de la page et décalait la carte sous le curseur,
  // ce qui changeait le rayon, donc le texte : la page tremblait.
  const bandeau = cadre.append("div").attr("class", "t1-poi-bandeau").attr("aria-live", "polite");
  const texteEtape = bandeau.append("span").attr("class", "t1-poi-info");
  const texteCompte = bandeau.append("span").attr("class", "t1-poi-compte");

  // Repère et cercles, dans le calque du point d'intérêt.
  calque.style("display", "none");
  const halo = calque.append("circle").attr("class", "t1-poi-halo").attr("r", 0);
  calque.append("circle").attr("class", "t1-poi-marqueur").attr("r", 5);
  const halo2 = calque.append("circle").attr("class", "t1-poi-halo-secondaire").attr("r", 0);
  const centre2 = calque.append("circle").attr("class", "t1-poi-centre-secondaire").attr("r", 4);

  let modeActif = false;
  let point = null;            // [lon, lat] du point d'intérêt
  let rayon1 = null;           // km
  let rayon1Fige = false;
  let centre2Geo = null;       // [lon, lat] du centre du 2e cercle, sur le 1er cercle
  let rayon2 = null;           // km
  let rayon2Fige = false;
  let resume = null;           // { total, hotel, airbnb, rayon, secondaire } de la dernière recherche

  // Rayon en pixels à l'écran d'un cercle de `rayonKm` autour de `centre`, au zoom courant.
  function rayonPixels(centre, rayonKm) {
    if (!centre || rayonKm == null || rayonKm <= 0) return 0;
    const a = fond.versEcran(centre);
    const b = fond.versEcran(destination(centre, rayonKm, Math.PI / 2));
    return a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 0;
  }

  // Replace le repère et les cercles (après un zoom ou un changement).
  function placer() {
    const p = point && fond.versEcran(point);
    if (!p) { calque.style("display", "none"); return; }
    calque.style("display", null).attr("transform", `translate(${p[0]},${p[1]})`);
    halo.attr("r", rayonPixels(point, rayon1));
    const p2 = rayon1Fige && centre2Geo ? fond.versEcran(centre2Geo) : null;
    halo2.style("display", p2 ? null : "none");
    centre2.style("display", p2 ? null : "none");
    if (p2) {
      halo2.attr("cx", p2[0] - p[0]).attr("cy", p2[1] - p[1]).attr("r", rayonPixels(centre2Geo, rayon2));
      centre2.attr("cx", p2[0] - p[0]).attr("cy", p2[1] - p[1]);
    }
  }

  // Encart : l'étape du tracé, puis le nombre d'offres dans le cercle de recherche.
  function ecrireBandeau() {
    bandeau.property("hidden", !modeActif && !resume);
    texteEtape.text(!modeActif ? ""
      : !point ? "Cliquez sur la carte, choisissez un lieu ou glissez le point perso."
        : !rayon1Fige
          ? (rayon1 == null || rayon1 <= 0
            ? "Déplacez la souris puis cliquez pour figer le 1er rayon."
            : `1er rayon : ${formatKm(rayon1)} (cliquez pour figer)`)
          : (!rayon2Fige
            ? `1er rayon : ${formatKm(rayon1)} · 2e rayon : ${formatKm(rayon2 ?? 0)} (cliquez pour figer le 2e cercle)`
            : `2e cercle figé (${formatKm(rayon2)}). Cliquez sur la carte pour le reprendre.`));
    texteCompte.text(!resume ? ""
      : `${resume.secondaire ? "2e cercle" : "Point d'intérêt"} (${formatKm(resume.rayon)}) : `
        + `${formatEntier(resume.total)} offre(s) proche(s) `
        + `(${formatEntier(resume.hotel)} hôtels, ${formatEntier(resume.airbnb)} Airbnb).`);
  }

  function synchroniser() {
    boutonMode.attr("aria-pressed", modeActif ? "true" : "false")
      .text(`Mode point d'intérêt : ${modeActif ? "activé" : "désactivé"}`);
    boutonEffacer.property("disabled", !point);
    fond.svg.classed("t1-mode-poi", modeActif);
    ecrireBandeau();
  }

  function mettreAJour() {
    placer();
    onChangement();
    synchroniser();
  }

  // Remet le point et ses deux cercles à zéro (bouton « Effacer », changement de ville, nouveau point).
  function effacer() {
    point = null;
    rayon1 = null;
    rayon1Fige = false;
    centre2Geo = null;
    rayon2 = null;
    rayon2Fige = false;
    resume = null;
  }

  // Nouveau point : le 1er rayon repart de `rayonDepart` et suit la souris.
  function poser(geo, rayonDepart = 0) {
    effacer();
    point = geo;
    rayon1 = rayonDepart;
  }

  // Un point posé ou déplacé sur la carte devient le point perso de l'état (le panneau le signale).
  // L'état renvoie l'événement « poi » : surPoi voit que c'est déjà le point affiché et ne fait rien.
  function signalerPointPerso() {
    if (point) etat.choisirPoi({ id: "perso", nom: "Point perso", lon: point[0], lat: point[1], perso: true });
  }

  function suivreRayon1(geoSouris) {
    rayon1 = geoSouris ? distanceKm(point, geoSouris) : null;
  }

  // Le 2e cercle tourne avec la souris (son centre reste sur le 1er cercle) et son rayon va jusqu'à elle.
  function suivreCercle2(geoSouris) {
    if (!geoSouris || rayon1 == null) return;
    centre2Geo = destination(point, rayon1, capInitial(point, geoSouris));
    rayon2 = distanceKm(centre2Geo, geoSouris);
  }

  function demarrerCercle2(geoSouris) {
    if (rayon1 == null || rayon1 <= 0) return;
    centre2Geo = destination(point, rayon1, geoSouris ? capInitial(point, geoSouris) : 0);
    rayon2 = Math.max(0.2, Math.min(RAYON_SECOND_PAR_DEFAUT, rayon1));
    rayon2Fige = false;
  }

  // Clic sur la carte en mode point d'intérêt : passe à l'étape suivante. Renvoie false hors du mode.
  function gererClic(e) {
    if (!modeActif) return false;
    const geoSouris = fond.versGeo(d3.pointer(e, fond.svg.node()));
    if (!point) {
      if (geoSouris) { poser(geoSouris); signalerPointPerso(); }
    } else if (!rayon1Fige) {
      suivreRayon1(geoSouris);
      rayon1Fige = true;
      demarrerCercle2(geoSouris);
    } else if (!rayon2Fige) {
      suivreCercle2(geoSouris);
      rayon2Fige = true;
    } else {
      // 2e cercle figé : un clic le reprend, il suit de nouveau la souris.
      rayon2Fige = false;
      suivreCercle2(geoSouris);
    }
    mettreAJour();
    return true;
  }

  // Mouvement de souris : le cercle en cours suit le pointeur, au plus un dessin par image.
  let pointeurEnAttente = null;
  const suitLaSouris = () => modeActif && point != null && !rayon2Fige;
  fond.svg.on("pointermove.poi", (e) => {
    if (!suitLaSouris()) return;
    const dejaPrevu = pointeurEnAttente != null;
    pointeurEnAttente = d3.pointer(e, fond.svg.node());
    if (dejaPrevu) return;
    requestAnimationFrame(() => {
      const geoSouris = fond.versGeo(pointeurEnAttente);
      pointeurEnAttente = null;
      if (!suitLaSouris()) return;
      if (!rayon1Fige) suivreRayon1(geoSouris);
      else suivreCercle2(geoSouris);
      mettreAJour();
    });
  });

  // Le repère se déplace à la souris ; les cercles repartent de zéro.
  let repereDeplace = false;   // le repère a-t-il bougé pendant le geste (un simple clic ne compte pas)
  calque.call(d3.drag()
    .on("start", (e) => { e.sourceEvent.stopPropagation(); repereDeplace = false; })
    .on("drag", (e) => {
      const geo = fond.versGeo([e.x, e.y]);
      if (!geo) return;
      repereDeplace = true;
      poser(geo);
      mettreAJour();
    })
    .on("end", () => { if (repereDeplace) signalerPointPerso(); }));

  // Dépôt du point perso glissé depuis le panneau : seule la carte l'accepte.
  const estDepotPoi = (e) => e.dataTransfer && [...e.dataTransfer.types].includes(TYPE_DEPOT_POI);
  fond.svg
    .on("dragover.poi", (e) => {
      if (!estDepotPoi(e)) return;
      e.preventDefault();      // autorise le dépôt ici, et seulement ici
      e.dataTransfer.dropEffect = "copy";
      fond.svg.classed("t1-cible-depot", true);
    })
    .on("dragleave.poi", (e) => {
      if (!fond.svg.node().contains(e.relatedTarget)) fond.svg.classed("t1-cible-depot", false);
    })
    .on("drop.poi", (e) => {
      if (!estDepotPoi(e)) return;
      e.preventDefault();
      fond.svg.classed("t1-cible-depot", false);
      document.body.classList.remove("poi-en-glisse");
      const geo = fond.versGeo(d3.pointer(e, fond.svg.node()));
      if (!geo) return;
      modeActif = true;
      poser(geo);
      mettreAJour();
      signalerPointPerso();
    });

  boutonMode.on("click", () => {
    modeActif = !modeActif;
    synchroniser();
  });
  boutonEffacer.on("click", () => {
    effacer();
    mettreAJour();
    etat.choisirPoi(null);
  });

  // Lieu choisi dans le panneau (ou point effacé) : le point est placé avec un rayon de départ,
  // le mode s'active et, si le lieu est hors de l'écran, la carte revient à la vue d'ensemble.
  etat.on("poi", () => {
    const p = etat.poi;
    if (!p) {
      if (point) { effacer(); mettreAJour(); }
      return;
    }
    if (point && point[0] === p.lon && point[1] === p.lat) return; // déjà affiché (posé sur la carte)
    poser([p.lon, p.lat], p.perso ? 0 : RAYON_LIEU_PAR_DEFAUT);
    modeActif = true;
    if (!fond.estVisible(point)) fond.dezoomer();
    mettreAJour();
  });

  synchroniser();

  return {
    gererClic,
    placer,
    get modeActif() { return modeActif; },
    // 2e cercle figé en mode point d'intérêt : un clic sur une offre ouvre sa fiche.
    get cercleFige() { return modeActif && rayon2Fige; },

    // Offres (avec position) dans le cercle de recherche, et leur décompte pour l'encart.
    rechercher(offres) {
      const centre = modeActif || rayon1Fige ? centre2Geo : point;
      const rayon = modeActif || rayon1Fige ? rayon2 : rayon1;
      resume = null;
      let ids = new Set();
      const active = centre != null && rayon != null && rayon > 0;
      if (active) {
        const proches = offres.filter((o) => o.lat != null && o.lon != null
          && distanceKm(centre, [o.lon, o.lat]) <= rayon);
        ids = new Set(proches.map((o) => o.id));
        const comptes = d3.rollup(proches, (v) => v.length, (o) => o.source);
        resume = {
          total: ids.size,
          hotel: comptes.get("Hôtel") ?? 0,
          airbnb: comptes.get("Airbnb") ?? 0,
          rayon,
          secondaire: rayon1Fige,
        };
      }
      ecrireBandeau();
      return { active, ids };
    },

    // Changement de ville : plus de point (le mode reste tel quel).
    reinitialiser() {
      effacer();
      placer();
      synchroniser();
    },
  };
}
