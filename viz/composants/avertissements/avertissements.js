// Message d'erreur affiché au-dessus des vues quand une ville ne se charge pas (serveur absent,
// fichier introuvable). Il disparaît dès qu'une ville se charge.

const d3 = window.d3;

export function creerAvertissements(conteneur, etat) {
  const racine = d3.select(conteneur);

  etat.on("donnees", () => racine.selectAll("p").remove());
  etat.on("erreur", (_, erreur) => {
    racine.selectAll("p").remove();
    racine.append("p").attr("class", "avertissement erreur")
      .text(`Impossible de charger les données (${erreur.message}). Lancez ./scripts/serve.sh à la racine du dépôt, puis ouvrez http://localhost:8000/viz/.`);
  });
}
