"""Source B : 7500 hotels from Airbnb, Booking and Hotels.com (Kaggle, mykhailozub).

On ne garde que la liste `bookingHotels` : c'est la seule qui porte les étoiles, le quartier,
la distance au centre et l'accès au métro (voir docs/decisions.md).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np
import pandas as pd

from .common import USD_PAR_EUR, VILLES, generer_ids, tranche_distance
from .schema import conformer

FICHIERS = {"london": "London", "berlin": "Berlin", "paris": "Paris", "rome": "Rome"}

# Villes dont les prix Booking ne sont pas comparables aux autres (voir docs/decisions.md, D7).
VILLES_PRIX_NON_COMPARABLES = {"Rome"}


def _nombre(x):
    """Les champs numériques contiennent parfois le texte « No rating »."""
    return x if isinstance(x, (int, float)) else np.nan


def charger_brut(dossier: str | Path, liste: str = "bookingHotels") -> pd.DataFrame:
    """Aplatit une des trois listes du JSON pour les 4 villes communes."""
    dossier = Path(dossier)
    lignes = []
    for cle, fichier in FICHIERS.items():
        data = json.loads((dossier / f"{fichier}.json").read_text(encoding="utf-8"))
        for h in data[liste]:
            prix = h.get("price") or {}
            note = h.get("rating")
            note = note if isinstance(note, dict) else {"score": note}
            lignes.append({
                "ville_brut": cle,
                "title": h.get("title"),
                "stars": h.get("stars"),
                "location": h.get("location"),
                "subwayAccess": h.get("subwayAccess"),
                "distanceFromCenter": h.get("distanceFromCenter"),
                "highlights": " | ".join(h.get("highlights") or h.get("subtitles") or []),
                "currency": prix.get("currency"),
                "price": prix.get("value"),
                "taxesAndCharges": prix.get("taxesAndCharges"),
                "period": prix.get("period"),
                "score": _nombre(note.get("score")),
                "reviews": _nombre(note.get("reviews")),
                "link": h.get("link"),
            })
    return pd.DataFrame(lignes)


def dedoublonner(brut: pd.DataFrame) -> pd.DataFrame:
    """Un établissement = un lien Booking dans une ville."""
    return brut.drop_duplicates(subset=["ville_brut", "link"]).reset_index(drop=True)


def distance_km(d: pd.Series) -> pd.Series:
    """Le champ mélange km et mètres : « 450 m » a été lu 450. Les valeurs >= 100 sont des mètres."""
    return d.where(d < 100, d / 1000)


_ORDINAL = re.compile(r"^(\d+)(?:st|nd|rd|th) arr\.$")


def normaliser_quartier(location: str, ville_en: str) -> str | None:
    """« 7th arr., Paris » -> « 7e arrondissement » ; « Mitte, Berlin » -> « Mitte » ; « Rome » -> None."""
    if not isinstance(location, str):
        return None
    nom = re.sub(rf",\s*{ville_en}$", "", location.strip()).strip()
    if not nom or nom == ville_en:
        return None
    m = _ORDINAL.match(nom)
    if m:
        n = int(m.group(1))
        return f"{n}{'er' if n == 1 else 'e'} arrondissement"
    return nom


def transformer(brut: pd.DataFrame) -> pd.DataFrame:
    """Passe du format brut Booking au schéma commun (voir docs/schema.md)."""
    ville = brut["ville_brut"].map({k: v[0] for k, v in VILLES.items()})
    # Prix affiché seul : `taxesAndCharges` manque pour 95 % des hôtels de Londres et 58 % de
    # Berlin, et vaut 2 à 5 % du prix ailleurs (taxe de séjour). Voir docs/decisions.md, D4.
    prix_usd = brut["price"]
    logement_entier = brut["highlights"].str.contains(r"\bEntire ", regex=True, na=False)
    out = pd.DataFrame({
        "ville": ville,
        "source": "Hôtel",
        "type": np.where(logement_entier, "Logement entier", "Hôtel"),
        "etoiles": brut["stars"].astype("Float64").round().astype("Int64"),
        "nom": brut["title"],
        "prix_nuit_eur": prix_usd / USD_PAR_EUR,
        "prix_comparable": ~ville.isin(VILLES_PRIX_NON_COMPARABLES),
        "note_100": brut["score"] * 10,
        "nb_avis": brut["reviews"].astype("Float64").round().astype("Int64"),
        "dist_centre_km": distance_km(brut["distanceFromCenter"].astype(float)),
        "metro_proche": brut["subwayAccess"].astype(bool),
        "quartier": [normaliser_quartier(loc, FICHIERS[v]) for loc, v in
                     zip(brut["location"], brut["ville_brut"])],
    })
    out["tranche_dist"] = tranche_distance(out["dist_centre_km"])
    out = out.sort_values("ville", kind="stable").reset_index(drop=True)
    out["id"] = generer_ids(out, "H")
    return conformer(out)
