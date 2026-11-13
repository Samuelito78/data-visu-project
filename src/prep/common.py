"""Constantes et fonctions partagées par les deux sources.

Toute valeur choisie ici (taux, seuils, tranches) est justifiée dans docs/decisions.md.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

# Villes communes aux deux datasets : clé brute -> (libellé, code d'identifiant, slug de fichier)
VILLES = {
    "london": ("Londres", "LON", "londres"),
    "berlin": ("Berlin", "BER", "berlin"),
    "paris": ("Paris", "PAR", "paris"),
    "rome": ("Rome", "ROM", "rome"),
}
LIBELLES_VILLES = [v[0] for v in VILLES.values()]

# Taux de référence BCE, moyenne annuelle 2023 : 1 EUR = 1,0813 USD (année de collecte des hôtels).
USD_PAR_EUR = 1.0813

# Une annonce Airbnb est « proche du métro » si la station la plus proche est à moins de 500 m.
METRO_SEUIL_KM = 0.5

# Tranches de distance au centre (bornes en km, intervalle fermé à gauche).
TRANCHES_BORNES = [0, 1, 2, 4, np.inf]
TRANCHES_LIBELLES = ["0–1 km", "1–2 km", "2–4 km", "> 4 km"]

# « Centre » de référence de chaque ville : le point depuis lequel Booking mesure distanceFromCenter,
# estimé par le géocodage des hôtels (docs/decisions.md, G1). Airbnb n'utilise pas le même
# point à Berlin (Alexanderplatz) ni à Rome (gare Termini) : on recalcule donc sa distance depuis ce centre (D18).
CENTRES = {
    "Londres": (51.50774, -0.12789),   # Charing Cross / Trafalgar Square
    "Berlin": (52.51622, 13.37657),    # porte de Brandebourg
    "Paris": (48.85642, 2.35138),      # Hôtel de Ville
    "Rome": (41.89582, 12.48230),      # piazza Venezia
}

# Écrêtage des prix aberrants : percentiles calculés par ville et par source.
PERCENTILES_ABERRANTS = (0.01, 0.99)


def haversine_km(lat1, lon1, lat2, lon2):
    """Distance à vol d'oiseau en km (rayon terrestre moyen)."""
    p = np.pi / 180
    dlat, dlon = (np.asarray(lat2) - lat1) * p, (np.asarray(lon2) - lon1) * p
    a = np.sin(dlat / 2) ** 2 + np.cos(np.asarray(lat1) * p) * np.cos(np.asarray(lat2) * p) * np.sin(dlon / 2) ** 2
    return 2 * 6371.0088 * np.arcsin(np.sqrt(a))


def distance_au_centre(ville: pd.Series, lat: pd.Series, lon: pd.Series) -> pd.Series:
    """Distance de chaque point au centre de référence de sa ville (CENTRES)."""
    c_lat = ville.map({v: c[0] for v, c in CENTRES.items()}).astype(float)
    c_lon = ville.map({v: c[1] for v, c in CENTRES.items()}).astype(float)
    return pd.Series(haversine_km(lat.astype(float), lon.astype(float), c_lat, c_lon), index=ville.index)


def tranche_distance(dist_km: pd.Series) -> pd.Series:
    """Range chaque distance dans une tranche ordonnée."""
    return pd.cut(
        dist_km,
        bins=TRANCHES_BORNES,
        labels=TRANCHES_LIBELLES,
        right=False,
        ordered=True,
    )


def generer_ids(df: pd.DataFrame, lettre_source: str) -> pd.Series:
    """Identifiants stables du type PAR-A-00001, numérotés par ville dans l'ordre courant."""
    code = df["ville"].map({lib: code for lib, code, _ in VILLES.values()})
    rang = df.groupby("ville", observed=True).cumcount() + 1
    return code + f"-{lettre_source}-" + rang.map("{:05d}".format)


def masque_aberrants(df: pd.DataFrame, col: str = "prix_nuit_eur",
                     par: tuple[str, ...] = ("ville", "source"),
                     q: tuple[float, float] = PERCENTILES_ABERRANTS) -> pd.Series:
    """True pour les lignes dont `col` sort de l'intervalle [q_bas, q_haut] de leur groupe."""
    g = df.groupby(list(par), observed=True)[col]
    bas = g.transform("quantile", q[0])
    haut = g.transform("quantile", q[1])
    return (df[col] < bas) | (df[col] > haut)
