#!/bin/sh
# Genere un certificat au premier demarrage s'il n'y en a pas.
#
# Le chiffrement n'est pas ici une precaution de production : le navigateur
# reserve au contexte securise la geolocalisation, `crypto.randomUUID` et le
# service worker. Sans HTTPS, l'application ne fonctionne que sur localhost —
# donc pas depuis un telephone du reseau local.
#
# Le certificat est auto-signe : le navigateur affichera un avertissement a
# accepter une fois. Pour l'eviter, monter dans /certs un certificat emis par
# une autorite reconnue de l'appareil (mkcert, par exemple).
set -eu

CERT="${TLS_CERT_PATH:-/certs/cert.pem}"
KEY="${TLS_KEY_PATH:-/certs/key.pem}"

if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
  echo "Aucun certificat dans /certs : generation d'un certificat auto-signe."
  # Les adresses alternatives couvrent l'acces local et l'acces par IP du
  # reseau : un certificat qui ne nomme pas l'hote consulte est refuse.
  ALT="DNS:localhost,IP:127.0.0.1"
  for ip in $(hostname -i 2>/dev/null || true); do
    ALT="$ALT,IP:$ip"
  done
  if [ -n "${TLS_EXTRA_HOSTS:-}" ]; then
    ALT="$ALT,$TLS_EXTRA_HOSTS"
  fi

  openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
    -keyout "$KEY" -out "$CERT" \
    -subj "/CN=urbanflow.local" \
    -addext "subjectAltName=$ALT" > /dev/null 2>&1
  echo "Certificat genere pour : $ALT"
fi

exec "$@"
