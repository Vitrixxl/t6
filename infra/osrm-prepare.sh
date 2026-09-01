#!/usr/bin/env bash
# Prepare les donnees OSRM pour la metropole de Lyon.
#
# A lancer une fois. Le decoupage evite de traiter toute la region : l'extrait
# Rhone-Alpes pese quelques centaines de Mo, la boite de Lyon quelques dizaines,
# et le pretraitement passe de plusieurs minutes a moins d'une.
#
# Prerequis : podman (ou docker) et osmium-tool.
set -euo pipefail

ENGINE="${CONTAINER_ENGINE:-podman}"
DATA_DIR="$(cd "$(dirname "$0")" && pwd)/osrm-data"
REGION_URL="https://download.geofabrik.de/europe/france/rhone-alpes-latest.osm.pbf"
# Boite englobant la metropole, un peu plus large que le rayon de 16 km du feed.
BBOX="4.60,45.60,5.05,45.95"

mkdir -p "$DATA_DIR"

if [ ! -f "$DATA_DIR/rhone-alpes.osm.pbf" ]; then
  echo "Telechargement de l'extrait Rhone-Alpes..."
  curl -L --fail -o "$DATA_DIR/rhone-alpes.osm.pbf" "$REGION_URL"
fi

if [ ! -f "$DATA_DIR/lyon.osm.pbf" ]; then
  echo "Decoupage de la metropole..."
  osmium extract --bbox "$BBOX" --overwrite \
    -o "$DATA_DIR/lyon.osm.pbf" "$DATA_DIR/rhone-alpes.osm.pbf"
fi

# Un jeu de donnees par profil. `mld` est l'algorithme adapte a un graphe qui
# tient en memoire : pretraitement rapide, requetes en microsecondes.
for profile in foot bike car; do
  echo "Pretraitement du profil $profile..."
  cp "$DATA_DIR/lyon.osm.pbf" "$DATA_DIR/lyon-$profile.osm.pbf"
  "$ENGINE" run --rm -v "$DATA_DIR:/data" ghcr.io/project-osrm/osrm-backend:latest \
    osrm-extract -p "/opt/$profile.lua" "/data/lyon-$profile.osm.pbf"
  "$ENGINE" run --rm -v "$DATA_DIR:/data" ghcr.io/project-osrm/osrm-backend:latest \
    osrm-partition "/data/lyon-$profile.osrm"
  "$ENGINE" run --rm -v "$DATA_DIR:/data" ghcr.io/project-osrm/osrm-backend:latest \
    osrm-customize "/data/lyon-$profile.osrm"
done

echo
echo "Donnees pretes. Demarrer les services :"
echo "  $ENGINE compose -f infra/osrm-compose.yml up -d"
echo
echo "Puis dans .env :"
echo "  OSRM_BASE_URL=http://127.0.0.1:5000"
echo "(un reverse proxy doit exposer /routed-foot, /routed-bike et /routed-car"
echo " vers les ports 5001, 5002 et 5003)"
