"""Fusion des deux sources, contrôles qualité et export des fichiers statiques chargés par D3."""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from .common import VILLES, masque_aberrants
from .schema import COLONNES, conformer, valider


def fusionner(*sources: pd.DataFrame) -> pd.DataFrame:
    """Concatène des tables déjà conformes au schéma."""
    return valider(conformer(pd.concat([valider(s) for s in sources], ignore_index=True)))


def ajouter_positions_hotels(df: pd.DataFrame, liens: pd.DataFrame, geocodage: pd.DataFrame) -> pd.DataFrame:
    """Remplit lat/lon des hôtels dont le géocodage est fiable (jointure id -> lien -> coordonnées)."""
    sur = geocodage[geocodage["fiable"].astype(bool)].set_index("link")[["lat", "lon"]]
    pos = liens.set_index("id")["link"].map(sur["lat"]).rename("lat").to_frame()
    pos["lon"] = liens.set_index("id")["link"].map(sur["lon"])
    out = df.copy()
    est_hotel = out["source"] == "Hôtel"
    for col in ("lat", "lon"):
        out.loc[est_hotel, col] = out.loc[est_hotel, "id"].map(pos[col]).astype("Float64")
    return valider(conformer(out))


def ajouter_quartiers(df: pd.DataFrame, contours, correspondance: pd.DataFrame) -> pd.DataFrame:
    """Remplit `quartier` avec le nom du contour (même référentiel pour les deux sources).

    - ligne avec lat/lon : jointure spatiale (Airbnb, et hôtels une fois géocodés) ;
    - sinon : nom de quartier Booking traduit par la table de correspondance.
    """
    from .quartiers import rattacher_noms, rattacher_points

    out = df.copy()
    par_nom = rattacher_noms(out, correspondance)
    par_point = rattacher_points(out, contours)["quartier_geo"]
    out["quartier"] = par_point.fillna(par_nom).astype("string")
    return valider(conformer(out))


def couverture_quartiers(df: pd.DataFrame, contours) -> pd.DataFrame:
    """Nombre d'offres par quartier et par source, y compris les quartiers vides."""
    t = df.groupby(["ville", "quartier", "source"], observed=True).size().unstack("source", fill_value=0)
    tous = pd.MultiIndex.from_frame(contours[["ville", "quartier"]])
    return t.reindex(tous, fill_value=0)


def retirer_aberrants(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Renvoie (table nettoyée, lignes écartées) selon les percentiles par ville et par source."""
    m = masque_aberrants(df)
    return df[~m].reset_index(drop=True), df[m].reset_index(drop=True)


def bilan_effectifs(avant: pd.DataFrame, apres: pd.DataFrame) -> pd.DataFrame:
    """Nombre de lignes par ville et par source, avant et après nettoyage."""
    cle = ["ville", "source"]
    b = pd.concat({
        "avant": avant.groupby(cle, observed=True).size(),
        "apres": apres.groupby(cle, observed=True).size(),
    }, axis=1)
    b["ecartees"] = b["avant"] - b["apres"]
    return b


def valeurs_manquantes(df: pd.DataFrame) -> pd.DataFrame:
    """Part de valeurs manquantes par colonne et par source (en %)."""
    return (df.isna().groupby(df["source"], observed=True).mean().T * 100).round(1)


def _vers_csv(df: pd.DataFrame) -> pd.DataFrame:
    """Format lisible par d3.csv + d3.autoType : booléens true/false, vides pour les manquants."""
    out = df.copy()
    for col, dtype in COLONNES.items():
        if dtype == "boolean":
            out[col] = out[col].map({True: "true", False: "false"}).astype("string")
    for col in ["prix_nuit_eur", "note_100", "dist_centre_km"]:
        out[col] = out[col].round(2)
    return out


def exporter(df: pd.DataFrame, dossier: str | Path) -> list[Path]:
    """Écrit offres.csv et un offres_<ville>.csv par ville. Renvoie les chemins écrits."""
    dossier = Path(dossier)
    dossier.mkdir(parents=True, exist_ok=True)
    csv = _vers_csv(df)
    chemins = [dossier / "offres.csv"]
    csv.to_csv(chemins[0], index=False)
    for libelle, _, slug in VILLES.values():
        p = dossier / f"offres_{slug}.csv"
        csv[csv["ville"] == libelle].to_csv(p, index=False)
        chemins.append(p)
    return chemins
