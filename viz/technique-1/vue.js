// Technique 1 : carte des offres.
//
// Vue d'ensemble : chaque offre qui a une position est un triangle posé sur la carte des quartiers.
//   ▲ : prix au-dessus de la médiane de sa source dans la ville ; ▼ : prix en dessous.
// La couleur donne l'éloignement à cette médiane : bleu de plus en plus foncé pour les hôtels,
// rouge de plus en plus foncé pour les Airbnb. Les quartiers ont un fond neutre.
// Détails : un clic sur un quartier (entre les triangles) zoome dessus ; à tout niveau de zoom, le survol
// d'une offre affiche son infobulle et un clic ouvre sa fiche et la surligne dans la technique 2
// (zoom sémantique, cours 2 p. 97-100).
// Point d'intérêt : un lieu du panneau de droite, un point perso déposé, ou un clic en mode point
// d'intérêt ; les offres autour du point sont comptées et, dans ce mode, seules elles sont dessinées.
//
// Ce fichier assemble la carte et la redessine quand l'état change. Les morceaux :
//   fond.js       SVG, calques, projection, zoom          prix.js      médianes, écarts, couleurs
//   quartiers.js  contours, étiquettes, comptages          triangles.js les offres
//   poi.js        outil point d'intérêt                    geo.js       distances et caps
//   entete.js     résumé et boutons                        legende.js   légende
// Les styles sont dans carte.css.

import { creerFond } from "./fond.js";
import { creerPrix } from "./prix.js";
import { creerQuartiers } from "./quartiers.js";
import { creerTriangles } from "./triangles.js";
import { creerOutilPoi } from "./poi.js";
import { creerEntete } from "./entete.js";
import { creerLegende } from "./legende.js";
import { masquerInfobulle } from "../composants/infobulle/infobulle.js";

const d3 = window.d3;

