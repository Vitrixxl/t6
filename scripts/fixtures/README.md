# Données de recette du moteur MOTIS

Deux fichiers alimentent le moteur MOTIS jetable de `bun run ci`. Ils ne sont
ni servis au client ni utilisés par la pile de production, dont le conteneur
MOTIS télécharge l'extrait du Rhône et importe l'archive GTFS officielle
(`infra/motis-entrypoint.sh`). Seul le travail « Pile Docker » de la CI dépose
l'horaire de recette dans `infra/gtfs/` pour vérifier ce chemin.

## `lyon-roads.osm.pbf` — voirie réelle

Extrait réel OpenStreetMap de Lyon et Villeurbanne. Ce n'est pas une réponse
de routage simulée : MOTIS construit son graphe de voirie puis calcule ses
accès, tracés et la référence voiture dessus.

Source : [extrait Rhône-Alpes Geofabrik](https://download.geofabrik.de/europe/france/rhone-alpes.html),
téléchargé pour la préparation locale le 4 septembre 2026, puis découpé le
5 septembre. Emprise : `4.78,45.72,4.95,45.81` (ouest, sud, est, nord).
Les objets hors du périmètre nécessaires à la complétude des chemins et relations
peuvent rester dans l’extrait. Ce jeu couvre les parcours de recette, pas toute la métropole.

© les contributeurs OpenStreetMap. Données et extrait redistribués sous
[Open Database License 1.0 (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/).
[Attribution et droits](https://www.openstreetmap.org/copyright).

Reproduction avec osmium-tool 1.18.0, depuis l’extrait métropolitain téléchargé par le conteneur MOTIS (`docker cp urbanflow-motis-1:/data/lyon.osm.pbf .`) :

```bash
osmium extract -b 4.78,45.72,4.95,45.81 lyon.osm.pbf -o lyon-ci.osm.pbf
osmium tags-filter lyon-ci.osm.pbf w/highway r/type=restriction -o scripts/fixtures/lyon-roads.osm.pbf
```

Les voies, leurs nœuds et les restrictions sont conservés ; les bâtiments et
les autres objets indépendants sont retirés pour garder un petit jeu versionné.

## `lyon-ci.gtfs.zip` — horaire de recette

Horaire GTFS dérivé du réseau livré (`data/transport/gtfs-feed.json`, desserte
et intervalles du réseau normalisé, dont des hypothèses pour le bus) par `python3 scripts/build-gtfs-fixture.py` : une
course par ligne et par sens dans l'emprise ci-dessus, cadencée par
`frequencies.txt` aux intervalles du jeu normalisé, avec des temps de parcours calculés
sur la distance entre arrêts. Son calendrier couvre 2026 à 2030 pour que la
recette trouve des trajets à toute date. Ce n'est pas l'horaire officiel :
il sert à vérifier le parcours applicatif, pas des heures de passage.

Aucun téléchargement ni outil d’ingestion n’est nécessaire pendant la CI.

Jeu actualisé le 6 septembre 2026 : 1 468 arrêts, 182 lignes par sens, 195 courses cadencées, dont TB12.
