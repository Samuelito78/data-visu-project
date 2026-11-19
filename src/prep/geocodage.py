"""Géolocalisation des hôtels Booking (méthode et contrôles détaillés dans notebooks/04_geocodage_hotels.ipynb).

Chaîne, de la méthode la plus sûre à la plus coûteuse :
1. OpenStreetMap (Overpass) : une requête par ville, appariement flou par nom ;
2. Nominatim : géocodage par « <nom>, <ville> » pour les hôtels restants ;
3. corrections relues à la main (`data/external/hotels_geocodage_corrections.csv`).

Chaque point est ensuite contrôlé : emprise, distance au centre, quartier Booking, doublons.
Toutes les réponses des services sont mises en cache sous `data/external/cache/`.
"""
from __future__ import annotations

import fcntl
import hashlib
import json
import math
import re
import time
import unicodedata
from pathlib import Path

import numpy as np
import pandas as pd
import requests
from rapidfuzz import fuzz, process
from shapely.geometry import Point, shape
from shapely.ops import unary_union

# --------------------------------------------------------------------------------------------
# Constantes
# --------------------------------------------------------------------------------------------

RACINE = Path(__file__).resolve().parents[2]
CACHE = RACINE / "data" / "external" / "cache"
SORTIE = RACINE / "data" / "external" / "hotels_geocodage.csv"
CORRECTIONS = RACINE / "data" / "external" / "hotels_geocodage_corrections.csv"

# User-Agent propre au projet, sans adresse personnelle (règles d'usage OSM / Nominatim).
USER_AGENT = "data-visu-project-geocodage/1.0 (student project; github.com/Samuelito78/data-visu-project)"

VILLES_EN = {"london": "London", "berlin": "Berlin", "paris": "Paris", "rome": "Rome"}

# Emprises larges (sud, ouest, nord, est) : contrôle 1 et zone des requêtes.
EMPRISES = {
    "london": (51.25, -0.56, 51.72, 0.36),
    "berlin": (52.30, 13.05, 52.70, 13.80),
    "paris": (48.75, 2.15, 48.97, 2.55),
    "rome": (41.70, 12.30, 42.05, 12.75),
}

# Centres de départ, affinés ensuite par `estimer_centre`.
CENTRES_INITIAUX = {
    "london": (51.5072, -0.1276),   # Charing Cross
    "berlin": (52.5200, 13.4050),   # Alexanderplatz / Mitte
    "paris": (48.8566, 2.3522),     # Hôtel de Ville
    "rome": (41.8960, 12.4823),     # Piazza Venezia
}

# Seuils (justifiés dans le notebook 04).
# Paliers d'acceptation (similarité minimale, écart de distance maximal en km ; None = pas d'exigence).
# Plus le nom est éloigné, plus la distance au centre doit coller. Le quartier doit toujours être cohérent
# (sauf Rome) dès qu'une exigence de distance est posée.
PALIERS_OSM = [(90, None), (75, 0.5), (60, 0.15)]
PALIERS_NOMINATIM = [(60, 0.5), (45, 0.15)]
CATEGORIES_NOMINATIM = ("tourism", "amenity", "building", "leisure")   # exclut rues, quartiers, arrêts...
TOLERANCE_KM = 0.5          # écart toléré sur la distance au centre (95 % des appariements sûrs sont à < 0,1 km)
TOLERANCE_RELATIVE = 0.0    # pas de tolérance relative : le centre Booking est retrouvé à quelques mètres près
TAMPON_QUARTIER_KM = 0.2    # un point à moins de 200 m du contour est accepté (erreur de géocodage)

TYPES_OSM = "hotel|hostel|guest_house|apartment|motel"

# Mots sans valeur discriminante, retirés avant la comparaison des noms.
MOTS_GENERIQUES = {
    "hotel", "hotels", "hostel", "the", "by", "and", "an", "a", "de", "du", "des", "la", "le", "les",
    "l", "d", "et", "am", "an", "der", "die", "das", "und", "il", "di", "del", "della", "e",
    "london", "berlin", "paris", "rome", "roma", "city", "centre", "center", "central", "boutique",
    "apartment", "apartments", "appartement", "suite", "suites", "residence",
}

