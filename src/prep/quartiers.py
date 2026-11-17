"""Contours des quartiers et rattachement des offres à un quartier.

Niveau retenu par ville (voir docs/decisions.md, D16) :
Paris = 20 arrondissements, Berlin = 12 Bezirke, Londres = 33 boroughs, Rome = 15 municipi.
"""
from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
import pandas as pd
from shapely.geometry import LineString, MultiPolygon, Polygon
from shapely.geometry.polygon import orient
from shapely.ops import polygonize, unary_union

from .common import VILLES

CRS_WGS84 = "EPSG:4326"
CRS_METRIQUE = "EPSG:3035"  # Europe LAEA, en mètres : pour les distances et la simplification

# Un point hors de tout contour est rattaché au contour le plus proche s'il est à moins de cette distance.
# Cas typique : une annonce géolocalisée au bord d'une limite simplifiée ou de la frontière de la ville.
DISTANCE_MAX_PROCHE_M = 250

# Tolérance de simplification des contours exportés pour D3 (en mètres).
TOLERANCE_SIMPLIFICATION_M = 25

_ROMAINS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"]


def nom_arrondissement(n: int) -> str:
    """Même libellé que celui produit par hotels.normaliser_quartier."""
    return f"{n}{'er' if n == 1 else 'e'} arrondissement"


def _paris(dossier: Path) -> gpd.GeoDataFrame:
    g = gpd.read_file(dossier / "paris_arrondissements.geojson")
    return gpd.GeoDataFrame({
        "ville": "Paris",
        "quartier": g["c_ar"].astype(int).map(nom_arrondissement),
        "code": g["c_arinsee"].astype(str),
        "ordre": g["c_ar"].astype(int),
    }, geometry=g.geometry, crs=g.crs)


def _berlin(dossier: Path) -> gpd.GeoDataFrame:
    g = gpd.read_file(dossier / "berlin_bezirke.geojson")
    return gpd.GeoDataFrame({
        "ville": "Berlin",
        "quartier": g["namgem"],
        "code": g["gem"].astype(str),
        "ordre": g["gem"].astype(int),
    }, geometry=g.geometry, crs=g.crs)


def _londres(dossier: Path) -> gpd.GeoDataFrame:
    # Limites « BFE » de l'ONS : elles couvrent la Tamise. La version « Excluding MHW » du London Datastore
    # s'arrêtait aux berges et laissait un vide à la place du fleuve, absent des autres villes.
    g = gpd.read_file(dossier / "london_boroughs_bfe.geojson").to_crs(CRS_WGS84)
    return gpd.GeoDataFrame({
        "ville": "Londres",
        "quartier": g["LAD23NM"],
        "code": g["LAD23CD"],
        "ordre": g["LAD23CD"].str[-3:].astype(int),
    }, geometry=g.geometry, crs=CRS_WGS84)


def _polygone_osm(relation: dict) -> Polygon | MultiPolygon:
    """Reconstitue le contour d'une relation OSM (« out geom ») à partir de ses chemins extérieurs."""
    lignes = [LineString([(p["lon"], p["lat"]) for p in m["geometry"]])
              for m in relation["members"] if m["type"] == "way" and m.get("role") == "outer"]
    polygones = list(polygonize(unary_union(lignes)))
    if not polygones:
        raise ValueError(f"contour non reconstituable : {relation['tags'].get('name')}")
    return unary_union(polygones)


def _rome(dossier: Path) -> gpd.GeoDataFrame:
    data = json.loads((dossier / "rome_municipi_osm.json").read_text(encoding="utf-8"))
    lignes = []
    for rel in data["elements"]:
        romain = rel["tags"]["name"].removeprefix("Municipio Roma").strip()
        lignes.append({
            "ville": "Rome",
            "quartier": f"Municipio {romain}",
            "code": romain,
            "ordre": _ROMAINS.index(romain) + 1,
            "geometry": _polygone_osm(rel),
        })
    return gpd.GeoDataFrame(lignes, geometry="geometry", crs=CRS_WGS84)


def charger_contours(dossier: str | Path) -> gpd.GeoDataFrame:
    """Contours des 4 villes, normalisés : ville, quartier, code, ordre, geometry (WGS84)."""
    dossier = Path(dossier)
    morceaux = [_londres(dossier), _berlin(dossier), _paris(dossier), _rome(dossier)]
    g = pd.concat(morceaux, ignore_index=True)
    g = gpd.GeoDataFrame(g, geometry="geometry", crs=CRS_WGS84)
    g["geometry"] = g.geometry.make_valid()
    return g.sort_values(["ville", "ordre"]).reset_index(drop=True)


