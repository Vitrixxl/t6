# UrbanFlow Mobility

Application PWA React/TypeScript **mobile first** pour le sujet T6 CDSD "Urban Flow Mobility" (session septembre 2026).

## Architecture

Deux briques, une seule origine pour le navigateur :

- **Client** (`src/`) : PWA React/TypeScript 7. Les données du compte vivent dans le cache de requêtes (React Query), amorce à la connexion. Tous les appels à l'API UrbanFlow passent par Eden Treaty et heritent leurs types de l'arbre Elysia.
- **API** (`server/`) : Elysia sur Bun + SQLite (`bun:sqlite`). Comptes, sessions, trajets, routines, itinéraires sauvegardés, calcul d'itinéraires.
- **Contrats** (`src/contracts/`) : un schéma zod par objet echange, importe par les deux : validation de l'API, validation des formulaires (react-hook-form), types, OpenAPI.

Le serveur est la seule source de vérité : comptes en SQLite (argon2id), session par cookie `httpOnly` revocable
en base, état du compte rendu à la connexion, puis collections lues par `GET`. Chaque trajet, routine ou
itinéraire enregistré s'ecrit seul par `PUT /api/.../:id` et se retire par `DELETE /api/.../:id` ; aucun corps HTTP
ne contient une collection complète. À la lecture du compte ou des trajets, `completeDueTrips` comptabilise les ponctuels dont la date
prévue est passée et qui ne sont pas annulés, avec leur historique carbone dans une transaction, puis efface les
ponctuels passés depuis plus de six mois. Seul `DELETE /api/trips/history` efface volontairement tout
l'historique. Les envois sont sérialisés. Pas de cache local persistant : les vues vivent dans le cache React Query
(`src/queries/`) le temps de la session, et une écriture refusée est signalée à l'utilisateur, la vue concernée
étant relue depuis le serveur. Exigence C10 (connectivite variable) : cache du
socle par le service worker ; cellules TCL en cache mémoire, états de chargement explicites, erreurs réseau propres.
Un bandeau commun aux écrans de chargement, de connexion et de carte signale la
perte de connexion détectée par le navigateur, sur mobile et bureau. Il précise
qu’Internet est nécessaire pour rechercher des itinéraires et enregistrer des
modifications, et disparaît au retour du réseau. Ce signal ne prouve pas que
l’API est disponible : les erreurs serveur restent distinctes. Le recours aux
données de transport de secours n’est pas présenté comme une coupure Internet.
Vérification navigateur sur le build de production : `bun run e2e:offline`
(compte de démonstration requis, mêmes variables que `bun run e2e`).

Il n’y a pas de mode métier sans serveur : le service worker peut restituer
des ressources déjà chargées, mais il ne met jamais les réponses de l’API en cache.

## Planificateur et annulations

Toutes les options calculables sont proposées sur mobile et sur bureau, jusqu’aux
six familles du moteur (marche, vélo, trottinette, transport public et les deux
rabattements vers le transport public). La liste mobile n’est jamais tronquée.
Les options sont triées par durée croissante après mesure réelle. Les préférences
influencent leur score et la présélection ; aucun plafond de
marche n’est configurable ni appliqué. Les anciens profils restent lisibles et
leur champ retiré n’est plus exposé par l’API ni son OpenAPI, générée depuis le
contrat partagé. La disponibilité des engins, la desserte et les mesures réelles
déterminent toujours les options calculables.

Les durées longues se lisent en heures et minutes (`63 min` → `1h03`), dans les
options, les étapes et les trajets. Sur mobile, le panneau prend automatiquement
la hauteur de son contenu, limitée à la moitié de la carte (45 % en paysage bas).
Toutes les options défilent horizontalement ; les détails se déplient à la demande.
L’en-tête et la fermeture restent accessibles. Aucun réglage de taille.

Une option contenant des transports en commun affiche le choix Bus, Métro, Tramway
et Funiculaire. Ces types sont les modes de transport demandés à MOTIS.
Ce choix est temporaire : sélectionner une option sans transport public le remet à Tous.

Le hub comporte quatre onglets : **Une fois**, **Récurrents**, **Historique** et
**Enregistrés**. Les trajets ponctuels futurs n’ont pas de bouton « Fait ». Après leur date prévue,
ils sont comptabilisés automatiquement sauf annulation, puis accessibles dans l’historique.
Les récurrences n’ont aucun bouton « Fait » : leurs passages échus comptent
sur leurs périodes d’activité, dans leur fuseau horaire enregistré.

Dans l’historique, une journée récurrente propose **Annuler l’aller**, **Annuler
le retour** ou **Annuler les deux**, uniquement pour les passages déjà échus.
L’API persiste des exceptions `(date, sens)` via
`PUT /api/trips/recurring/:id/cancellations/:date` ; le corps contient les seuls
`sens` demandés sous la clé `directions` (`outbound`, `return`). Un rejeu ne crée
pas de doublon et une nouvelle exception n’efface pas les précédentes. Il n’y a
pas de matérialisation des occurrences en trajets ponctuels.

