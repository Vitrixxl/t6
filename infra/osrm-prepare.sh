#!/usr/bin/env bash
# Prépare les données OSRM pour le calcul d'itinéraires local.
#
# A lancer une fois. Trois jeux de données sont produits, un par profil :
# piéton, vélo et voiture n'ont pas les mêmes règles sur les mêmes rues (sens
# uniques, escaliers, zones piétonnes) et ne peuvent donc pas partager un
# index. La trottinette utilise le profil vélo ; la voiture reste une référence
# carbone invisible et n'est jamais proposée.
#
# Prérequis : docker. `osmium` est facultatif : s'il est installe,
# la région est découpée autour de Lyon, ce qui divise par dix le temps de
# prétraitement. Sinon toute la région Rhône-Alpes est traitée — plus long, mais
# sans dépendance supplémentaire, et le résultat est identique sur Lyon.
set -euo pipefail

ENGINE="${CONTAINER_ENGINE:-docker}"
IMAGE="ghcr.io/project-osrm/osrm-backend:latest"
DATA_DIR="$(cd "$(dirname "$0")" && pwd)/osrm-data"
REGION_URL="https://download.geofabrik.de/europe/france/rhone-alpes-latest.osm.pbf"
# Boite englobant la métropole, un peu plus large que le rayon de 16 km du feed.
BBOX="4.60,45.60,5.05,45.95"

command -v "$ENGINE" >/dev/null || {
  echo "Erreur : '$ENGINE' introuvable. Installer docker, ou définir CONTAINER_ENGINE." >&2
  exit 1
}

mkdir -p "$DATA_DIR"

if [ ! -f "$DATA_DIR/rhone-alpes.osm.pbf" ]; then
  echo "Téléchargement de l'extrait Rhône-Alpes (~400 Mo)..."
  curl -L --fail --progress-bar -o "$DATA_DIR/rhone-alpes.osm.pbf" "$REGION_URL"
fi

SOURCE="$DATA_DIR/rhone-alpes.osm.pbf"
if command -v osmium >/dev/null; then
  if [ ! -f "$DATA_DIR/lyon.osm.pbf" ]; then
    echo "Découpage de la métropole..."
    osmium extract --bbox "$BBOX" --overwrite -o "$DATA_DIR/lyon.osm.pbf" "$SOURCE"
  fi
  SOURCE="$DATA_DIR/lyon.osm.pbf"
else
  echo "osmium absent : toute la région Rhône-Alpes sera traitée (comptez"
  echo "une dizaine de minutes par profil, et ~8 Go de mémoire au pic)."
fi

# `mld` est l'algorithme adapte à un graphe qui tient en mémoire : prétraitement
# rapide, et requêtes en microsecondes une fois le service demarre.
for profile in foot bike car; do
  echo
  echo "=== Profil $profile ==="
  lua_profile="$profile"
  if [ "$profile" = bike ]; then
    lua_profile=bicycle
  fi
  cp "$SOURCE" "$DATA_DIR/lyon-$profile.osm.pbf"
  for step in "osrm-extract -p /opt/$lua_profile.lua /data/lyon-$profile.osm.pbf" \
              "osrm-partition /data/lyon-$profile.osrm" \
              "osrm-customize /data/lyon-$profile.osrm"; do
    # shellcheck disable=SC2086
    "$ENGINE" run --rm -v "$DATA_DIR:/data" "$IMAGE" $step
  done
  rm -f "$DATA_DIR/lyon-$profile.osm.pbf"
done

echo
echo "Données prêtes. Demarrer la pile serveur :"
echo "  docker compose -f infra/compose.yml up -d"
echo
echo "L'API y est incluse et vise le calculateur local : rien a configurer."
echo "Le même serveur sert le client et l’API."
echo
echo "Pour utiliser le calculateur local depuis une API lancée hors conteneur,"
echo "publier les trois ports sur loopback (voir README) et renseigner .env :"
echo "  OSRM_FOOT_URL=http://127.0.0.1:5001"
echo "  OSRM_BIKE_URL=http://127.0.0.1:5002"
echo "  OSRM_CAR_URL=http://127.0.0.1:5003"
echo "Chaque variable absente ou vide utilise le profil public correspondant."