# --------------------------------------------------------------------------------------------
# Outils
# --------------------------------------------------------------------------------------------


def normaliser_nom(nom: str) -> str:
    """Minuscules, sans accents ni ponctuation, sans mots génériques."""
    if not isinstance(nom, str):
        return ""
    s = unicodedata.normalize("NFKD", nom).encode("ascii", "ignore").decode().lower()
    s = s.replace("&", " ").replace("'", " ")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    mots = [m for m in s.split() if m not in MOTS_GENERIQUES]
    return " ".join(mots)


def poids_idf(noms) -> dict[str, float]:
    """Poids IDF des mots (noms déjà normalisés) : un mot fréquent (« kensington », « garden ») pèse peu,
    un mot rare (« amano », « avonmore ») pèse beaucoup."""
    docs = [set(n.split()) for n in noms if n]
    nb = len(docs)
    freq: dict[str, int] = {}
    for d in docs:
        for m in d:
            freq[m] = freq.get(m, 0) + 1
    return {m: math.log((nb + 1) / (f + 0.5)) for m, f in freq.items()}


def _mot_proche(m: str, autres: list[str]) -> bool:
    if m in autres:
        return True
    return len(m) >= 5 and any(len(x) >= 5 and fuzz.ratio(m, x) >= 85 for x in autres)


def similarite(a: str, b: str, poids: dict[str, float] | None = None) -> float:
    """Similarité 0-100 entre deux noms normalisés.

    80 % : Jaccard pondéré par l'IDF, avec tolérance aux fautes de frappe sur les mots longs ;
    20 % : token_sort_ratio (caractères)."""
    if not a or not b:
        return 0.0
    ma, mb = a.split(), b.split()
    w = (lambda m: poids.get(m, max(poids.values(), default=1.0))) if poids else (lambda m: 1.0)
    commun_a = [m for m in set(ma) if _mot_proche(m, mb)]
    reste_a = [m for m in set(ma) if m not in commun_a]
    reste_b = [m for m in set(mb) if not _mot_proche(m, ma)]
    p_commun = sum(w(m) for m in commun_a)
    total = p_commun + sum(w(m) for m in reste_a) + sum(w(m) for m in reste_b)
    jaccard = 100 * p_commun / total if total else 0.0
    return 0.8 * jaccard + 0.2 * fuzz.token_sort_ratio(a, b)


def _prefiltre(a, b, **kw):
    return 0.5 * fuzz.token_set_ratio(a, b) + 0.5 * fuzz.token_sort_ratio(a, b)


def haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return 6371.0088 * 2 * np.arcsin(np.sqrt(a))


def dans_emprise(lat, lon, ville: str):
    s, o, n, e = EMPRISES[ville]
    lat, lon = np.asarray(lat, float), np.asarray(lon, float)
    return (lat >= s) & (lat <= n) & (lon >= o) & (lon <= e)


def tolerance_km(dist_annoncee_km):
    return np.maximum(TOLERANCE_KM, TOLERANCE_RELATIVE * np.asarray(dist_annoncee_km, float))


def _get_json(url: str, params: dict | None, chemin_cache: Path, delai: float = 1.0, timeout=180):
    """GET avec cache disque. Un verrou global (fichier) garantit `delai` s entre deux appels réseau,
    même quand plusieurs processus tournent en parallèle."""
    if chemin_cache.exists():
        return json.loads(chemin_cache.read_text(encoding="utf-8"))
    chemin_cache.parent.mkdir(parents=True, exist_ok=True)
    verrou = CACHE / ".rate.lock"
    verrou.parent.mkdir(parents=True, exist_ok=True)
    with open(verrou, "a+") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        try:
            f.seek(0)
            dernier = float(f.read() or 0)
            attente = dernier + delai - time.time()
            if attente > 0:
                time.sleep(attente)
            for essai in range(4):
                r = requests.get(url, params=params, headers={"User-Agent": USER_AGENT}, timeout=timeout)
                if r.status_code in (429, 502, 503, 504):
                    time.sleep(10 * (essai + 1))
                    continue
                r.raise_for_status()
                break
            else:
                r.raise_for_status()
            f.seek(0)
            f.truncate()
            f.write(str(time.time()))
        finally:
            fcntl.flock(f, fcntl.LOCK_UN)
    data = r.json()
    chemin_cache.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return data