def rattacher_points(df: pd.DataFrame, contours: gpd.GeoDataFrame) -> pd.DataFrame:
    """Pour chaque ligne qui a lat/lon, trouve le quartier qui contient le point (même ville).

    Renvoie un DataFrame indexé comme `df` : quartier_geo, methode_geo ('contenu', 'proche', vide).
    """
    out = pd.DataFrame({"quartier_geo": pd.Series(pd.NA, index=df.index, dtype="string"),
                        "methode_geo": pd.Series(pd.NA, index=df.index, dtype="string")})
    avec_pos = df[df["lat"].notna() & df["lon"].notna()]
    for ville, pts in avec_pos.groupby("ville", observed=True):
        zones = contours[contours["ville"] == ville][["quartier", "geometry"]].to_crs(CRS_METRIQUE)
        g = gpd.GeoDataFrame(index=pts.index, geometry=gpd.points_from_xy(pts["lon"].astype(float),
                             pts["lat"].astype(float)), crs=CRS_WGS84).to_crs(CRS_METRIQUE)
        dedans = gpd.sjoin(g, zones, how="left", predicate="within")
        dedans = dedans[~dedans.index.duplicated()]
        trouve = dedans["quartier"].notna()
        out.loc[dedans.index[trouve], "quartier_geo"] = dedans.loc[trouve, "quartier"]
        out.loc[dedans.index[trouve], "methode_geo"] = "contenu"
        reste = g.loc[dedans.index[~trouve]]
        if len(reste):
            proche = gpd.sjoin_nearest(reste, zones, how="left", max_distance=DISTANCE_MAX_PROCHE_M)
            proche = proche[~proche.index.duplicated() & proche["quartier"].notna()]
            out.loc[proche.index, "quartier_geo"] = proche["quartier"]
            out.loc[proche.index, "methode_geo"] = "proche"
    return out


def charger_correspondance(chemin: str | Path) -> pd.DataFrame:
    """Table écrite à la main : nom de quartier Booking -> contour (colonnes ville, nom_booking, quartier, ...)."""
    return pd.read_csv(chemin, dtype="string")


def rattacher_noms(df: pd.DataFrame, correspondance: pd.DataFrame) -> pd.Series:
    """Quartier du contour à partir du nom Booking (colonne `quartier` de df), via la table de correspondance."""
    cle = correspondance.set_index(["ville", "nom_booking"])["quartier"]
    paires = pd.MultiIndex.from_arrays([df["ville"].astype("string"), df["quartier"].astype("string")])
    return pd.Series(cle.reindex(paires).to_numpy(), index=df.index, dtype="string")


def pour_d3(contours: gpd.GeoDataFrame, tolerance_m: float = TOLERANCE_SIMPLIFICATION_M) -> gpd.GeoDataFrame:
    """Simplifie et oriente les contours pour d3.geoPath (anneau extérieur dans le sens horaire)."""
    g = contours.to_crs(CRS_METRIQUE)
    g["geometry"] = g.geometry.simplify(tolerance_m, preserve_topology=True)
    g = g.to_crs(CRS_WGS84)
    # d3-geo est sphérique : il attend l'inverse de la convention RFC 7946 (sens anti-horaire).
    g["geometry"] = g.geometry.map(_orienter_horaire)
    return g


def _orienter_horaire(geom):
    if isinstance(geom, Polygon):
        return orient(geom, sign=-1.0)
    if isinstance(geom, MultiPolygon):
        return MultiPolygon([orient(p, sign=-1.0) for p in geom.geoms])
    return geom


def exporter_contours(contours: gpd.GeoDataFrame, dossier: str | Path, prefixe: str = "quartiers",
                      decimales: int = 5) -> list[Path]:
    """Écrit un GeoJSON par ville (<prefixe>_<slug>.geojson). Renvoie les chemins écrits."""
    dossier = Path(dossier)
    dossier.mkdir(parents=True, exist_ok=True)
    chemins = []
    for libelle, _, slug in VILLES.values():
        g = contours[contours["ville"] == libelle][["ville", "quartier", "code", "geometry"]]
        p = dossier / f"{prefixe}_{slug}.geojson"
        texte = g.to_json(drop_id=True, ensure_ascii=False)
        p.write_text(_arrondir(texte, decimales) if decimales is not None else texte, encoding="utf-8")
        chemins.append(p)
    return chemins


def _arrondir(geojson: str, decimales: int) -> str:
    """Arrondit les coordonnées (5 décimales ≈ 1 m) pour alléger les fichiers chargés par le navigateur."""
    data = json.loads(geojson)

    def r(c):
        return [r(x) for x in c] if isinstance(c[0], list) else [round(c[0], decimales), round(c[1], decimales)]

    for f in data["features"]:
        f["geometry"]["coordinates"] = r(f["geometry"]["coordinates"])
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"))
