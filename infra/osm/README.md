# Voirie OpenStreetMap de la métropole

`lyon.osm.pbf` est l'extrait OpenStreetMap sur lequel le conteneur MOTIS
construit son graphe de voirie (accès à pied, à vélo et référence voiture).
Il est versionné pour que `docker compose up` n'ait rien à télécharger.

Source : [extrait Rhône-Alpes Geofabrik](https://download.geofabrik.de/europe/france/rhone-alpes.html)
téléchargé le 4 septembre 2026, découpé avec osmium-tool sur l'emprise
`4.60,45.60,5.05,45.95` (ouest, sud, est, nord), chemins complets.

© les contributeurs OpenStreetMap. Données redistribuées sous
[Open Database License 1.0 (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/).
[Attribution et droits](https://www.openstreetmap.org/copyright).

Pour actualiser : remplacer le fichier, le moteur reconstruit son graphe au
démarrage suivant.