# --------------------------------------------------------------------------------------------
# 1. OpenStreetMap via Overpass
# --------------------------------------------------------------------------------------------

OVERPASS_URL = "https://overpass-api.de/api/interpreter"


def overpass_hebergements(ville: str) -> pd.DataFrame:
    """Objets OSM `tourism=hotel|hostel|guest_house|apartment|motel` nommés dans l'emprise de la ville.
    Une ligne par (objet, variante de nom) : name, name:en, old_name, alt_name, brand+name..."""
    s, o, n, e = EMPRISES[ville]
    requete = (f'[out:json][timeout:180];nwr["tourism"~"^({TYPES_OSM})$"]["name"]'
               f'({s},{o},{n},{e});out center tags;')
    data = _get_json(OVERPASS_URL, {"data": requete}, CACHE / "osm" / f"{ville}.json", delai=5)
    lignes = []
    for el in data["elements"]:
        tags = el.get("tags", {})
        lat = el.get("lat", el.get("center", {}).get("lat"))
        lon = el.get("lon", el.get("center", {}).get("lon"))
        if lat is None:
            continue
        noms = {v for k, v in tags.items()
                if k in ("name", "name:en", "name:fr", "name:de", "name:it", "old_name", "alt_name",
                         "official_name", "short_name")}
        for nom in noms:
            lignes.append({"osm_id": f"{el['type']}/{el['id']}", "nom_osm": nom, "lat": lat, "lon": lon,
                           "tourism": tags.get("tourism"), "norm": normaliser_nom(nom)})
    return pd.DataFrame(lignes)


def poids_villes(brut: pd.DataFrame, osm: pd.DataFrame) -> dict[str, dict[str, float]]:
    """IDF par ville, calculé sur les titres Booking et les noms OSM de la ville."""
    return {v: poids_idf([normaliser_nom(t) for t in brut.loc[brut["ville_brut"] == v, "title"]]
                         + osm.loc[osm["ville_brut"] == v, "norm"].tolist())
            for v in brut["ville_brut"].unique()}


def candidats_osm(brut: pd.DataFrame, osm: pd.DataFrame, poids: dict, k: int = 5, seuil: float = 50) -> pd.DataFrame:
    """Pour chaque hôtel, les k meilleurs objets OSM (un objet compté une fois) au-dessus de `seuil`.
    Préfiltre rapide (rapidfuzz), puis score pondéré `similarite`."""
    lignes = []
    for ville, g in brut.groupby("ville_brut"):
        o = osm[osm["ville_brut"] == ville].reset_index(drop=True)
        if o.empty:
            continue
        choix = o["norm"].tolist()
        for _, h in g.iterrows():
            q = normaliser_nom(h["title"])
            if not q:
                continue
            res = process.extract(q, choix, scorer=_prefiltre, limit=40, score_cutoff=40)
            scores = sorted(((similarite(q, choix[idx], poids[ville]), idx) for _, _, idx in res), reverse=True)
            vus = set()
            for score, idx in scores:
                c = o.iloc[idx]
                if score < seuil or c["osm_id"] in vus:
                    continue
                vus.add(c["osm_id"])
                lignes.append({"link": h["link"], "lat": c["lat"], "lon": c["lon"], "nom_trouve": c["nom_osm"],
                               "similarite": round(score, 1), "osm_id": c["osm_id"], "methode": "osm"})
                if len(vus) >= k:
                    break
    return pd.DataFrame(lignes)


# --------------------------------------------------------------------------------------------
# 2. Nominatim
# --------------------------------------------------------------------------------------------

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


