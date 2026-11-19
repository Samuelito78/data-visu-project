// Points d'intérêt : les lieux prédéfinis de chaque ville et le type du glisser-déposer du point perso.
// Lu par le panneau (points-interet.js) et par la carte (technique-1/poi.js), qui accepte le dépôt.

// Type des données glissées. Un type propre (et pas text/plain) : les champs de texte ne l'acceptent pas.
export const TYPE_DEPOT_POI = "application/x-point-interet";

// Coordonnées WGS84, longitude puis latitude, relevées dans les registres officiels du patrimoine
// (licences : README.md, section Sources). `source` cite la fiche : elle s'affiche au survol du lieu.
//   Paris : base Mérimée (monuments historiques) et base Muséofile (musées de France), ministère de la Culture,
//           champ des coordonnées WGS84 de la notice.
//   Berlin : Denkmaldatenbank du Landesdenkmalamt (service WFS « denkmale » du Geoportal Berlin) ; le point est
//            le centroïde du contour officiel du monument.
//   Londres : National Heritage List for England (Historic England), point de la fiche « Listed Building ».
//   Rome : pas de registre officiel accessible ; centroïde du contour OpenStreetMap, comme les contours des municipi.
export const POINTS_INTERET = {
  paris: [
    { id: "tour-eiffel", nom: "Tour Eiffel", lon: 2.294505, lat: 48.858264, source: "Mérimée PA00088801" },
    { id: "arc-triomphe", nom: "Arc de Triomphe", lon: 2.295041, lat: 48.873780, source: "Mérimée PA00088804" },
    { id: "louvre", nom: "Musée du Louvre", lon: 2.337816, lat: 48.860795, source: "Muséofile M5031" },
    { id: "notre-dame", nom: "Notre-Dame", lon: 2.350051, lat: 48.852937, source: "Mérimée PA00086250" },
    { id: "sacre-coeur", nom: "Sacré-Cœur", lon: 2.343566, lat: 48.885419, source: "Mérimée PA75180004" },
    { id: "opera-garnier", nom: "Opéra Garnier", lon: 2.331791, lat: 48.872031, source: "Mérimée PA00089004" },
  ],
  berlin: [
    { id: "brandebourg", nom: "Porte de Brandebourg", lon: 13.37777, lat: 52.51627, source: "Denkmaldatenbank 09065019" },
    { id: "reichstag", nom: "Reichstag", lon: 13.37596, lat: 52.51860, source: "Denkmaldatenbank 09050341" },
    { id: "ile-musees", nom: "Île aux Musées", lon: 13.39804, lat: 52.52030, source: "Denkmaldatenbank 09030065" },
    { id: "berliner-dom", nom: "Cathédrale de Berlin", lon: 13.40107, lat: 52.51909, source: "Denkmaldatenbank 09030066" },
    { id: "fernsehturm", nom: "Tour de télévision (Alexanderplatz)", lon: 13.40922, lat: 52.52073, source: "Denkmaldatenbank 09065023" },
    { id: "checkpoint-charlie", nom: "Checkpoint Charlie", lon: 13.38955, lat: 52.50798, source: "Denkmaldatenbank 09097852" },
  ],
  londres: [
    { id: "westminster", nom: "Palais de Westminster (Big Ben)", lon: -0.12467, lat: 51.49948, source: "NHLE 1226284" },
    { id: "buckingham", nom: "Palais de Buckingham", lon: -0.14291, lat: 51.50075, source: "NHLE 1239087" },
    { id: "national-gallery", nom: "National Gallery (Trafalgar Square)", lon: -0.12869, lat: 51.50889, source: "NHLE 1066236" },
    { id: "british-museum", nom: "British Museum", lon: -0.12692, lat: 51.51945, source: "NHLE 1130404" },
    { id: "saint-paul", nom: "Cathédrale Saint-Paul", lon: -0.09850, lat: 51.51377, source: "NHLE 1079157" },
    { id: "tour-londres", nom: "Tour de Londres", lon: -0.07604, lat: 51.50808, source: "NHLE 1260258" },
  ],
  rome: [
    { id: "colisee", nom: "Colisée", lon: 12.492346, lat: 41.890267, source: "OpenStreetMap relation 1834818" },
    { id: "trevi", nom: "Fontaine de Trevi", lon: 12.483317, lat: 41.900953, source: "OpenStreetMap relation 13448560" },
    { id: "pantheon", nom: "Panthéon", lon: 12.476829, lat: 41.898602, source: "OpenStreetMap relation 3374342" },
    { id: "navona", nom: "Piazza Navona", lon: 12.473098, lat: 41.898910, source: "OpenStreetMap way 4247138" },
    { id: "place-espagne", nom: "Place d'Espagne", lon: 12.482227, lat: 41.905812, source: "OpenStreetMap relation 13474926" },
    { id: "saint-pierre", nom: "Basilique Saint-Pierre", lon: 12.453730, lat: 41.902154, source: "OpenStreetMap way 244159210" },
  ],
};
