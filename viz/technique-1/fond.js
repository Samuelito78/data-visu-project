// Technique 1 : le fond de carte. SVG, calques, projection calée sur la ville et zoom.
//
// Les contours des quartiers sont dans un groupe qui reçoit la transformation du zoom. Les triangles,
// les étiquettes et le point d'intérêt sont dans des calques à part, replacés à la main à chaque zoom
// (onZoom), pour garder leur taille à l'écran sous contrôle.

const d3 = window.d3;

const MARGE = 12;            // marge autour de la ville, en pixels
const HAUTEUR_MAX = 560;     // hauteur maximale de la carte
const ZOOM_MAX = 16;
const DUREE = 750;           // durée des transitions de zoom, en ms

// onZoom(transform) : à chaque image d'un zoom ou d'un déplacement.
// onZoomFin() : à la fin d'un geste qui a vraiment bougé la vue.
export function creerFond(cadre, { onZoom, onZoomFin }) {
  const svg = cadre.append("svg").attr("class", "t1-carte")
    .attr("role", "img")
    .attr("aria-label", "Carte des offres : chaque triangle indique si l'offre est plus ou moins chère que la médiane des hôtels ou des Airbnb");
  const zoomable = svg.append("g");
  // Ordre d'empilement : contours, triangles, étiquettes, point d'intérêt.
  const calques = {
    quartiers: zoomable.append("g").attr("class", "t1-quartiers"),
    points: svg.append("g").attr("class", "t1-points"),
    etiquettes: svg.append("g").attr("class", "t1-etiquettes"),
    poi: svg.append("g").attr("class", "t1-poi"),
  };

  const projection = d3.geoMercator();
  const chemin = d3.geoPath(projection);
  let largeur = 0;
  let hauteur = 0;
  let largeurCalee = 0;        // largeur du conteneur au dernier calage (pour ne recaler que si elle change)
  let quartierZoome = null;    // nom du quartier sur lequel on a zoomé, ou null
  let transformDebut = null;   // transformation au début d'un geste de zoom

  const zoom = d3.zoom()
    .scaleExtent([1, ZOOM_MAX])
    .clickDistance(4)        // un petit glissement ne compte pas comme un déplacement
    // Molette et pincement zooment ; glisser avec le bouton gauche déplace (les autres boutons sont ignorés).
    .filter((e) => !e.button)
    .on("start", ({ transform }) => { transformDebut = transform; })
    .on("zoom", ({ transform }) => {
      zoomable.attr("transform", transform);
      onZoom(transform);
    })
    .on("end", ({ transform }) => {
      // Simple clic (la vue n'a pas bougé) : ne rien redessiner. d3.zoom émet « end » au relâchement,
      // juste avant l'événement click ; redessiner ici réordonne les éléments (join, raise) et le navigateur
      // envoie alors le clic au groupe parent au lieu de l'offre ou du quartier cliqué.
      const t0 = transformDebut;
      if (t0 && t0.k === transform.k && t0.x === transform.x && t0.y === transform.y) return;
      if (transform.k <= 1.01) quartierZoome = null;
      onZoomFin();
    });
  svg.call(zoom).on("dblclick.zoom", null);
  // La molette sur la carte ne fait jamais défiler la page. d3.zoom laisse passer l'événement quand le zoom
  // est déjà à sa limite (dézoomer en vue d'ensemble, zoomer au maximum) : la page défilait alors à sa place.
  svg.on("wheel.bloquer", (e) => e.preventDefault(), { passive: false });

  const transform = () => d3.zoomTransform(svg.node());

  // Cale la projection sur la ville : la largeur vient du conteneur, la hauteur de la forme de la ville.
  function caler(geo, largeurConteneur) {
    largeurCalee = largeurConteneur;
    largeur = largeurConteneur || 640;
    projection.fitWidth(largeur - 2 * MARGE, geo);
    const [[, y0], [, y1]] = chemin.bounds(geo);
    hauteur = Math.min(Math.ceil(y1 - y0) + 2 * MARGE, HAUTEUR_MAX);
    projection.fitExtent([[MARGE, MARGE], [largeur - MARGE, hauteur - MARGE]], geo);
    svg.attr("viewBox", [0, 0, largeur, hauteur]).attr("width", largeur).attr("height", hauteur);
    zoom.extent([[0, 0], [largeur, hauteur]]).translateExtent([[0, 0], [largeur, hauteur]]);
  }

  // Zoom sur un quartier : son rectangle occupe 90 % de la vue (modèle « Zoom to bounding box »).
  function zoomerSur(f, duree = DUREE) {
    quartierZoome = f.properties.quartier;
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

  return {
    svg,
    calques,
    projection,
    chemin,
    get largeur() { return largeur; },
    get hauteur() { return hauteur; },
    get largeurCalee() { return largeurCalee; },
    get quartierZoome() { return quartierZoome; },
    transform,
    caler,
    zoomerSur,
    dezoomer,
    // Arrête une transition de zoom en cours (changement de ville, redimensionnement).
    interrompre() { svg.interrupt(); },
    // Écran (pixels du SVG) ↔ géographie ([lon, lat]), en tenant compte du zoom.
    versGeo: (point) => projection.invert(transform().invert(point)),
    versEcran(geo) {
      const p = projection(geo);
      return p ? transform().apply(p) : null;
    },
    estVisible(geo) {
      const p = this.versEcran(geo);
      return p != null && p[0] >= 0 && p[0] <= largeur && p[1] >= 0 && p[1] <= hauteur;
    },
  };
}