`PUT /api/trips/planned/:id/cancellation` conserve un ponctuel annulé dans
l’historique et supprime sa contribution carbone dans une transaction. Les
émissions, distances, économies CO₂e et objectifs excluent les passages annulés.
Les comparaisons négatives et indisponibles gardent leur signification.

La migration `0004_annulations-par-sens.sql` ajoute les exceptions et le fuseau
horaire ; les anciennes routines prennent `Europe/Paris` et aucune annulation.
`bun run e2e:trips` vérifie les quatre onglets de 320 à 1280 px, les annulations
et leur conservation après rechargement, sur un serveur local de test.

Le cadrage réserve des marges aux contrôles en fonction de la taille réelle du
canvas. Une rotation ou un redimensionnement des panneaux recalcule ces marges ;
elles laissent toujours une zone disponible pour le trajet, même en paysage.

## Organisation du code

Le découpage suit les responsabilités fonctionnelles ; la longueur seule ne
commande pas la création d'un module.

**API** (`server/src/`)

| Dossier | Rôle |
| --- | --- |
| `config/` | lecture et validation des variables d'environnement |
| `db/` | ouverture SQLite via Drizzle ; le schéma vit dans `schema.ts`, les migrations générées dans `server/drizzle/` |
| `repositories/` | un dépôt par table — seule couche qui interroge la base (Drizzle, requêtes paramétrées) |
| `services/` | règles métier qui composent plusieurs opérations : complétion, sessions, recherche d'itinéraires par MOTIS |
| `plugins/` | contexte, garde d'authentification, débit, en-têtes, journal, erreurs |
| `routes/` | gestionnaires HTTP, sans règle métier |

**Client** (`src/`)

| Dossier | Rôle |
| --- | --- |
| `lib/planner/` | ce qui reste métier autour des itinéraires : score du profil, présélection, facteurs carbone, outils géographiques |
| `lib/transport/` | intégration open data : `geocoding/`, `feeds/`, cellules cartographiques |
| `contracts/` | schémas zod partagés avec l'API : validation, types derives, OpenAPI |
| `lib/api/` | client Eden Treaty type depuis l'API Elysia, authentification, une commande par ressource du compte |
| `queries/` | ressources servies par l'API dans le cache React Query : une ressource par fichier, sa requête et ses actions |
| `state/` | état d'écran partage entre modules (jotai) : formulaire de planification, hub |
| `components/map/` | carte MapLibre : cycle de vie, couches, popups, sources et marqueurs |
| `components/planner/` | recherche : état réseau, liste de résultats et panneaux de restitution séparés |
| `components/planner/trips/` | module trajets : hub, listes, formulaire, champs de planification et objectifs |
| `components/app/` | orchestration de l'écran, dispositions desktop/mobile et hooks de géolocalisation/routage |
| `components/tutorial/` | parcours de découverte distincts : 11 étapes desktop et 9 étapes ciblant les contrôles réellement présents sur mobile |

### Parcours de lecture du code

Le guide détaillé est [la revue de code locale](output/revue-code.html) : fichiers
et symboles dans l’ordre des appels, explications des données, exemples concrets
et choix de conception. Le parcours se lit en continu, sans découpage horaire. Ce support
reste ignoré par Git, comme les autres fichiers de soutenance.

Le chargement du transport se lit dans `src/lib/transport/feeds/index.ts` :
`loadTransportNetwork(feed)` appelle les flux partagés et `fetchJson(url)`, qui utilise
directement `fetch`. Les tests simulent le réseau sans ajouter de paramètre aux
fonctions de l’application.

**Suivre les données** :

1. Démarrage : `server/src/index.ts` → `server/src/app.ts`, puis
   `src/main.tsx` → `src/App.tsx`.
2. Connexion : `AuthScreen` → `src/queries/session.ts` → `src/lib/api/auth.ts`
   → `server/src/routes/auth.ts` → session serveur → cache client.
3. Trajet : `usePlanSubmission` → `src/queries/planned-trips.ts` →
   `src/lib/api/planned-trips.ts` → route → service → dépôt du même nom.
   Lire ensuite `completeDueTrips` et sa transaction trajet + historique carbone.
4. Calcul : `src/queries/routes.ts` → `POST /api/transport/journeys`
   → `server/src/services/planning.ts` → `fetchPlan` (MOTIS) → `selectOptions`
   → `rankRoutes` → `applyCarbonReference`.

**Comprendre le fonctionnement des écrans et les garanties** :

1. Affichage : `MobilityMapApp` → `useRouteOptions` → `MobilityLayouts`
   → `UrbanMap`, ses sources et son cadrage.
2. Récurrences : `src/lib/trips/operations.ts` (pause d’une seule routine),
   `routines.ts` (passages), `history.ts` (annulations), puis les services serveur.
3. Pannes : callbacks de mutation dans `src/queries/`, `save-error.ts`,
   moteur d'itinéraires indisponible et bandeau hors ligne.
4. Compte et exploitation : profil, itinéraires enregistrés, export/effacement,
   scripts de développement et build, données transport et migrations.

