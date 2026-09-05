# Réseau routier de recette

`lyon-roads.osm.pbf` est un extrait réel OpenStreetMap de Lyon et Villeurbanne,
réservé aux moteurs OSRM jetables de `bun run ci`. Il n’est ni servi au client
ni utilisé par la pile de production. Ce n’est pas une réponse de routage simulée :
les trois profils calculent leurs propres index puis leurs routes et matrices.

Source : [extrait Rhône-Alpes Geofabrik](https://download.geofabrik.de/europe/france/rhone-alpes.html),
téléchargé pour la préparation locale le 4 septembre 2026, puis découpé le
5 septembre. Emprise : `4.78,45.72,4.95,45.81` (ouest, sud, est, nord).
Les objets hors du périmètre nécessaires à la complétude des chemins et relations
peuvent rester dans l’extrait. Ce jeu couvre les parcours de recette, pas toute la métropole.

© les contributeurs OpenStreetMap. Données et extrait redistribués sous
[Open Database License 1.0 (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/).
[Attribution et droits](https://www.openstreetmap.org/copyright).

Reproduction avec osmium-tool 1.18.0, depuis l’extrait métropolitain produit par
`infra/osrm-prepare.sh` :

```bash
osmium extract -b 4.78,45.72,4.95,45.81 infra/osrm-data/lyon.osm.pbf -o lyon-ci.osm.pbf
osmium tags-filter lyon-ci.osm.pbf w/highway r/type=restriction -o scripts/fixtures/lyon-roads.osm.pbf
```

Les voies, leurs nœuds et les restrictions sont conservés ; les bâtiments et
les autres objets indépendants sont retirés pour garder un petit jeu versionné.
Aucun téléchargement ni outil d’ingestion n’est nécessaire pendant la CI.
