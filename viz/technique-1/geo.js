// Technique 1 : calculs géographiques sur la sphère terrestre, en degrés [longitude, latitude].

const R = 6371;              // rayon moyen de la Terre, en km
const RAD = Math.PI / 180;

// Distance à vol d'oiseau entre deux points (formule de haversine), en km.
export function distanceKm([lon1, lat1], [lon2, lat2]) {
  const dLat = (lat2 - lat1) * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Cap initial pour aller du premier point au second, en radians (0 = nord, sens horaire).
export function capInitial([lon1, lat1], [lon2, lat2]) {
  const y = Math.sin((lon2 - lon1) * RAD) * Math.cos(lat2 * RAD);
  const x = Math.cos(lat1 * RAD) * Math.sin(lat2 * RAD)
    - Math.sin(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.cos((lon2 - lon1) * RAD);
  return Math.atan2(y, x);
}

// Point atteint en partant de [lon, lat] sur `distance` km, au cap `cap` (radians).
export function destination([lon, lat], distance, cap) {
  const d = distance / R;
  const phi1 = lat * RAD;
  const lambda1 = lon * RAD;
  const phi2 = Math.asin(Math.sin(phi1) * Math.cos(d) + Math.cos(phi1) * Math.sin(d) * Math.cos(cap));
  const lambda2 = lambda1 + Math.atan2(
    Math.sin(cap) * Math.sin(d) * Math.cos(phi1),
    Math.cos(d) - Math.sin(phi1) * Math.sin(phi2)
  );
  return [((lambda2 / RAD + 540) % 360) - 180, phi2 / RAD];
}