def nominatim(requete: str, ville: str, limite: int = 5) -> list[dict]:
    """Recherche Nominatim restreinte à l'emprise de la ville, 1 requête/s max, cache disque."""
    s, o, n, e = EMPRISES[ville]
    params = {"q": requete, "format": "jsonv2", "limit": limite, "viewbox": f"{o},{n},{e},{s}",
              "bounded": 1, "namedetails": 1}
    cle = hashlib.sha1(json.dumps(params, sort_keys=True).encode()).hexdigest()
    return _get_json(NOMINATIM_URL, params, CACHE / "nominatim" / f"{cle}.json", delai=1.1, timeout=60)


def candidats_nominatim(brut: pd.DataFrame, poids: dict, journal=print) -> pd.DataFrame:
    lignes = []
    for i, (_, h) in enumerate(brut.iterrows()):
        res = nominatim(f"{h['title']}, {VILLES_EN[h['ville_brut']]}", h["ville_brut"])
        if journal and i % 100 == 0:
            journal(f"nominatim {i}/{len(brut)}")
        q = normaliser_nom(h["title"])
        for r in res:
            nom = (r.get("namedetails") or {}).get("name") or r.get("name") or r["display_name"].split(",")[0]
            lignes.append({"link": h["link"], "lat": float(r["lat"]), "lon": float(r["lon"]), "nom_trouve": nom,
                           "similarite": round(similarite(q, normaliser_nom(nom), poids[h["ville_brut"]]), 1),
                           "osm_id": f"{r.get('osm_type')}/{r.get('osm_id')}", "methode": "nominatim",
                           "categorie": f"{r.get('category')}={r.get('type')}"})
    return pd.DataFrame(lignes)


# --------------------------------------------------------------------------------------------
# 3. Contours de quartiers (contrôle 3)
# --------------------------------------------------------------------------------------------

CONTOURS = {
    "paris": [("https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/arrondissements/exports/geojson",
               "c_ar")],
    "berlin": [("https://gdi.berlin.de/services/wfs/alkis_bezirke?service=WFS&version=2.0.0&request=GetFeature"
                "&typeNames=alkis_bezirke:bezirksgrenzen&outputFormat=application/json&srsName=EPSG:4326",
                "namgem")],
    "london": [("https://raw.githubusercontent.com/radoi90/housequest-data/master/london_boroughs.geojson",
                "name")],
    "rome": [(f"https://raw.githubusercontent.com/pierospinelli/roma-lab/master/{f}-source.geojson", champ)
             for f, champ in (("rioni", "NOME_RIONE"), ("quartieri", "NOME_QUART"), ("zone", "NOME_ZONA"))],
}

# Noms Booking -> noms de contours (handoff, section 6). Rome : correspondances approximatives.
ALIAS_QUARTIERS = {
    "london": {"Westminster Borough": ["Westminster"], "West End": ["Westminster"], "Bayswater": ["Westminster"],
               "Acton": ["Ealing"], "Chiswick": ["Hounslow"], "Muswell Hill": ["Haringey"],
               "Walthamstow": ["Waltham Forest"], "Wimbledon": ["Merton"]},
    "berlin": {"Charlottenburg": ["Charlottenburg-Wilmersdorf"], "Prenzlauer Berg": ["Pankow"]},
    "rome": {
        "Central Station": ["Esquilino", "Castro Pretorio"],
        "Spagna": ["Campo Marzio", "Colonna", "Trevi"],
        "Via Veneto": ["Ludovisi", "Sallustiano"],
        "Vaticano Prati": ["Prati", "Borgo", "Della Vittoria", "Trionfale", "Aurelio"],
        "Rione Monti": ["Monti"],
        "Pantheon": ["Pigna", "S Eustachio", "Colonna", "Campo Marzio"],
        "Trevi": ["Trevi"],
        "Navona": ["Parione", "Ponte", "S Eustachio", "Regola"],
        "Colosseo": ["Monti", "Celio", "Campitelli"],
        "Villa Borghese Parioli": ["Parioli", "Pianciano"],  # « Pianciano » : graphie du fichier source
        "Eur": ["Europa"],
        "Aventino": ["Ripa", "S Saba"],
        "San Giovanni": ["Esquilino", "Celio", "Tuscolano", "Appio Latino"],
        "San Lorenzo": ["Tiburtino", "Castro Pretorio"],
    },
}


