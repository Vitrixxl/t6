# Archive GTFS TCL

Déposer ici l'archive officielle des horaires TCL sous le nom `tcl.gtfs.zip`,
puis mettre `MOTIS_TRANSIT_ENABLED=true` dans `.env` : au démarrage suivant,
`docker compose up` reconstruit le graphe du moteur avec les horaires.

L'archive vient de Data Grand Lyon (licence Mobilité, compte gratuit) et n'est
pas versionnée : le dossier est monté en lecture seule dans le conteneur MOTIS.
Sans archive déposée, `GTFS_SOURCE_URL`, `GTFS_USERNAME` et `GTFS_PASSWORD`
dans `.env` font télécharger la version courante par le conteneur lui-même.
