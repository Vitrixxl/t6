#!/usr/bin/env bash
# Prépare les données du moteur d'itinéraires MOTIS.
#
# À lancer une fois, puis après chaque nouvelle archive GTFS. MOTIS construit un
# graphe unique à partir de la voirie OpenStreetMap, des horaires GTFS et des
# flux GBFS Vélo'v et Dott, lus à l'exécution. Il calcule ensuite sur les
# calendriers de l'archive : une archive périmée ne produit aucun trajet en
# transport aux dates courantes. Les horaires sont désactivés par défaut.
#
# Prérequis : docker et curl. Les accès GTFS ne sont requis que pour une
# future activation des horaires (MOTIS_TRANSIT_ENABLED=true). `osmium` est facultatif : s'il est installé, la région est
# découpée autour de Lyon, ce qui divise par dix le temps d'import.
set -euo pipefail

ENGINE="${CONTAINER_ENGINE:-docker}"
IMAGE="ghcr.io/motis-project/motis@sha256:6055f51eec43eeed28524037ca0161b96efe9cd05728eaa9ac04c20c2826d330"
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
mkdir -p "$DATA_DIR"

# Les horaires sont reportés : aucun compte externe n’est nécessaire au mode
# voirie et véhicules partagés. L’activation future doit rester explicite.
WITH_TRANSIT="${MOTIS_TRANSIT_ENABLED:-false}"
if [ "$WITH_TRANSIT" = true ]; then
  : "${GTFS_SOURCE_URL:?Renseigner GTFS_SOURCE_URL pour activer les horaires}"
  GTFS_AUTH=()
  if [[ -n "${GTFS_USERNAME:-}" || -n "${GTFS_PASSWORD:-}" ]]; then
    : "${GTFS_USERNAME:?GTFS_USERNAME absent}"
    : "${GTFS_PASSWORD:?GTFS_PASSWORD absent}"
    GTFS_AUTH=(--user "$GTFS_USERNAME:$GTFS_PASSWORD")
  fi
  echo "Téléchargement de l’archive GTFS TCL..."
  curl "${GTFS_AUTH[@]}" -L --fail --progress-bar -o "$DATA_DIR/tcl.gtfs.zip.part" "$GTFS_SOURCE_URL"
  mv "$DATA_DIR/tcl.gtfs.zip.part" "$DATA_DIR/tcl.gtfs.zip"
else
  echo "Préparation sans horaires TCL : marche et véhicules partagés uniquement."
fi

OSM="lyon.osm.pbf"
if [ ! -f "$DATA_DIR/$OSM" ]; then
  if [ ! -f "$DATA_DIR/rhone-alpes.osm.pbf" ]; then
    echo "Téléchargement de l'extrait Rhône-Alpes..."
    curl -L --fail --progress-bar -o "$DATA_DIR/rhone-alpes.osm.pbf.part" "$REGION_URL"
    mv "$DATA_DIR/rhone-alpes.osm.pbf.part" "$DATA_DIR/rhone-alpes.osm.pbf"
  fi
  OSM="rhone-alpes.osm.pbf"
  if command -v osmium >/dev/null; then
    echo "Découpage de la métropole..."
    osmium extract --bbox "$BBOX" --overwrite -o "$DATA_DIR/lyon.osm.pbf" "$DATA_DIR/rhone-alpes.osm.pbf"
    OSM="lyon.osm.pbf"
  fi
fi

cat > "$DATA_DIR/config.yml" <<EOF
server:
  port: 8080
osm: $OSM
street_routing: true
geocoding: false
reverse_geocoding: false
gbfs:
  feeds:
    velov:
      url: https://api.cyclocity.fr/contracts/lyon/gbfs/v3/gbfs.json
    dott:
      url: https://gbfs.api.ridedott.com/public/v2/lyon/gbfs.json
EOF

if [ "$WITH_TRANSIT" = true ]; then
  cat >> "$DATA_DIR/config.yml" <<EOF
timetable:
  first_day: TODAY
  num_days: 60
  datasets:
    tcl:
      path: tcl.gtfs.zip
      default_timezone: Europe/Paris
osr_footpath: true
EOF
fi

mkdir -p "$DATA_DIR/data"
echo "Construction du graphe MOTIS..."
"$ENGINE" run --rm -u "$(id -u):$(id -g)" -v "$DATA_DIR:/data" -w /data "$IMAGE" /motis import -c /data/config.yml -d /data/data

echo
echo "Données prêtes dans $DATA_DIR/data. Lancer : docker compose -f infra/compose.yml up -d"
