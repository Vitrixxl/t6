# Plan proposé — attente fondée sur les horaires TCL

Statut : socle serveur développé sur `feat/attente-horaires-gtfs`, intégration
client en attente d’une archive TCL récente. L’application utilise encore ses
estimations actuelles ; les nouveaux horaires ne sont pas activés.

Travail effectué : contrats, migration, import transactionnel, calendrier,
sélection en deux transports au plus, fréquences et API GET. Les données de test
restent dans les tests. `GTFS_SOURCE_URL` n’est pas configurée sur ce poste.
L’archive historique publique TCL du 15 avril 2022 a été examinée sans activation :
elle ne fournit pas de tracé exploitable pour une course T2 et elle est expirée.
Une correspondance avec le WFS doit donc être validée sur l’archive récente avant
le branchement de l’interface. Les étapes 1 (validation réelle), 4, la recette
complète de l’étape 5 et l’automatisation du renouvellement restent à terminer.

Objectif : annoncer un départ prévu et calculer l’attente à l’heure où le
voyageur atteint réellement le quai. Première livraison sur le périmètre actuel :
métro, tramway, funiculaire, transport seul et rabattements Vélo’v / Dott,
avec au plus une correspondance. Le moteur reste limité à ses stations candidates ;
ce travail ne promet pas un optimum sur tout le réseau.

## Point de départ vérifié

- `scripts/fetch_gtfs.py` ne lit pas les horaires ; il crée une course fictive
  par ligne. Les arrêts sont dédupliqués par nom, ce qui perd l’identité des quais.
- `scripts/fetch_tcl_lines.py` remplace les lignes, les arrêts et les courses
  par un modèle issu du WFS. Ses identifiants ne sont pas présumés compatibles
  avec ceux d’un GTFS horaire.
- Les intervalles de 4 / 8 / 10 minutes et le décalage de 0 à 2 minutes sont
  générés par ces scripts. `realtime_delay_minutes` ne contient aucun retard mesuré.
- `src/lib/planner/transit.ts` estime l’attente, le temps à bord et une
  correspondance forfaitaire, sans date de recherche ni sens de course.
- `src/queries/routes.ts` garde les recherches cinq minutes, avec une clé
  indépendante de l’heure. Une attente horaire ne peut pas reprendre cette politique.

## 1. Valider et importer la source horaire

