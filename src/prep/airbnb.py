"""Source A : Airbnb Prices in European Cities (Kaggle, thedevastator)."""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from .common import METRO_SEUIL_KM, VILLES, distance_au_centre, generer_ids, tranche_distance
from .schema import conformer

PERIODES = {"weekdays": "semaine", "weekends": "weekend"}
TYPES = {
    "Entire home/apt": "Logement entier",
    "Private room": "Chambre privée",
    "Shared room": "Chambre partagée",
}


def charger_brut(dossier: str | Path) -> pd.DataFrame:
    """Concatène les 8 CSV des villes communes, avec la ville et la période en colonnes."""
    dossier = Path(dossier)
    morceaux = []
    for cle in VILLES:
        for suffixe in PERIODES:
            df = pd.read_csv(dossier / f"{cle}_{suffixe}.csv").drop(columns="Unnamed: 0")
            df.insert(0, "periode_brut", suffixe)
            df.insert(0, "ville_brut", cle)
            morceaux.append(df)
    return pd.concat(morceaux, ignore_index=True)


def dedoublonner(brut: pd.DataFrame) -> pd.DataFrame:
    """Retire les lignes strictement identiques au sein d'une même ville et d'une même période."""
    return brut.drop_duplicates().reset_index(drop=True)


def transformer(brut: pd.DataFrame) -> pd.DataFrame:
    """Passe du format brut au schéma commun (voir src/prep/schema.py)."""
    out = pd.DataFrame({
        "ville": brut["ville_brut"].map({k: v[0] for k, v in VILLES.items()}),
        "source": "Airbnb",
        "type": brut["room_type"].map(TYPES),
        # realSum = prix total pour 2 personnes et 2 nuits -> prix par nuit du logement
        "prix_nuit_eur": brut["realSum"] / 2,
        "prix_comparable": True,
        "note_100": brut["guest_satisfaction_overall"],
        # Distance recalculée depuis le centre Booking, pour que les deux sources partagent la même
        # référence. La distance d'origine `dist` part d'un autre point à Berlin et à Rome.
        "dist_centre_km": distance_au_centre(
            brut["ville_brut"].map({k: v[0] for k, v in VILLES.items()}), brut["lat"], brut["lng"]),
        "metro_proche": brut["metro_dist"] < METRO_SEUIL_KM,
        "lat": brut["lat"],
        "lon": brut["lng"],
        "periode": brut["periode_brut"].map(PERIODES),
        "capacite": brut["person_capacity"].round().astype("Int64"),
        "superhost": brut["host_is_superhost"],
    })
    out["tranche_dist"] = tranche_distance(out["dist_centre_km"])
    out = out.sort_values(["ville", "periode"], kind="stable").reset_index(drop=True)
    out["id"] = generer_ids(out, "A")
    return conformer(out)