Le guide détaille aussi les contrats partagés, la recherche BAN/Photon, la
construction des segments et la distinction entre score, ordre et présélection.

Pour chaque fonction : identifier ses entrées, sa sortie et ses effets, puis
suivre le prochain appel. Les contrats, transactions et dépôts ont des rôles
distincts ; un simple relais n’a pas besoin de son propre fichier.

## Compte de test et évolution des trajets

`bun run seed:test` crée ou réinitialise **uniquement** le compte réservé
`test@urbanflow.local`. Mot de passe hors production : `UrbanFlow2026!`,
ou la valeur de `TEST_PASSWORD`. L’image Docker fournit ce mot de passe de recette
par défaut ; Compose permet de le surcharger avec `TEST_PASSWORD`. Hors Docker,
le script demande explicitement cette variable lorsque `NODE_ENV=production`.
Le script utilise `DATABASE_PATH`, comme le serveur. Exemple sur une base dédiée :

`DATABASE_PATH=/tmp/urbanflow-recette.db bun run seed:test`

Il prépare 35 ponctuels (28 faits, 5 annulés, 2 futurs),
3 récurrences et 1 itinéraire enregistré. Les dates sont relatives au jour
d’exécution, sur huit semaines passées, dans le fuseau Europe/Paris. Une routine
quotidienne aller-retour contient des exceptions à J−2 et J−3 ; une autre a une
pause puis une reprise ; la troisième est en pause. Les mesures sont **fictives**,
réservées à la recette, et tous les libellés portent « Test ». Dans Docker, `infra/entrypoint.sh` lance
ce peuplement avant le serveur à **chaque démarrage**, puis sert le client et l’API. Relancer la commande efface les essais de ce seul compte, en une
transaction ; les autres comptes sont conservés. `seed:demo` garde son rôle
séparé de compte vide pour le scénario de planification.

Dans le hub, **Voir l’évolution** ouvre huit semaines et quatre indicateurs :
émissions, économies CO₂e, distance et nombre de passages. Le tableau donne les
valeurs exactes ; la moyenne porte sur les sept semaines terminées. Les semaines
suivent le fuseau de l’appareil ; la dernière s’arrête à maintenant. La ligne de
budget représente le maximum actuel du profil, sans inventer ses valeurs passées.
Le calcul reprend les sources du suivi carbone : au plus 50 ponctuels conservés
et les passages des routines conservées, hors pauses et annulations. Une semaine
sans données n’atteste pas une absence réelle de déplacements. Une référence
voiture absente est exclue des économies, une économie négative reste négative.

L’annulation d’un ponctuel ou de passages récurrents ouvre une confirmation.
Dans l’historique récurrent, **Rétablir l’aller/le retour** retire uniquement
l’exception choisie via
`DELETE /api/trips/recurring/:id/cancellations/:date/:direction`.
L’action est idempotente et les compteurs se recalculent à réception du serveur.
Elle préserve les autres sens et dates, même si la routine est en pause.

Recette : `bun run e2e:trips` pour les confirmations et rétablissements ;
`bun run e2e:evolution` après `seed:test` pour les graphiques sur le même serveur
(`E2E_BASE_URL` configurable). Le script de graphiques ne modifie pas le compte.

## Livrables