def _canon(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def charger_contours(ville: str) -> dict[str, object]:
    """{nom canonique du contour: géométrie shapely}. Les contours téléchargés sont mis en cache."""
    contours: dict[str, list] = {}
    for i, (url, champ) in enumerate(CONTOURS[ville]):
        data = _get_json(url, None, CACHE / "contours" / f"{ville}_{i}.geojson", delai=1, timeout=120)
        for f in data["features"]:
            nom = f["properties"].get(champ)
            if nom is None or f.get("geometry") is None:
                continue
            nom = str(int(nom)) if ville == "paris" else str(nom)
            contours.setdefault(_canon(nom), []).append(shape(f["geometry"]))
    return {k: unary_union(v) for k, v in contours.items()}


def contours_attendus(location: str, ville: str, contours: dict) -> list[str] | None:
    """Noms canoniques des contours compatibles avec le `location` Booking ; None si pas de contour."""
    if not isinstance(location, str):
        return None
    nom = re.sub(rf",\s*{VILLES_EN[ville]}$", "", location.strip()).strip()
    if not nom or nom == VILLES_EN[ville] or nom == "Rome City Center":
        return None
    if ville == "paris":
        m = re.match(r"^(\d+)", nom)
        return [m.group(1)] if m else None
    cands = [_canon(x) for x in ALIAS_QUARTIERS.get(ville, {}).get(nom, [])]
    if _canon(nom) in contours:
        cands.append(_canon(nom))
    if ville == "rome" and not cands:
        # Noms romains approximatifs : appariement flou avec les rioni, quartieri et zone.
        res = process.extract(_canon(nom), list(contours), scorer=fuzz.token_set_ratio, score_cutoff=85, limit=3)
        cands = [r[0] for r in res]
    cands = [c for c in cands if c in contours]
    return cands or None


def controle_quartier(lat: float, lon: float, attendus: list[str] | None, contours: dict):
    if attendus is None or pd.isna(lat):
        return None
    p = Point(lon, lat)
    tampon = TAMPON_QUARTIER_KM / 111.0
    return any(contours[c].distance(p) <= tampon for c in attendus)


# --------------------------------------------------------------------------------------------
# 4. Centre de référence
# --------------------------------------------------------------------------------------------


def estimer_centre(lat, lon, dist_km, depart: tuple[float, float]) -> tuple[float, float, float]:
    """Point qui minimise l'écart absolu médian entre distance recalculée et distance annoncée.
    Recherche par grilles successives (pas de 2 km, puis 200 m, puis 20 m). Renvoie (lat, lon, écart médian)."""
    lat, lon, dist_km = (np.asarray(x, float) for x in (lat, lon, dist_km))
    c_lat, c_lon = depart
    for pas_km in (2.0, 0.2, 0.02):
        dlat = pas_km / 111.0
        dlon = pas_km / (111.0 * math.cos(math.radians(c_lat)))
        meilleur = None
        for i in range(-10, 11):
            for j in range(-10, 11):
                la, lo = c_lat + i * dlat, c_lon + j * dlon
                err = np.median(np.abs(haversine_km(lat, lon, la, lo) - dist_km))
                if meilleur is None or err < meilleur[2]:
                    meilleur = (la, lo, err)
        c_lat, c_lon, err = meilleur
    return c_lat, c_lon, err


# --------------------------------------------------------------------------------------------
# 5. Contrôles et choix
# --------------------------------------------------------------------------------------------


def evaluer(cands: pd.DataFrame, hotels_info: pd.DataFrame, centres: dict, contours: dict) -> pd.DataFrame:
    """Ajoute à chaque candidat : emprise, écart de distance, contrôle de quartier, cohérence."""
    c = cands.merge(hotels_info[["link", "ville_brut", "dist_km", "attendus"]], on="link", how="left")
    c["emprise"] = [bool(dans_emprise(la, lo, v)) for la, lo, v in zip(c["lat"], c["lon"], c["ville_brut"])]
    cl = np.array([centres[v][0] for v in c["ville_brut"]])
    co = np.array([centres[v][1] for v in c["ville_brut"]])
    c["ecart_dist_km"] = np.round(np.abs(haversine_km(c["lat"], c["lon"], cl, co) - c["dist_km"]), 2)
    c["dist_ok"] = c["ecart_dist_km"] <= tolerance_km(c["dist_km"])
    c["controle_quartier"] = [controle_quartier(la, lo, a, contours[v])
                              for la, lo, a, v in zip(c["lat"], c["lon"], c["attendus"], c["ville_brut"])]
    # Rome : contrôle de quartier seulement indicatif (noms Booking approximatifs).
    quartier_ok = [q is not False or v == "rome" for q, v in zip(c["controle_quartier"], c["ville_brut"])]
    c["coherent"] = c["emprise"] & c["dist_ok"] & np.array(quartier_ok)
    return c


def choisir(c: pd.DataFrame, paliers: list[tuple[float, float | None]]) -> pd.DataFrame:
    """Un candidat par hôtel parmi ceux qui passent un palier : d'abord les cohérents, puis la meilleure
    similarité. Palier (s, None) : similarité >= s suffit ; (s, tol) : il faut aussi la cohérence
    complète et un écart de distance <= tol."""
    if c.empty:
        return c
    ok = pd.Series(False, index=c.index)
    for seuil, tol in paliers:
        if tol is None:
            ok |= c["similarite"] >= seuil
        else:
            ok |= (c["similarite"] >= seuil) & c["coherent"] & (c["ecart_dist_km"] <= tol)
    c = c[ok & c["emprise"]].sort_values(["link", "coherent", "similarite"], ascending=[True, False, False])
    return c.drop_duplicates("link")


def choisir_sans_doublons(c: pd.DataFrame, paliers, tours: int = 5) -> pd.DataFrame:
    """Comme `choisir`, mais un objet OSM pris par plusieurs hôtels reste à celui qui a la meilleure
    similarité ; les autres passent à leur candidat suivant."""
    c = c.copy()
    for _ in range(tours):
        ch = choisir(c, paliers)
        ch = ch.sort_values(["coherent", "similarite"], ascending=False)
        perdants = ch[ch.duplicated("osm_id", keep="first")]
        if perdants.empty:
            break
        retirer = set(zip(perdants["link"], perdants["osm_id"]))
        c = c[[(l, o) not in retirer for l, o in zip(c["link"], c["osm_id"])]]
    return ch


def marquer_doublons(df: pd.DataFrame) -> pd.Series:
    """True pour un hôtel dont les coordonnées exactes sont déjà prises par un hôtel mieux apparié."""
    d = df[df["lat"].notna()].sort_values("similarite", ascending=False)
    dup = d.duplicated(subset=["ville_brut", "lat", "lon"], keep="first")
    return dup.reindex(df.index, fill_value=False)


def infos_hotels(brut: pd.DataFrame, contours: dict) -> pd.DataFrame:
    from . import hotels
    info = brut[["link", "ville_brut", "title", "location"]].copy()
    info["dist_km"] = hotels.distance_km(brut["distanceFromCenter"].astype(float)).values
    info["attendus"] = [contours_attendus(loc, v, contours[v]) for loc, v in zip(info["location"], info["ville_brut"])]
    return info


COLONNES_SORTIE = ["link", "ville_brut", "lat", "lon", "methode", "nom_trouve", "similarite",
                   "ecart_dist_km", "controle_quartier", "fiable"]


def finaliser(choix: pd.DataFrame, info: pd.DataFrame) -> pd.DataFrame:
    """Table de sortie : une ligne par hôtel, colonnes du contrat (handoff, section 4)."""
    out = info[["link", "ville_brut"]].merge(choix.drop(columns=["ville_brut"], errors="ignore"), on="link", how="left")
    out["doublon"] = marquer_doublons(out)
    out["fiable"] = out["lat"].notna() & out["coherent"].fillna(False).astype(bool) & ~out["doublon"]
    return out


def ecrire(out: pd.DataFrame, chemin: Path = SORTIE) -> None:
    t = out[COLONNES_SORTIE].copy()
    t["lat"] = t["lat"].round(6)
    t["lon"] = t["lon"].round(6)
    for col in ("controle_quartier", "fiable"):
        t[col] = t[col].map({True: "true", False: "false"})
    chemin.parent.mkdir(parents=True, exist_ok=True)
    t.to_csv(chemin, index=False)


def charger_corrections(chemin: Path = CORRECTIONS) -> pd.DataFrame:
    """Corrections relues à la main : link, lat, lon, methode, nom_trouve, similarite, note."""
    if not chemin.exists():
        return pd.DataFrame(columns=["link", "lat", "lon", "methode", "nom_trouve", "similarite", "note"])
    return pd.read_csv(chemin, dtype={"link": str})


# --------------------------------------------------------------------------------------------
# 6. Chaîne complète
# --------------------------------------------------------------------------------------------


def geocoder(brut: pd.DataFrame, avec_nominatim: bool = True, journal=print):
    journal = journal or (lambda *a: None)
    """Enchaîne OSM -> Nominatim -> corrections manuelles et renvoie (sortie, centres, candidats)."""
    villes = sorted(brut["ville_brut"].unique())
    contours = {v: charger_contours(v) for v in villes}
    info = infos_hotels(brut, contours)
    osm = pd.concat([overpass_hebergements(v).assign(ville_brut=v) for v in villes], ignore_index=True)
    poids = poids_villes(brut, osm)
    c_osm = candidats_osm(brut, osm, poids)

    # Centre : départ approximatif, puis estimation sur les appariements OSM les plus sûrs.
    centres = {v: CENTRES_INITIAUX[v] for v in villes}
    for _ in range(2):
        ev = evaluer(c_osm, info, centres, contours)
        surs = ev[(ev["similarite"] >= 97) & ev["emprise"] & (ev["controle_quartier"] != False)]
        surs = surs.sort_values("similarite", ascending=False).drop_duplicates("link")
        for v in villes:
            s = surs[surs["ville_brut"] == v]
            la, lo, err = estimer_centre(s["lat"], s["lon"], s["dist_km"], CENTRES_INITIAUX[v])
            centres[v] = (la, lo)
            journal(f"centre {v}: {la:.5f}, {lo:.5f} (écart médian {err:.2f} km, n={len(s)})")
    ev_osm = evaluer(c_osm, info, centres, contours)
    choix = choisir_sans_doublons(ev_osm, PALIERS_OSM)

    tous = [ev_osm]
    if avec_nominatim:
        fiables = set(choix.loc[choix["coherent"], "link"])
        reste = brut[~brut["link"].isin(fiables)]
        journal(f"nominatim pour {len(reste)} hôtels")
        c_nom = candidats_nominatim(reste, poids, journal=journal)
        if not c_nom.empty:
            ev_nom = evaluer(c_nom, info, centres, contours)
            tous.append(ev_nom)
            ev_nom = ev_nom[ev_nom["categorie"].str.split("=").str[0].isin(CATEGORIES_NOMINATIM)]
            ch_nom = choisir(ev_nom, PALIERS_NOMINATIM)  # Nominatim : toujours avec contrôles
            ch_nom = ch_nom[ch_nom["coherent"]]
            # Nominatim remplace OSM seulement quand OSM n'a rien de cohérent.
            choix = pd.concat([choix[~choix["link"].isin(ch_nom["link"]) | choix["coherent"]],
                               ch_nom[~ch_nom["link"].isin(choix.loc[choix["coherent"], "link"])]])
            choix = choix.drop_duplicates("link")

    corr = charger_corrections()
    if not corr.empty:
        ev_corr = evaluer(corr[["link", "lat", "lon", "methode", "nom_trouve", "similarite"]], info, centres, contours)
        choix = pd.concat([ev_corr, choix[~choix["link"].isin(ev_corr["link"])]])
        # Une correction manuelle relue fait foi pour le quartier et la distance, mais reste contrôlée.
    out = finaliser(choix, info)
    candidats = pd.concat(tous, ignore_index=True)
    return out, centres, candidats, info
