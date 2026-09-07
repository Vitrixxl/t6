# Archive GTFS TCL

`tcl.gtfs.zip` est l'archive officielle des horaires théoriques du réseau TCL
(SYTRAL Mobilités), telle que publiée sur Data Grand Lyon. Le conteneur MOTIS
l'importe au démarrage : `docker compose up` n'a rien à télécharger.

Version versionnée : couverture du 6 septembre 2026 au 4 janvier 2027
(`feed_start_date=20260906`, `feed_end_date=20270104`). MOTIS importe 60 jours
à partir du jour de l'import et reconstruit son graphe après 30 jours ; une
archive périmée ne fournit aucun horaire courant.

Source : [Data Grand Lyon](https://data.grandlyon.com/), jeu « Horaires
théoriques du réseau TCL », licence Mobilité (compte gratuit,
[authentification](https://rdata-grandlyon.readthedocs.io/fr/latest/authentification.html)).
© SYTRAL Mobilités.

Pour renouveler : remplacer le fichier par la version courante, le moteur
reconstruit son graphe au démarrage suivant.
