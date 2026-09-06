#!/usr/bin/env bash
# Prépare les données du moteur d'itinéraires MOTIS.
#
# À lancer une fois, puis après chaque nouvelle archive GTFS. MOTIS construit un
# graphe unique à partir de la voirie OpenStreetMap, des horaires GTFS et des
# flux GBFS Vélo'v et Dott, lus à l'exécution. Il calcule ensuite sur les
# calendriers de l'archive : une archive périmée ne produit aucun trajet en
# transport aux dates courantes, d'où l'archive officielle exigée ici.
#
# Prérequis : docker, et GTFS_SOURCE_URL dans .env (jeton transport.data.gouv.fr,
# voir .env.example). `osmium` est facultatif : s'il est installé, la région est
# découpée autour de Lyon, ce qui divise par dix le temps d'import.
set -euo pipefail

ENGINE="${CONTAINER_ENGINE:-docker}"
IMAGE="ghcr.io/motis-project/motis:latest"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$ROOT/infra/motis-data"
REGION_URL="https://download.geofabrik.de/europe/france/rhone-alpes-latest.osm.pbf"
# Boîte englobant la métropole, un peu plus large que le rayon de 16 km du feed.
BBOX="4.60,45.60,5.05,45.95"

command -v "$ENGINE" >/dev/null || {
  echo "Erreur : '$ENGINE' introuvable. Installer docker, ou définir CONTAINER_ENGINE." >&2
  exit 1
}

if [ -f "$ROOT/.env" ]; then
  # shellcheck disable=SC1091
  set -a; . "$ROOT/.env"; set +a
fi
: "${GTFS_SOURCE_URL:?GTFS_SOURCE_URL absent : renseigner .env (voir .env.example)}"

mkdir -p "$DATA_DIR"

if [ ! -f "$DATA_DIR/rhone-alpes.osm.pbf" ]; then
  echo "Téléchargement de l'extrait Rhône-Alpes (~400 Mo)..."
  curl -L --fail --progress-bar -o "$DATA_DIR/rhone-alpes.osm.pbf" "$REGION_URL"
fi

OSM="rhone-alpes.osm.pbf"
if command -v osmium >/dev/null; then
  if [ ! -f "$DATA_DIR/lyon.osm.pbf" ]; then
    echo "Découpage de la métropole..."
    osmium extract --bbox "$BBOX" --overwrite -o "$DATA_DIR/lyon.osm.pbf" "$DATA_DIR/rhone-alpes.osm.pbf"
  fi
  OSM="lyon.osm.pbf"
fi

echo "Téléchargement de l'archive GTFS TCL..."
curl -L --fail --progress-bar -o "$DATA_DIR/tcl.gtfs.zip" "$GTFS_SOURCE_URL"

cat > "$DATA_DIR/config.yml" <<EOF
server:
  port: 8080
osm: $OSM
timetable:
  first_day: TODAY
  num_days: 60
  datasets:
    tcl:
      path: tcl.gtfs.zip
      default_timezone: Europe/Paris
street_routing: true
osr_footpath: true
geocoding: false
reverse_geocoding: false
gbfs:
  feeds:
    velov:
      url: https://api.cyclocity.fr/contracts/lyon/gbfs/v3/gbfs.json
    dott:
      url: https://gbfs.api.ridedott.com/public/v2/lyon/gbfs.json
EOF

mkdir -p "$DATA_DIR/data"
echo "Construction du graphe MOTIS (voirie, horaires, correspondances)..."
"$ENGINE" run --rm -v "$DATA_DIR:/data" -w /data "$IMAGE" /motis import -c /data/config.yml -d /data/data

echo
echo "Données prêtes dans $DATA_DIR/data. Lancer : docker compose -f infra/compose.yml up -d"
