#!/bin/sh
# Démarre MOTIS après avoir préparé ses données, s'il le faut.
#
# Tourne dans l'image MOTIS (Alpine, BusyBox), sous son utilisateur `motis`,
# avec le volume de données monté sur /data. Au premier démarrage : télécharge
# la voirie OpenStreetMap de la métropole de Lyon, copie ou télécharge l'archive GTFS TCL si
# les horaires sont activés, puis construit le graphe. Ensuite, le graphe est
# réutilisé tant que sa configuration et son archive n'ont pas changé.
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

# Extrait BBBike de la métropole (emprise 4.58,45.61,5.16,45.93), actualisé
# chaque semaine, aux chemins complets : les extraits départementaux
# d'openstreetmap.fr ont des chemins tronqués que l'import refuse.
OSM_URL="${OSM_SOURCE_URL:-https://download.bbbike.org/osm/bbbike/Lyon/Lyon.osm.pbf}"
OSM=$DATA/lyon.osm.pbf

TRANSIT="${MOTIS_TRANSIT_ENABLED:-false}"
GTFS=$DATA/tcl.gtfs.zip
GTFS_DROP=/gtfs/tcl.gtfs.zip
TIMETABLE_DAYS=60
REBUILD_AFTER_DAYS=30

# download URL DESTINATION [EN-TÊTE] — écrit dans un fichier temporaire pour ne
# jamais laisser un téléchargement interrompu passer pour une donnée valide.
# Un serveur qui cale est repris là où il s'est arrêté, jusqu'à cinq fois.
download() {
  url=$1; destination=$2; header=${3:-}
  rm -f "$destination.part"
  attempt=1
  while ! wget -c -T 60 ${header:+--header "$header"} -O "$destination.part" "$url"; do
    if [ "$attempt" -ge 5 ]; then
      echo "Téléchargement impossible après $attempt essais : $url" >&2
      return 1
    fi
    attempt=$((attempt + 1))
    echo "Reprise du téléchargement (essai $attempt)..."
    sleep 10
  done
  mv "$destination.part" "$destination"
}

checksum() { sha256sum "$1" | cut -d ' ' -f 1; }

stamp_field() { sed -n "s/^$1=//p" "$STAMP" 2>/dev/null || true; }

now=$(date +%s)
stamp_time=$(stamp_field time)
stamp_age_days=$(( (now - ${stamp_time:-$now}) / 86400 ))

if [ ! -f "$OSM" ]; then
  echo "Téléchargement de la voirie : $OSM_URL"
  download "$OSM_URL" "$OSM"
fi

if [ "$TRANSIT" = true ]; then
  if [ -f "$GTFS_DROP" ]; then
    # Archive déposée sur le poste : toujours reprise, c'est la source de vérité.
    cp "$GTFS_DROP" "$GTFS.part" && mv "$GTFS.part" "$GTFS"
  elif [ -n "${GTFS_SOURCE_URL:-}" ]; then
    # Une archive téléchargée est rafraîchie en même temps que le graphe.
    if [ ! -f "$GTFS" ] || [ "$stamp_age_days" -ge "$REBUILD_AFTER_DAYS" ]; then
      echo "Téléchargement de l'archive GTFS TCL : $GTFS_SOURCE_URL"
      header=
      if [ -n "${GTFS_USERNAME:-}" ]; then
        header="Authorization: Basic $(printf '%s:%s' "$GTFS_USERNAME" "$GTFS_PASSWORD" | base64 | tr -d '\n')"
      fi
      download "$GTFS_SOURCE_URL" "$GTFS" "$header"
    fi
  else
    echo "MOTIS_TRANSIT_ENABLED=true mais aucune archive GTFS : déposer infra/gtfs/tcl.gtfs.zip" >&2
    echo "ou renseigner GTFS_SOURCE_URL (et GTFS_USERNAME, GTFS_PASSWORD) dans .env." >&2
    exit 1
  fi
fi

cat > "$CONFIG" <<EOF
server:
  port: 8080
osm: $(basename "$OSM")
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
      path: $(basename "$GTFS")
      default_timezone: Europe/Paris
osr_footpath: true
EOF
fi

fingerprint=$(checksum "$CONFIG")
if [ "$TRANSIT" = true ]; then
  fingerprint="$fingerprint $(checksum "$GTFS")"
fi

reason=
if [ ! -d "$GRAPH" ] || [ ! -f "$STAMP" ]; then
  reason="aucun graphe"
elif [ "$(stamp_field fingerprint)" != "$fingerprint" ]; then
  reason="configuration ou archive modifiée"
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
