"""Schéma de la table commune : le contrat entre les notebooks de source et la fusion.

Chaque notebook de source appelle `valider(df)` avant d'écrire dans data/interim/.
Les colonnes sont résumées dans docs/3-workflow.md ; ce fichier fait foi.
"""
from __future__ import annotations

import pandas as pd

from .common import LIBELLES_VILLES, TRANCHES_LIBELLES

# Ordre des colonnes et type pandas attendu.
COLONNES: dict[str, str] = {
    "id": "string",
    "ville": "category",
    "source": "category",
    "type": "category",
    "etoiles": "Int64",
    "nom": "string",
    "prix_nuit_eur": "float64",
    "prix_comparable": "boolean",
    "note_100": "Float64",
    "nb_avis": "Int64",
    "dist_centre_km": "float64",
    "tranche_dist": "category",
    "metro_proche": "boolean",
    "quartier": "string",
    "lat": "Float64",
    "lon": "Float64",
    "periode": "category",
    "capacite": "Int64",
    "superhost": "boolean",
}

VALEURS_AUTORISEES = {
    "ville": set(LIBELLES_VILLES),
    "source": {"Airbnb", "Hôtel"},
    "type": {"Logement entier", "Chambre privée", "Chambre partagée", "Hôtel"},
    "tranche_dist": set(TRANCHES_LIBELLES),
    "periode": {"semaine", "weekend"},
}

# Colonnes qui ne doivent jamais être vides.
OBLIGATOIRES = ["id", "ville", "source", "type", "prix_nuit_eur", "prix_comparable",
                "dist_centre_km", "tranche_dist", "metro_proche"]


def conformer(df: pd.DataFrame) -> pd.DataFrame:
    """Réordonne les colonnes et applique les types du schéma (colonnes absentes -> vides)."""
    out = df.reindex(columns=list(COLONNES))
    for col, dtype in COLONNES.items():
        out[col] = out[col].astype(dtype)
    out["tranche_dist"] = out["tranche_dist"].cat.set_categories(TRANCHES_LIBELLES, ordered=True)
    return out


def valider(df: pd.DataFrame) -> pd.DataFrame:
    """Lève une AssertionError détaillée si `df` ne respecte pas le schéma. Renvoie df sinon."""
    erreurs: list[str] = []

    if list(df.columns) != list(COLONNES):
        erreurs.append(f"colonnes : attendu {list(COLONNES)}, obtenu {list(df.columns)}")
    else:
        for col, dtype in COLONNES.items():
            if str(df[col].dtype) != dtype:
                erreurs.append(f"{col} : type {df[col].dtype}, attendu {dtype}")

        for col, autorisees in VALEURS_AUTORISEES.items():
            inconnues = set(df[col].dropna().unique()) - autorisees
            if inconnues:
                erreurs.append(f"{col} : valeurs inattendues {sorted(map(str, inconnues))}")

        for col in OBLIGATOIRES:
            n = int(df[col].isna().sum())
            if n:
                erreurs.append(f"{col} : {n} valeurs manquantes")

        if df["id"].duplicated().any():
            erreurs.append(f"id : {int(df['id'].duplicated().sum())} doublons")
        if (df["prix_nuit_eur"] <= 0).any():
            erreurs.append("prix_nuit_eur : valeurs <= 0")
        if not df["note_100"].dropna().between(0, 100).all():
            erreurs.append("note_100 : valeurs hors [0, 100]")
        if (df["dist_centre_km"] < 0).any():
            erreurs.append("dist_centre_km : valeurs négatives")
        if not df["etoiles"].dropna().between(1, 5).all():
            erreurs.append("etoiles : valeurs hors [1, 5]")

    if erreurs:
        raise AssertionError("Schéma non respecté :\n- " + "\n- ".join(erreurs))
    return df
