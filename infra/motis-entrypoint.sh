#!/bin/sh
# Démarre MOTIS après avoir préparé ses données, s'il le faut.
#
# Tourne dans l'image MOTIS (Alpine, BusyBox), sous son utilisateur `motis`,
# avec le volume de données monté sur /data. Au premier démarrage : lit la
# voirie OpenStreetMap et l'archive GTFS TCL versionnées (infra/osm et
# infra/gtfs, montés en lecture seule), puis construit le graphe. Ensuite, le
# graphe est réutilisé tant que la voirie, la configuration et l'archive n'ont
# pas changé.
#
# L'import fixe le calendrier des horaires au jour de l'import, sur 60 jours :
# avec horaires, le graphe est reconstruit après 30 jours pour que la fenêtre
# reste couverte. Sans horaires, il ne bouge plus.
set -eu

DATA=/data
GRAPH=$DATA/data
STAMP=$DATA/graph.stamp
CONFIG=$DATA/config.yml
# Les chemins de la configuration sont relatifs au répertoire courant.
cd "$DATA"

OSM=/osm/lyon.osm.pbf

TRANSIT="${MOTIS_TRANSIT_ENABLED:-true}"
GTFS=/gtfs/tcl.gtfs.zip
TIMETABLE_DAYS=60
REBUILD_AFTER_DAYS=30

checksum() { sha256sum "$1" | cut -d ' ' -f 1; }

stamp_field() { sed -n "s/^$1=//p" "$STAMP" 2>/dev/null || true; }

now=$(date +%s)
stamp_time=$(stamp_field time)
stamp_age_days=$(( (now - ${stamp_time:-$now}) / 86400 ))

if [ ! -f "$OSM" ]; then
  echo "Voirie absente : $OSM doit être montée depuis infra/osm/lyon.osm.pbf." >&2
  exit 1
fi

if [ "$TRANSIT" = true ] && [ ! -f "$GTFS" ]; then
  echo "Archive GTFS absente : $GTFS doit être montée depuis infra/gtfs/tcl.gtfs.zip." >&2
  exit 1
fi

cat > "$CONFIG" <<EOF
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

if [ "$TRANSIT" = true ]; then
  cat >> "$CONFIG" <<EOF
timetable:
  first_day: TODAY
  num_days: $TIMETABLE_DAYS
  datasets:
    tcl:
      path: $GTFS
      default_timezone: Europe/Paris
osr_footpath: true
EOF
fi

fingerprint="$(checksum "$CONFIG") $(checksum "$OSM")"
if [ "$TRANSIT" = true ]; then
  fingerprint="$fingerprint $(checksum "$GTFS")"
fi

reason=
if [ ! -d "$GRAPH" ] || [ ! -f "$STAMP" ]; then
  reason="aucun graphe"
elif [ "$(stamp_field fingerprint)" != "$fingerprint" ]; then
  reason="voirie, configuration ou archive modifiée"
elif [ "$TRANSIT" = true ] && [ "$stamp_age_days" -ge "$REBUILD_AFTER_DAYS" ]; then
  reason="horaires importés il y a $stamp_age_days jours"
fi

if [ -n "$reason" ]; then
  echo "Construction du graphe MOTIS ($reason)..."
  rm -rf "$GRAPH" "$STAMP"
  mkdir -p "$GRAPH"
  /motis import -c "$CONFIG" -d "$GRAPH"
  printf 'fingerprint=%s\ntime=%s\n' "$fingerprint" "$now" > "$STAMP"
else
  echo "Graphe MOTIS réutilisé (importé il y a $stamp_age_days jours)."
fi

exec /motis server -d "$GRAPH"