export function creerVue(conteneur, etat) {
  const racine = d3.select(conteneur);
  const prix = creerPrix();

  const entete = creerEntete(racine, { onRetour: () => fond.dezoomer() });
  const cadre = racine.append("div").attr("class", "t1-cadre");
  const fond = creerFond(cadre, {
    onZoom: (t) => {
      triangles.placer(t);
      quartiers.placerEtiquettes(t);
      poi.placer();
    },
    onZoomFin: () => dessinerPoints(),
  });
  const legende = creerLegende(racine);

  const zoomerSur = (f, duree) => { masquerInfobulle(); fond.zoomerSur(f, duree); };

  const quartiers = creerQuartiers(fond.calques.quartiers, fond.calques.etiquettes, {
    etat, prix, fond,
    onClic: (e, f) => {
      if (poi.gererClic(e)) return;
      // Clic sur le quartier déjà zoomé : on reste (c'est là qu'on vise les triangles).
      if (f.properties.quartier !== fond.quartierZoome) zoomerSur(f);
    },
  });

  const triangles = creerTriangles(fond.calques.points, {
    etat, prix,
    onClic: (e, o) => {
      // Une fois le 2e cercle figé, un clic sur une offre ouvre sa fiche au lieu de reprendre le cercle.
      if (!poi.cercleFige && poi.gererClic(e)) return;
      etat.selectionner(o);
    },
  });

  const poi = creerOutilPoi({
    etat, fond, cadre,
    zoneBoutons: entete.zoneBoutons,
    calque: fond.calques.poi,
    onChangement: () => dessinerPoints(),
  });

  // Clic dans le vide (hors des quartiers) : retour à la vue d'ensemble.
  fond.svg.on("click", (e) => {
    if (poi.gererClic(e)) return;
    if (fond.quartierZoome || fond.transform().k > 1) fond.dezoomer();
  });

  // Les triangles à dessiner. Affichage ciblé : en mode point d'intérêt, ou en vue d'ensemble avec
  // un cercle, seules les offres du cercle ; sinon, toutes les offres visibles à l'écran.
  // Les hôtels sans coordonnées (environ 30 %) comptent dans la médiane mais n'ont pas de triangle.
  function dessinerPoints() {
    if (!etat.donnees) return;
    const t = fond.transform();
    const toutes = etat.offresFiltrees();
    const recherche = poi.rechercher(toutes);
    const zoome = fond.quartierZoome != null || t.k >= entete.SEUIL_POINTS;
    const offres = poi.modeActif || (recherche.active && !zoome)
      ? toutes.filter((o) => recherche.ids.has(o.id))
      : triangles.visibles(toutes, t, fond.largeur, fond.hauteur);

    triangles.dessiner(offres, t, recherche.ids);
    quartiers.marquerZoome();
    quartiers.placerEtiquettes(t);
    entete.afficherRetour(fond.quartierZoome != null || t.k > 1);
    ecrireResume(offres.length, t);
    surligner();
  }

  function ecrireResume(nbVisibles, t) {
    const nom = fond.quartierZoome;
    entete.ecrire({
      quartier: nom && {
        nom,
        comptes: quartiers.compter(nom),
        sansPosition: etat.offresFiltrees().filter((o) => o.quartier === nom && !triangles.aUnePosition(o)).length,
      },
      modePoi: poi.modeActif,
      zoom: t.k,
      nbVisibles,
    });
  }

  // Surlignage lié : l'offre survolée ou sélectionnée (ici ou dans l'autre vue) et son quartier.
  function surligner() {
    quartiers.surligner(new Set([etat.survol?.quartier, etat.selection?.quartier].filter((q) => q != null)));
    triangles.surligner(fond.transform());
  }

  // Une offre sélectionnée ailleurs (autre vue) et absente de la carte : la carte zoome sur son quartier.
  function suivreSelection() {
    const o = etat.selection;
    if (o?.quartier != null && o.quartier !== fond.quartierZoome && !triangles.contient(o)) {
      const f = quartiers.trouver(o.quartier);
      if (f) zoomerSur(f);
    }
    surligner();
  }

  // Couleurs (relues dans le thème), légende et triangles.
  function dessiner() {
    if (!etat.donnees) return;
    prix.relireCouleurs();
    legende.dessiner(prix, etat.ville);
    dessinerPoints();
  }

  // Projection calée sur la largeur disponible, positions des offres et contours.
  function caler() {
    fond.caler(etat.donnees.quartiers, conteneur.clientWidth);
    triangles.positionner(etat.donnees.offres, fond.projection);
    quartiers.dessiner(etat.donnees.quartiers);
  }

  function surDonnees() {
    fond.interrompre();
    poi.reinitialiser();
    // Les offres de la ville précédente n'ont ni position ni écart dans la nouvelle : on retire leurs
    // triangles avant le retour au zoom initial, qui replace les triangles existants (onZoom).
    triangles.vider();
    prix.calculer(etat.donnees.offres);
    caler();
    fond.dezoomer(0);
    dessiner();
  }

  // Redimensionnement : on recale la projection et on revient au même quartier, sans animation.
  new ResizeObserver(() => {
    if (!etat.donnees || conteneur.clientWidth === fond.largeurCalee) return;
    const f = quartiers.trouver(fond.quartierZoome);
    fond.interrompre();
    caler();
    if (f) fond.zoomerSur(f, 0);
    else fond.dezoomer(0);
    dessiner();
  }).observe(conteneur);

  // Passage clair / sombre : les couleurs des échelles sont relues.
  matchMedia("(prefers-color-scheme: light)").addEventListener("change", dessiner);
  // Thème forcé par l'attribut data-theme="light" ou "dark" sur <html> (voir styles/theme.css).
  new MutationObserver(dessiner).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  etat.on("donnees", surDonnees)
    .on("filtres", dessinerPoints)
    .on("selection", suivreSelection)
    .on("survol", surligner);
  if (etat.donnees) surDonnees();
}
