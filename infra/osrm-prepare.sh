#!/usr/bin/env bash
# Prepare les donnees OSRM pour le calcul d'itineraires local.
#
# A lancer une fois. Deux jeux de donnees sont produits, un par profil :
# pieton et velo n'ont pas les memes regles sur les memes rues (sens uniques,
# escaliers, zones pietonnes) et ne peuvent donc pas partager un index. La
# trottinette utilise le profil velo ; aucun trajet voiture n'est propose.
#
# Prerequis : docker. `osmium` est facultatif : s'il est installe,
# la region est decoupee autour de Lyon, ce qui divise par dix le temps de
# pretraitement. Sinon toute la region Rhone-Alpes est traitee — plus long, mais
# sans dependance supplementaire, et le resultat est identique sur Lyon.
set -euo pipefail

ENGINE="${CONTAINER_ENGINE:-docker}"
IMAGE="ghcr.io/project-osrm/osrm-backend:latest"
DATA_DIR="$(cd "$(dirname "$0")" && pwd)/osrm-data"
REGION_URL="https://download.geofabrik.de/europe/france/rhone-alpes-latest.osm.pbf"
# Boite englobant la metropole, un peu plus large que le rayon de 16 km du feed.
BBOX="4.60,45.60,5.05,45.95"

command -v "$ENGINE" >/dev/null || {
  echo "Erreur : '$ENGINE' introuvable. Installer docker, ou definir CONTAINER_ENGINE." >&2
  exit 1
}

mkdir -p "$DATA_DIR"

if [ ! -f "$DATA_DIR/rhone-alpes.osm.pbf" ]; then
  echo "Telechargement de l'extrait Rhone-Alpes (~400 Mo)..."
  curl -L --fail --progress-bar -o "$DATA_DIR/rhone-alpes.osm.pbf" "$REGION_URL"
fi

SOURCE="$DATA_DIR/rhone-alpes.osm.pbf"
if command -v osmium >/dev/null; then
  if [ ! -f "$DATA_DIR/lyon.osm.pbf" ]; then
    echo "Decoupage de la metropole..."
    osmium extract --bbox "$BBOX" --overwrite -o "$DATA_DIR/lyon.osm.pbf" "$SOURCE"
  fi
  SOURCE="$DATA_DIR/lyon.osm.pbf"
else
  echo "osmium absent : toute la region Rhone-Alpes sera traitee (comptez"
  echo "une dizaine de minutes par profil, et ~8 Go de memoire au pic)."
fi

# `mld` est l'algorithme adapte a un graphe qui tient en memoire : pretraitement
# rapide, et requetes en microsecondes une fois le service demarre.
for profile in foot bike; do
  echo
  echo "=== Profil $profile ==="
  cp "$SOURCE" "$DATA_DIR/lyon-$profile.osm.pbf"
  for step in "osrm-extract -p /opt/$profile.lua /data/lyon-$profile.osm.pbf" \
              "osrm-partition /data/lyon-$profile.osrm" \
              "osrm-customize /data/lyon-$profile.osrm"; do
    # shellcheck disable=SC2086
    "$ENGINE" run --rm -v "$DATA_DIR:/data" "$IMAGE" $step
  done
  rm -f "$DATA_DIR/lyon-$profile.osm.pbf"
done

echo
echo "Donnees pretes. Demarrer la pile serveur :"
echo "  docker compose -f infra/compose.yml up -d"
echo
echo "L'API y est incluse et vise le calculateur local : rien a configurer."
echo "Le client reste lance a part, par bun run dev."
echo
echo "Pour utiliser le calculateur local depuis une API lancee hors conteneur,"
echo "publier le port de la facade et renseigner dans .env :"
echo "  OSRM_BASE_URL=http://127.0.0.1:5000"
echo "Tant que cette ligne est absente ou vide, l'application utilise"
echo "l'instance publique : rien a defaire pour revenir en arriere."