- `src/` : application fonctionnelle (auth + profils, planificateur multimodal, trajets programmés et routines, objectifs, suivi carbone).
- `server/` : API HTTP (authentification, profil, ressources du compte, RGPD, calcul d'itinéraires).
- `public/manifest.webmanifest` + `public/sw.js` : PWA installable avec cache offline.
- `output/pdf/CASCALES_Vitrice_Titre6_B3DEV_Septembre2026.pdf` : dossier projet (30 pages, généré par script).
- `output/screens/` : captures automatisées (Playwright) intégrées au dossier.
- `CHECKLIST.md` : traçabilité exigences → preuves.

## APIs réelles intégrées

| Domaine | Source | Mode |
| --- | --- | --- |
| Géocodage adresses | `api-adresse.data.gouv.fr` (BAN) | live navigateur |
| Géocodage lieux/quartiers | Photon (`photon.komoot.io`, OSM) | live navigateur |
| Routage multimodal | MOTIS (voirie OSM, horaires GTFS, flux GBFS), auto-hébergé | appelé par le serveur à chaque recherche de `/api/transport/journeys` |
| Vélos partagés | GBFS v3 Vélo'v (`api.cyclocity.fr`) | serveur, chargement mutualisé 60 s |
| Trottinettes | GBFS v2.3 Dott Lyon (`gbfs.api.ridedott.com`) | serveur, chargement mutualisé 60 s |
| Transport public | GTFS statique TCL/SYTRAL (ODbL, transport.data.gouv.fr) | artefact normalisé (`bun run generate:gtfs`), import SQLite au démarrage |
| Desserte et tracés des lignes | WFS SYTRAL `data.grandlyon.com` (ODbL, sans jeton) | artefact normalisé (`bun run generate:lignes`), import SQLite au démarrage |

Les disponibilités Vélo’v et Dott proviennent uniquement des flux en direct.
Si le groupe GBFS échoue, un bandeau annonce l’indisponibilité : aucun fichier
de secours, aucune station partagée ni option vélo/trottinette. La marche et les
transports publics restent calculables.

## Chargement géographique du réseau TCL

`data/transport/gtfs-feed.json` est un artefact d’import réservé au serveur.
Au démarrage, son empreinte SHA-256 est comparée à la version SQLite ; une
nouvelle version importe quais, lignes et fréquences dans une seule transaction.
L’index R*Tree des quais suit les insertions, modifications et suppressions par
triggers. Les migrations sont dans `server/drizzle/` ; aucune extension native
supplémentaire n’est nécessaire dans Bun.

La carte demande `GET /api/transport/stops?x=…&y=…&version=…` pour les cellules
visibles de 0,05 degré, après 180 ms sans mouvement. Chaque cellule fournit tous
ses quais, sans tracés de lignes. React Query réutilise les cellules communes,
les garde 30 minutes après leur dernière utilisation et les renouvelle si la
version du réseau change. Sous le zoom 11, un message invite à zoomer et aucun
quai TCL n’est demandé. Masquer la couche suspend aussi ces requêtes.

`GET /api/transport/nearby-stops` sert le vrai compte dans le rayon demandé et
les quatre quais les plus proches : ce parcours reste indépendant du cadrage.
`GET /api/transport/context` ne contient ni quais ni tracés TCL : seulement les
métadonnées, le nombre total d’arrêts et les disponibilités partagées.
Les appels GBFS sont mutualisés côté serveur pendant 60 secondes ;
une erreur GBFS après expiration produit `null`, sans réutiliser un ancien flux.
Le contexte est demandé après la connexion, puis relu chaque minute lorsque l’application est active.

Les six familles d’itinéraires restent calculées côté serveur sur tout le réseau.
Seules les options mesurées et leurs tracés sont envoyés au client. Les horaires
TCL restent estimés : ce changement n’active pas le chantier horaire préparatoire.
Les anciennes routes `/api/route` et `/api/route-matrix` n’ont plus d’appelant et
sont retirées. `bun run e2e:transport` vérifie le volume TCL initial, l’absence de
fichier global, le cache au déplacement, le zoom régional et la reprise après
une panne. Les gains mesurés portent sur les transferts TCL, pas sur une mesure
d’énergie ou l’ensemble du trafic (fond OSM et GBFS restent distincts).

## Calcul d'itinéraires

Le navigateur envoie la recherche à `POST /api/transport/journeys` par Eden. Le serveur la confie à MOTIS, un moteur multimodal open source qui calcule sur un graphe unique : la voirie OpenStreetMap, les horaires GTFS et les flux GBFS Vélo'v et Dott.

1. Un plan par moyen d'accès : à pied, en Vélo'v et en trottinette Dott quand les flux sont disponibles. MOTIS choisit lui-même les quais, les lignes et les correspondances (RAPTOR sur les horaires) et rend les trajets non dominés avec leurs tracés. En parallèle, un appel `one-to-many` en voiture mesure la référence carbone entre les deux extrémités.
2. Le serveur traduit chaque itinéraire en option UrbanFlow et le classe dans une famille (marche, vélo, trottinette, transport public, vélo + transport, trottinette + transport). Il garde la plus rapide de chaque famille et jusqu'à trois variantes de transport qui n'empruntent pas les mêmes lignes.
3. La même référence voiture est appliquée à toutes les options, puis elles sont affichées de la plus rapide à la plus lente. Les durées comprennent les attentes à quai.

Rien n'est conservé côté serveur : une recherche vient toujours d'un calcul frais, en quelques dizaines de millisecondes. Les appels à l'API UrbanFlow sont faits avec Eden Treaty : leurs corps et leurs réponses sont inférés directement depuis les routes Elysia, sans type HTTP recopié dans le front.

Une correspondance entre deux quais est un segment piéton routé par MOTIS sur la voirie, avec son tracé. Sans `shapes.txt` dans l'archive GTFS, le tracé d'une ligne relie ses arrêts en ligne droite : c'est le cas de l'archive TCL 2022 utilisée en développement.

## Facteurs carbone

La voiture n'appartient pas aux modes proposes ni aux préférences. C'est un
scénario contrefactuel invisible, mesuré une seule fois en voiture par MOTIS
(`one-to-many`, mode `CAR`) pour chaque couple départ-arrivée :

```text
CO2e voiture = distance routière voiture x 142 gCO2e/km
CO2e evite   = CO2e voiture - CO2e de l'option mesuree
```

Toutes les options d'une recherche utilisent donc strictement la même
référence, même si leurs propres distances diffèrent. Une économie négative
est conservée et affichée comme des `gCO2e supplementaires`. Si le profil
voiture est indisponible, les alternatives restent visibles avec leur propre
empreinte et l'interface indique `Comparaison voiture indisponible` ; aucun zéro
ni trajet approche n'est inventé.

| Usage | Facteur | Périmètre | Source/version |
| --- | ---: | --- | --- |
| Référence voiture | 142 gCO2e/passager-km | voiture thermique moyenne diesel, une personne | ADEME, modélisation transport 2025, consultée le 04/09/2026 |
| Tramway (`route_type=0`) | 3,8 gCO2e/passager-km | par passager-kilomètre | ADEME Impact CO2, modèle 2025, consulté le 04/09/2026 |
| Métro (`route_type=1`) | 4,2 gCO2e/passager-km | par passager-kilomètre | ADEME Impact CO2, modèle 2025, consulté le 04/09/2026 |
| Funiculaire (`route_type=7`) | 4,2 gCO2e/passager-km | approximation par le facteur métro, faute de facteur spécifique | ADEME Impact CO2, modèle 2025, consulté le 04/09/2026 |
| Marche / Vélo'v / trottinette | 0 / 4 / 15 gCO2e/passager-km | hypothèses simplifiées UrbanFlow 2025 | versionnées dans `src/lib/planner/emissions.ts` |

La valeur, l'unité, le périmètre, la source, le millésime et la date de
consultation vivent ensemble dans `src/lib/planner/emissions.ts`. Le type
`CarbonReference` conserve aussi la version du facteur utilisée.

## Objectifs carbone personnels

Le suivi des trajets affiche les émissions de la semaine, le maximum personnel
et le reste disponible ou le dépassement, sur mobile comme sur bureau. Il
compte les trajets faits et les passages récurrents échus, hors annulations ;
les économies par rapport à la voiture ne sont jamais soustraites aux émissions.
Le budget ne filtre ni ne classe les itinéraires.

Le profil distingue trois notions : le budget carbone hebdomadaire, l'objectif
d'économie hebdomadaire et l'objectif d'économie mensuel. Les deux objectifs
d'économie sont indépendants : le mensuel n'est pas une multiplication arbitraire
du chiffre hebdomadaire. Ils sont validés par le contrat partagé, persistés avec
`PUT /api/me/profile`, puis comparés aux mêmes agrégats semaine/mois que le suivi
carbone dans le planificateur.

Le repère national vient du [SDES-Insee, enquête mobilité 2019](https://www.statistiques.developpement-durable.gouv.fr/le-quart-des-menages-les-plus-aises-lorigine-de-35-des-emissions-de-gaz-effet-de-serre-des)
(publication 2023) : 1,45 tCO₂e/personne/an, soit environ 27 885 gCO₂e/semaine
après division par 52. Champ : personnes de 6 ans et plus en France métropolitaine,
déplacements locaux et longue distance, émissions pendant les déplacements.
Ce périmètre diffère des trajets et facteurs suivis dans UrbanFlow : aucune
comparaison de performance ni recommandation de plafond n’en est déduite.

Les suppressions de trajets ponctuels, récurrents et enregistrés, ainsi que
l’effacement de l’historique carbone, demandent une confirmation nommant
l’action et ses conséquences. Annuler ou fermer ne déclenche aucune écriture.

Le tutoriel de première visite suit la disposition courante. Sur mobile, il
montre successivement la recherche, la carte, le GPS, les disponibilités a
proximité, les couches, les trajets/objectifs et le profil. Sa bulle se place
au-dessus ou au-dessous du contrôle vise pour ne pas le masquer.

Le calcul d'itinéraires utilise uniquement un moteur MOTIS local. Il n’y a ni URL
publique par défaut, ni bascule vers un hébergeur externe en cas de panne.

Pour héberger le moteur localement (les flux GBFS et le géocodage restent externes) :

```bash
./infra/motis-prepare.sh                     # télécharge l'extrait OSM et l'archive GTFS, puis construit le graphe (une fois)
docker compose -f infra/compose.yml up -d    # application + moteur
```

`infra/motis-prepare.sh` exige `GTFS_SOURCE_URL` dans `.env` : MOTIS calcule sur les calendriers de l'archive, une archive périmée ne produit aucun trajet en transport aux dates courantes. Il télécharge l'extrait Rhône-Alpes, le découpe autour de Lyon si `osmium` est présent, écrit `infra/motis-data/config.yml` avec les flux GBFS Vélo'v et Dott, puis lance `motis import`. Le graphe est prêt en quelques minutes.

`infra/compose.yml` lance **l'application et le moteur ensemble** : l'API appelle `motis:8080` sur le réseau Docker, sans port publié. L'application écoute en **HTTPS** sur le port 4000, avec un certificat auto-signé généré au premier démarrage. Pour y accéder depuis le réseau local, inscrire l'adresse de la machine dans le certificat : `TLS_EXTRA_HOSTS=IP:192.168.1.37 docker compose -f infra/compose.yml up -d`.

Pour une API lancée hors conteneur, publier le moteur en loopback dans Compose (`ports: ['127.0.0.1:8080:8080']`) et renseigner `.env` :

```dotenv
MOTIS_URL=http://127.0.0.1:8080
```

Absente ou vide, la variable vaut `http://motis:8080`. En cas de panne du moteur, l’API répond 503. Aucune file ni limitation de débit propre à un service public n’est conservée.

Seul prérequis : **Docker**. `osmium` est facultatif — s'il est présent la région est découpée autour de Lyon et l'import est bien plus rapide ; sinon toute la région Rhône-Alpes est traitée.

MOTIS tient dans un seul processus : son routeur de voirie `osr` sert les accès à pied, à vélo et la référence voiture, son moteur horaire `nigiri` exécute RAPTOR sur le GTFS, et il lit lui-même les flux GBFS pour proposer les engins partagés. Mesuré sur Lyon : moins de 120 Mio de mémoire au repos, environ 200 ms pour une recherche complète (trois plans et la référence voiture).

### Certificat local et service worker

Passer l’avertissement d’un certificat auto-signé ne suffit pas à autoriser le
service worker : le navigateur doit reconnaître ce certificat. Sur Chromium
sous Linux, importer le certificat public du conteneur local comme certificat
serveur de confiance (`P,,`, sans lui donner le rôle d’autorité de certification) :

```bash
mkdir -p tmp/certs
docker cp urbanflow:/certs/cert.pem tmp/certs/urbanflow-localhost.pem
certutil -d sql:$HOME/.pki/nssdb -A -t 'P,,' -n 'UrbanFlow localhost 2026' -i tmp/certs/urbanflow-localhost.pem
```

Cet exemple vise le conteneur local nommé `urbanflow` et une base NSS existante.
Les installations Chromium récentes utilisent `~/.local/share/pki/nssdb` si
`~/.pki/nssdb` n’existe pas. La [documentation Chromium](https://chromium.googlesource.com/chromium/src/+/master/docs/linux/cert_management.md)
précise les chemins et l’import depuis l’interface. Relancer le navigateur si
une fenêtre ouverte conserve l’ancien état du certificat. La confiance est
propre au poste : un téléphone doit aussi reconnaître son certificat.

L’image Docker copie les contrats et les règles calendaires partagées avec
l’API, en plus du client construit. Après une mise à jour du code, reconstruire
l’image et recréer le conteneur en conservant les volumes de données et de
certificats ; modifier `main` seul ne change pas le conteneur déjà lancé.

## Commandes

```bash
bun install              # bun.lock est le seul lockfile du projet
python3 -m venv .venv && .venv/bin/python -m pip install -r requirements.txt

cp .env.example .env     # secrets (jeton GTFS, compte Grand Lyon) et réglages API, jamais committés
bun run dev              # serveur + reconstruction du client à chaque modification
bun run seed:demo        # compte de démonstration côté serveur
bun run db:generate      # migration SQL à partir de server/src/db/schema.ts (à committer avec le schéma)
bun run generate:gtfs    # régénère le feed GTFS depuis la source officielle TCL
bun run generate:lignes  # desserte par arrêt et tracés réels des lignes (open data, sans jeton)
bun run generate:icons   # icônes PWA
bun run generate:pdf     # dossier projet PDF
bun run start            # sert le build de production
bun run check            # lint + typage + tests + build production
bun run e2e              # tutoriel mobile + planification (Playwright, 8 assertions)
```

**Toute la chaîne tourne sous Bun, sans exception** : gestionnaire de paquets, exécution du serveur,
regroupement du client (`Bun.build`), tests du client et de l'API (`bun test`), scripts d'outillage.
Les tests importent directement `bun:test` ; les simulations réseau utilisent
`spyOn` et sont restaurées après chaque test. Aucune passerelle de compatibilité.
Aucun bundler ni lanceur de tests tiers. Seules l'ingestion GTFS et la génération du dossier restent en
Python, faute d'équivalent dans l'écosystème JavaScript.

Le dépôt conserve TypeScript 7. En attendant sa prise en charge par
`typescript-eslint`, ESLint analyse la syntaxe TypeScript avec le parseur Babel ;
`tsc` strict reste l'autorité pour les types et les symboles inutilisés, et une
règle ESLint interdit explicitement le mot-cle `any`. Le lint bloque aussi une
complexité cyclomatique supérieure a 10 ou plus de trois niveaux d'imbrication :
un flux dense doit être decoupe en responsabilités nommées avant d'être fusionne.

Le serveur porte **l'API et le client** : une seule origine, donc un cookie de session de première partie
et aucun en-tête CORS. En développement, `bun run dev` lance le serveur et reconstruit le client à chaque
modification — il faut rafraîchir la page, il n'y a pas de rechargement à chaud.
L'API tourne sous Bun, sans étape de compilation et sans dépendance native à compiler : `bun server/src/index.ts`
suffit. La surface spécifique à Bun se limite à trois fichiers (`db/index.ts`, `security/password.ts`,
`config/index.ts`) : le portage vers Node se ferait via `@elysiajs/node`, le driver `drizzle-orm/better-sqlite3`
(les dépôts ne changent pas) et scrypt.

Le feed `data/transport/gtfs-feed.json` est déjà versionné : `GTFS_SOURCE_URL` ne sert qu'à le régénérer.
Chemin Chromium des scripts configurable via `CHROME_BIN`.

## Sécurité / RGPD

Côté serveur : mots de passe hachés en argon2id (19 Mio, t=2, p=1 — paramètres OWASP, fonction *memory-hard*),
sessions opaques de 256 bits dont seule l'empreinte SHA-256 est stockée (révocables à la déconnexion), cookie
`httpOnly` + `SameSite=Lax` (pas de jeton manipulable en JavaScript, pas de CSRF inter-site), validation zod de
toute entrée (les mêmes contrats que les formulaires du client), limitation de débit (10 req/min sur l'authentification), en-têtes de sécurité helmet, message
d'erreur unique à la connexion pour ne pas divulguer l'existence d'un compte. Aucun en-tête CORS n'est émis :
l'API n'est consommée qu'en même origine.

Dans **Profil et préférences → Exporter mes données**, le bouton télécharge `urbanflow-export.json`
avec le compte, les préférences, les trajets et leurs lieux, les itinéraires enregistrés et l’historique carbone.
Un seul appel authentifié récupère les données actuelles ; un échec est affiché et permet de réessayer.
Le mot de passe et les jetons de session ne sont pas exportés.
Vérification navigateur : `bun scripts/e2e-account-export.mjs` sur le serveur local.

RGPD : export complet du compte (`GET /api/me/export`, art. 20) et suppression en cascade (`DELETE /api/me`,
art. 17), historiques bornés à 50 entrées (minimisation), géolocalisation sur action explicite.

Base légale et information (art. 6 et 13) : le texte « Conditions d'utilisation et données personnelles »
(`src/components/legal/LegalNotice.tsx`) est lisible avant l'inscription et depuis « Profil et préférences →
Données personnelles ». Il donne, par traitement, la base légale (contrat pour le service, intérêt légitime pour la
limitation de débit, consentement du navigateur pour la position), les destinataires appelés par le navigateur (BAN,
Photon, tuiles OSM) et les durées. L'inscription exige la coche d'acceptation (`termsAccepted` dans le contrat
`registration`, refusée en 422 sans elle) ; la date et la version acceptées (`TERMS_VERSION`) sont stockées avec le
compte et figurent dans l'export. Les ponctuels passés sont effacés `PAST_TRIP_RETENTION_MONTHS` (6 mois) après leur
date prévue par `completeDueTrips`, leur entrée carbone sans coordonnées restant bornée à 50. La position temps réel
n'est jamais persistée. Le [registre des traitements](docs/REGISTRE-TRAITEMENTS.md) (art. 30) reprend le tout.


L’import exige des horaires et un tracé ordonné exploitable pour chaque course :
il n’invente ni passage ni géométrie. Les transferts spécifiques à une ligne ou
une course et les transferts à bord nécessitent encore un traitement dédié ;
ils provoquent un refus explicite de l’import.

Les routes horaires inutilisées ont été retirées : aucun endpoint horaire n’est
publié dans OpenAPI. Les outils d’import et le service préparatoire restent
isolés du contexte HTTP. Le service interne cherche les courses de la journée demandée et leurs prolongements
nocturnes, avec au plus une correspondance. Il compare les arrivées finales,
respecte l’ordre des quais, les calendriers et les transferts. Les fréquences
sans départs fixes restent étiquetées `frequency`. Une correspondance sans durée
publiée porte une marge de quatre minutes explicitement estimée.

Sans import, le service retourne `unavailable` ; une date non couverte retourne
`outside-coverage`. `no-service` signifie qu’aucune course admissible n’a été
trouvée dans le périmètre demandé. Ces résultats ne sont pas encore consommés
par le client. Aucun nouveau déploiement ni import de production n’a été réalisé.

La barre mobile affiche cinq libellés sous les icônes, sur un fond opaque, avec
des cibles tactiles de 60 px de haut. L’attribution cartographique reste au-dessus.
La recette `e2e:evolution` couvre aussi cette barre à 320, 390 et 540 px.

Les lectures des ponctuels et de l’historique carbone sont rafraîchies toutes les 30 secondes
pendant que l’écran est ouvert. La date du bilan est la date prévue, même si le compte
n’est rouvert que plus tard. La route manuelle `/completion` est retirée. Les anciennes
réalisations anticipées sont remises à venir ; un historique volontairement effacé reste effacé.

Le repère national et le lien SDES-Insee sont visibles directement dans le profil,
sous le maximum hebdomadaire, et dans le suivi. `CarbonReference` centralise le chiffre
et sa source. Le calcul détaillé et son périmètre restent dépliables. La moyenne
d’émissions n’est pas un objectif d’économies par rapport à la voiture.

`bun run test:docker:seed` vérifie le peuplement et le redémarrage d’une image construite
(`DOCKER_TEST_IMAGE`, défaut `urbanflow:seed-reference`) dans un conteneur jetable :
connexion du compte rempli, remise à zéro de ses essais, compte voisin conservé.

Un ponctuel annulé peut être rétabli depuis l’historique avec « Rétablir » :
`DELETE /api/trips/planned/:id/cancellation` le remet à venir si sa date est future,
ou fait avec son bilan daté au départ prévu si elle est passée. La commande est idempotente.

## Bus TCL dans le calcul d’itinéraires

Le feed livré contient 92 lignes de bus régulières (191 tracés par sens, 2 931 quais),
en plus des 13 lignes métro/tram/funiculaire : 5 366 entrées d’arrêts et 204 tracés au total.
Ce sont des stations regroupées pour le rail et des quais physiques pour le bus, pas
5 366 lieux uniques. Les données bus ont été téléchargées le 5 septembre 2026 depuis
le [WFS SYTRAL](https://www.data.gouv.fr/datasets/lignes-de-bus-du-reseau-transports-en-commun-lyonnais)
(couche `sytral:tcl_sytral.tcllignebus_2_0_0`, licence ouverte indiquée par la fiche).

`bun run generate:lignes` reconstruit le rail puis les bus ; `bun run generate:bus`
actualise seulement les bus. Dans `scripts/fetch_tcl_bus.py`, `active_regular` filtre
les variantes régulières de type NOM/NOR, leur période publiée et leur sens.
`route_stops` croise la desserte ligne:sens des quais avec le tracé (projection à
50 m au plus). Les terminus contrôlent son orientation ; les quais sont conservés
séparément et ordonnés dans `stopSequence`. Les variantes sans sens/terminus
vérifiables, les boucles de même terminus, les morceaux discontinus et les services
spéciaux ne sont pas importés. Le rayon de 16 km reste celui du produit.

Ces séquences alimentent l'horaire GTFS de recette (`scripts/build-gtfs-fixture.py`) et
les cellules de la carte ; le calcul d'itinéraires lui-même utilise l'archive GTFS
officielle chargée dans MOTIS, avec ses horaires réels.

Le bus utilise une référence
[bus thermique ADEME Impact CO₂](https://impactco2.fr/outils/transport/busthermique)
de 122 gCO₂e/passager-km (construction et usage, valeur consultée le 5 septembre 2026).
Le WFS n’indique pas la motorisation : cette approximation est affichée et s’applique
aussi aux trolleybus ; ce n’est pas un facteur moyen mesuré de la flotte TCL.
Les badges de ligne adaptent leur texte à la luminance de la couleur officielle.

Validation : `bun run check`, dont `scripts/bus-import.test.ts`, qui exécute
l’ingestion Python avec de petits jeux de données, puis vérifie son JSON sous Bun.
`E2E_BASE_URL=https://localhost:4000 bun scripts/e2e-bus.mjs` vérifie une recherche
réelle Gare Saint-Paul → Laurent Bonnevay (TB11) à 390/1280 px.

La documentation `/api/doc` utilise Scalar 1.67.0 et une politique CSP limitée à cette page.
Le JSON `/api/doc/json` conserve `default-src 'none'`. Vérification navigateur :
`bun scripts/e2e-api-doc.mjs`. Filtres et mobile : `bun scripts/e2e-mobile-transit.mjs`.

## Vérifier avant de pousser

`bun run ci` est la commande utilisée aussi par `.github/workflows/ci.yml`.
Elle installe les dépendances avec le lockfile figé, lance `check` et les métriques,
prépare puis démarre un moteur MOTIS dédié sur les fixtures versionnées, crée une base SQLite vide et le
compte de démonstration, puis exécute axe-core, la planification (9 assertions),
les filtres TC mobiles et la documentation Scalar. Le banc de performance reste
indicatif. Une erreur bloquante interrompt la recette ; le moteur et le serveur
sont arrêtés à la fin.

Prérequis : Bun 1.4.0, Docker accessible et Chromium (`CHROME_BIN` si nécessaire).
Le serveur de recette utilise le port 4101 ; `CI_API_PORT` permet de le changer.
Un port déjà occupé est refusé pour ne jamais tester un autre serveur par erreur.
La base et les index sont temporaires ; aucun compte ni moteur de développement
ou de production n’est réutilisé. L’extrait routier OSM, l’horaire GTFS de recette et leur provenance sont dans
`scripts/fixtures/`. Les diagnostics sont dans `tmp/ci/*.log` et les captures
dans `tmp/screenshots/`, conservés par GitHub en cas d’échec.

La disponibilité de BAN, des flux GBFS, des tuiles et du CDN Scalar
reste externe : ce sont toujours les vrais appels. MOTIS calcule localement sur
l’extrait réel versionné et l’horaire de recette ; aucun faux tracé ni service public de routage ne remplace
un moteur manquant. Attendre une recette locale réussie avant `git push`, puis
contrôler le résultat GitHub.

Les endpoints conservés et leurs appelants sont recensés dans [API-USAGE](docs/API-USAGE.md).
La session porte déjà l’état initial du compte ; les écrans utilisent ensuite les
GET de chaque ressource. La lecture globale indépendante a été supprimée.