Vérifier l’accès à une archive TCL récente via `GTFS_SOURCE_URL`, sa couverture
temporelle, les lignes présentes et les fichiers disponibles. La fiche officielle
décrit une offre théorique sur 60 jours et un accès nécessitant un compte ;
l’archive effectivement obtenue restera l’autorité pour sa période de validité.
[Source TCL publiée sur data.gouv.fr](https://www.data.gouv.fr/datasets/horaires-theoriques-du-reseau-transports-en-commun-lyonnais)

Étendre l’ingestion Python pour conserver courses, quais, ordre des arrêts,
heures de montée/descente, calendrier et exceptions. Préserver les identifiants
GTFS, y compris les quais homonymes. Utiliser les tracés GTFS lorsqu’ils sont
exploitables ; sinon documenter et tester une correspondance explicite avec les
tracés WFS. Ne plus laisser l’enrichissement WFS écraser le modèle horaire.

Livrable : import reproductible, rapport de couverture et petits jeux de données
de test. Une absence de correspondance de tracé reste explicite, sans géométrie inventée.

## 2. Ajouter le stockage et le service de lecture

Garder les horaires volumineux côté serveur. Déclarer les tables et index dans
`server/src/db/schema.ts`, générer la migration avec `bun run db:generate`.
L’ingestion Python produit les données normalisées ; un importateur Bun écrit
via les dépôts Drizzle. Indexer les passages par arrêt, course, ordre et heure.

Séparer les responsabilités : requêtes dans `repositories/`, sélection horaire
dans `services/`, contrats zod dans `src/contracts/transit.ts`, route de lecture
dans `routes/`. Proposition : `GET /api/transit/journeys`, avec arrêts candidats,
instants de présence et contraintes validés ; retour des courses et horaires
utiles, sans envoyer l’archive au client. Dimensionner les requêtes à partir du
nombre réel de candidats pour éviter un appel par course.

Versionner l’import, sa couverture et sa date de récupération. Une nouvelle
version n’est activée qu’après validation ; un import raté conserve la version
précédente tant qu’elle couvre la date demandée. Automatiser son renouvellement
et surveiller son expiration.

## 3. Calculer les départs accessibles

Pour chaque quai candidat, calculer un instant de présence à partir du départ
de la recherche et des durées OSRM mesurées. Pour un rabattement, inclure la
marche, la prise du véhicule, le parcours, la dépose et l’accès final au quai.
Choisir une course active qui dessert la descente après la montée, dans le bon
sens et avec les droits de montée/descente nécessaires.

Calculer en secondes : `attente = départ prévu de la course − présence au quai`.
Si le départ est manqué, examiner les suivants ; ne pas ramener une attente
négative à zéro. Comparer les arrivées finales des courses accessibles, car le
premier départ n’est pas nécessairement la meilleure arrivée. Le temps à bord
vient des horaires de cette même course.

Pour une correspondance, propager l’arrivée du premier transport, appliquer le
temps de transfert et chercher un départ accessible du second. Respecter les
transferts interdits ou minimaux publiés ; faute de mesure complète, identifier
la marge comme une hypothèse. Revalider la faisabilité si une mesure finale
d’accès change. Inclure le dernier trajet à pied dans le classement total.

Les dates de service, exceptions, heures au-delà de 24 h, fuseau de l’agence,
changements d’heure et règles de transfert doivent suivre la référence GTFS.
Un service publié uniquement en fréquence ne fournit pas un départ exact :
conserver une estimation clairement distincte dans ce cas.
[Référence GTFS Schedule](https://gtfs.org/documentation/schedule/reference/)

## 4. Relier l’heure recherchée à l’interface

Ajouter un départ explicite, « maintenant » par défaut, à l’état de recherche,
au contrat et à la clé React Query. Le figer pour un calcul cohérent, puis
recalculer quand l’utilisateur change l’heure ou qu’un départ devient caduc.

Afficher la ligne, la direction, le départ prévu, l’attente et l’arrivée ;
utiliser `src/lib/duration.ts`. Exemple : « Arrivée au quai 8 h 12 · départ prévu
8 h 17 · attente 5 min ». Distinguer « horaire théorique », « attente estimée »,
« aucun service à cette heure » et « horaires indisponibles / hors couverture ».
Aucun repli silencieux sur les constantes actuelles. Les modes indépendants
des horaires restent calculables ; retirer les faux retards et l’affluence fictive.

Le formulaire de planification doit recalculer pour `scheduledFor` avant
l’enregistrement : changer la date ne peut pas simplement recopier une durée
calculée pour maintenant. Un itinéraire enregistré se recalcule lorsqu’il est réutilisé.
Une récurrence reste une règle : vérifier une occurrence datée sans matérialiser
une collection, sans promettre un départ fixe toute l’année. Ne pas réécrire
l’historique accompli lors d’une mise à jour du GTFS.

## 5. Valider avant la livraison

Écrire des tests déterministes avant le remplacement des hypothèses : départ
juste avant/après l’arrivée au quai, sens opposé, arrêt sauté, dimanche et
exception, dernier service, passage après minuit, changement d’heure,
correspondance ratée, transport express plus rapide, rabattement vélo ou
trottinette, données expirées, panne d’import et service en fréquence.

Vérifier l’API et les migrations, ainsi que la cohérence entre durée
affichée et étapes. Dans Chromium, exercer maintenant/départ futur,
planification, changements d’heure de recherche et panne de données sur mobile
et bureau. Relancer `bun run check`, `bun run e2e`, `bun run e2e:trips` et
`bun run e2e:offline`. Mesurer volume importé, mémoire et latence de recherche
avant de fixer une cible de performance réaliste.

Mettre à jour README, CHECKLIST, OpenAPI, AGENTS et les quatre supports de revue.
Consigner les bogues corrigés et leurs preuves dans `docs/BUGS.md`.
Le dossier PDF gelé reste intact.

## 6. Ajouter éventuellement le temps réel après ce socle

Vérifier séparément l’accès, la couverture et les identifiants du flux TCL
effectivement disponible. Ajouter ensuite retards et suppressions, avec leur
fraîcheur et un retour explicite à l’horaire théorique en cas de panne. Le
temps réel complète les horaires théoriques ; il ne remplace pas cette première
livraison, notamment pour une recherche à une date future.
[Documentation officielle du PAN sur le temps réel](https://doc.transport.data.gouv.fr/type-donnees/operateurs-de-transport-regulier-de-personnes/administration-des-donnees-transport-collectif/publier-des-donnees-temps-reel/temps-reel-des-transports-en-commun)

Premier jalon recommandé : valider une course TCL datée de bout en bout,
avec ses vrais quais et un tracé cohérent. Ce jalon lève le risque principal —
la compatibilité des données — avant de modifier tout le moteur et l’interface.

## Surface HTTP au 5 septembre 2026

Les deux routes préparatoires inutilisées ont été retirées de l’application et
d’OpenAPI. Le service interne, les contrats d’import et les commandes GTFS restent
préparatoires. La proposition d’endpoint ci-dessus n’est pas publiée : la recréer
uniquement avec un consommateur client et une archive récente validée.
