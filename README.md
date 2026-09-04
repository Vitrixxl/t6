# UrbanFlow Mobility

Application PWA React/TypeScript **mobile first** pour le sujet T6 CDSD "Urban Flow Mobility" (session septembre 2026).

## Architecture

Deux briques, une seule origine pour le navigateur :

- **Client** (`src/`) : PWA React/TypeScript 7. Les donnees du compte vivent dans le cache de requetes (React Query), amorce a la connexion. Tous les appels a l'API UrbanFlow passent par Eden Treaty et heritent leurs types de l'arbre Elysia.
- **API** (`server/`) : Elysia sur Bun + SQLite (`bun:sqlite`). Comptes, sessions, trajets, routines, itinéraires sauvegardés, calcul d'itinéraires.
- **Contrats** (`src/contracts/`) : un schema zod par objet echange, importe par les deux : validation de l'API, validation des formulaires (react-hook-form), types, OpenAPI.

Le serveur est la seule source de verite : comptes en SQLite (argon2id), session par cookie `httpOnly` revocable
en base, etat du compte rendu a la connexion, puis collections lues par `GET`. Chaque trajet, routine ou
itineraire enregistre s'ecrit seul par `PUT /api/.../:id` et se retire par `DELETE /api/.../:id` ; aucun corps HTTP
ne contient une collection complete. `PUT /api/trips/planned/:id/completion` termine le trajet et cree son entree
carbone dans une seule transaction idempotente. Seul `DELETE /api/trips/history` efface volontairement tout
l'historique. Les envois sont serialises. Pas de cache local persistant : les vues vivent dans le cache React Query
(`src/queries/`) le temps de la session, et une ecriture refusee est signalee a l'utilisateur, la vue concernee
etant relue depuis le serveur. Exigence C10 (connectivite variable) : cache du
socle et des flux transport par le service worker, etats de chargement explicites, erreurs reseau propres.

Il n'y a pas de mode sans serveur : c'est l'API qui sert le client, une API absente est une page absente.

## Organisation du code

Le decoupage suit les responsabilites fonctionnelles ; la longueur seule ne
commande pas la creation d'un module.

**API** (`server/src/`)

| Dossier | Rôle |
| --- | --- |
| `config/` | lecture et validation des variables d'environnement |
| `db/` | ouverture SQLite via Drizzle ; le schéma vit dans `schema.ts`, les migrations générées dans `server/drizzle/` |
| `repositories/` | un dépôt par table — seule couche qui interroge la base (Drizzle, requêtes paramétrées) |
| `services/` | règles métier qui composent plusieurs opérations : completion, sessions, routage et son cache |
| `plugins/` | contexte, garde d'authentification, débit, en-têtes, journal, erreurs |
| `routes/` | gestionnaires HTTP, sans règle métier |

**Client** (`src/`)

| Dossier | Rôle |
| --- | --- |
| `lib/planner/` | moteur d'itinéraires : un générateur par mode dans `options/`, plus scoring et règles |
| `lib/transport/` | intégration open data : `geocoding/`, `routing/`, `feeds/` |
| `contracts/` | schemas zod partages avec l'API : validation, types derives, OpenAPI |
| `lib/api/` | client Eden Treaty type depuis l'API Elysia, authentification, une commande par ressource du compte |
| `queries/` | ressources servies par l'API dans le cache React Query : une ressource par fichier, sa requete et ses actions |
| `state/` | etat d'ecran partage entre modules (jotai) : formulaire de planification, hub |
| `components/map/` | carte MapLibre : cycle de vie, couches, popups, sources et marqueurs |
| `components/planner/` | recherche : état réseau, liste de résultats et panneaux de restitution séparés |
| `components/planner/trips/` | module trajets : hub, listes, formulaire, champs de planification et objectifs |
| `components/app/` | orchestration de l'écran, dispositions desktop/mobile et hooks de géolocalisation/routage |
| `components/tutorial/` | parcours de découverte distincts : 11 étapes desktop et 9 étapes ciblant les contrôles réellement présents sur mobile |

Pour une revue de code, l'ordre de lecture le plus court : `server/src/routes/auth.ts` (securite),
`server/src/routes/planned-trips.ts`, `server/src/services/planned-trips.ts`, `src/lib/api/planned-trips.ts`
et `src/queries/planned-trips.ts` (commande granulaire de bout en bout), puis
`src/queries/routes.ts` et `src/lib/planner/index.ts` (moteur d'itineraires).

## Livrables

- `src/` : application fonctionnelle (auth + profils, planificateur multimodal, trajets programmes et routines, objectifs, suivi carbone).
- `server/` : API HTTP (authentification, profil, ressources du compte, RGPD, calcul d'itineraires).
- `public/manifest.webmanifest` + `public/sw.js` : PWA installable avec cache offline.
- `output/pdf/CASCALES_Vitrice_Titre6_B3DEV_Septembre2026.pdf` : dossier projet (30 pages, généré par script).
- `output/screens/` : captures automatisées (Playwright) intégrées au dossier.
- `CHECKLIST.md` : traçabilité exigences → preuves.

## APIs réelles intégrées

| Domaine | Source | Mode |
| --- | --- | --- |
| Géocodage adresses | `api-adresse.data.gouv.fr` (BAN) | live navigateur |
| Géocodage lieux/quartiers | Photon (`photon.komoot.io`, OSM) | live navigateur |
| Routage | OSRM (foot/bike ; trottinette sur bike, voiture invisible sur driving), auto-hébergeable | relais API `/api/route` et `/api/route-matrix` (cache SQLite partagé) |
| Vélos partagés | GBFS v3 Vélo'v (`api.cyclocity.fr`) | live navigateur |
| Trottinettes | GBFS v2.3 Dott Lyon (`gbfs.api.ridedott.com`) | live navigateur |
| Transport public | GTFS statique TCL/SYTRAL (ODbL, transport.data.gouv.fr) | intégré au build (`bun run generate:gtfs`) |
| Desserte et tracés des lignes | WFS SYTRAL `data.grandlyon.com` (ODbL, sans jeton) | intégré au build (`bun run generate:lignes`) |
| Météo | Open-Meteo | live navigateur |

Chaque flux a un fallback local (`public/data/`) signalé dans l'UI.

## Calcul d'itinéraires

Le navigateur n'appelle jamais le calculateur directement. Une recherche se deroule en quatre temps :

1. Haversine ne garde que huit stations ou arrets proches, afin de borner le cout.
2. `POST /api/route-matrix` demande a OSRM la duree routable vers chacun d'eux ; le moteur choisit donc l'acces le plus rapide a pied ou a velo, pas le point geometriquement le plus proche. En parallele, une matrice voiture `1 x 1` mesure la reference carbone entre les deux extremites.
3. Le moteur assemble les options, puis `GET /api/route` mesure et trace chaque segment de voirie avant affichage.
4. Quand toutes les options portent leurs mesures reelles, la meme reference voiture leur est appliquee, puis elles sont affichees.

Les deux routes utilisent le meme cache SQLite partage entre tous les clients. Une mesure de matrice peut reutiliser un trace deja connu, et inversement le cache evite de redemander les memes couples de points a OSRM. Les appels a l'API UrbanFlow sont faits avec Eden Treaty : leurs corps et leurs reponses sont inferes directement depuis les routes Elysia, sans type HTTP recopie dans le front.

Une correspondance entre deux lignes apparait comme une etape pietonne de quatre minutes. Le temps est explicite, mais aucun trait interieur n'est invente : le GTFS publie la desserte et les traces des lignes, pas les cheminements entre quais.

## Facteurs carbone

La voiture n'appartient pas aux modes proposes ni aux preferences. C'est un
scenario contrefactuel invisible, mesure une seule fois par le profil OSRM
`driving` pour chaque couple depart-arrivee :

```text
CO2e voiture = distance routiere voiture x 142 gCO2e/km
CO2e evite   = CO2e voiture - CO2e de l'option mesuree
```

Toutes les options d'une recherche utilisent donc strictement la meme
reference, meme si leurs propres distances different. Une economie negative
est conservee et affichee comme des `gCO2e supplementaires`. Si le profil
voiture est indisponible, les alternatives restent visibles avec leur propre
empreinte et l'interface indique `Comparaison voiture indisponible` ; aucun zero
ni trajet approche n'est invente.

| Usage | Facteur | Perimetre | Source/version |
| --- | ---: | --- | --- |
| Reference voiture | 142 gCO2e/passager-km | voiture thermique moyenne diesel, une personne | ADEME, modelisation transport 2025, consultee le 04/09/2026 |
| Tramway (`route_type=0`) | 3,8 gCO2e/passager-km | par passager-kilometre | ADEME Impact CO2, modele 2025, consulte le 04/09/2026 |
| Metro (`route_type=1`) | 4,2 gCO2e/passager-km | par passager-kilometre | ADEME Impact CO2, modele 2025, consulte le 04/09/2026 |
| Funiculaire (`route_type=7`) | 4,2 gCO2e/passager-km | approximation par le facteur metro, faute de facteur specifique | ADEME Impact CO2, modele 2025, consulte le 04/09/2026 |
| Marche / Velo'v / trottinette | 0 / 4 / 15 gCO2e/passager-km | hypotheses simplifiees UrbanFlow 2025 | versionnees dans `src/lib/planner/emissions.ts` |

La valeur, l'unite, le perimetre, la source, le millesime et la date de
consultation vivent ensemble dans `src/lib/planner/emissions.ts`. Le type
`CarbonReference` conserve aussi la version du facteur utilisee.

## Objectifs carbone personnels

Le profil distingue trois notions : le budget carbone hebdomadaire, l'objectif
d'economie hebdomadaire et l'objectif d'economie mensuel. Les deux objectifs
d'economie sont independants : le mensuel n'est pas une multiplication arbitraire
du chiffre hebdomadaire. Ils sont valides par le contrat partage, persistes avec
`PUT /api/me/profile`, puis compares aux memes agregats semaine/mois que le suivi
carbone dans le planificateur.

Le tutoriel de premiere visite suit la disposition courante. Sur mobile, il
montre successivement la recherche, la carte, le GPS, les disponibilites a
proximite, les couches, les trajets/objectifs et le profil. Sa bulle se place
au-dessus ou au-dessous du controle vise pour ne pas le masquer.

Sans configuration, la source est l'instance publique de démonstration d'OpenStreetMap. Elle dépanne, mais elle n'a **aucun engagement de service et limite par adresse IP** — une session de test un peu active suffit à la déclencher (cf. `docs/BUGS.md`, B13).

Pour supprimer toute dépendance tierce à l'exécution, héberger OSRM localement :

```bash
./infra/osrm-prepare.sh                      # télécharge et prétraite les 3 profils (une fois)
docker compose -f infra/compose.yml up -d    # application + calculateur
```

`infra/compose.yml` lance **l'application et les trois moteurs ensemble** : l'API appelle directement `osrm-foot:5000`, `osrm-bike:5000` et `osrm-car:5000` sur le réseau Docker, sans port OSRM publié ni proxy intermédiaire. Les variables `OSRM_FOOT_URL`, `OSRM_BIKE_URL` et `OSRM_CAR_URL` y sont déjà configurées. L'application écoute en **HTTPS** sur le port 4000, avec un certificat auto-signé généré au premier démarrage. Pour y accéder depuis le réseau local, inscrire l'adresse de la machine dans le certificat : `TLS_EXTRA_HOSTS=IP:192.168.1.37 docker compose -f infra/compose.yml up -d`.

Pour une API lancée hors conteneur, ajouter temporairement une publication loopback à chaque service dans Compose : `ports: ['127.0.0.1:5001:5000']` pour `osrm-foot`, `5002:5000` pour `osrm-bike` et `5003:5000` pour `osrm-car`, toujours avec `127.0.0.1`. Renseigner ensuite `.env` :

```dotenv
OSRM_FOOT_URL=http://127.0.0.1:5001
OSRM_BIKE_URL=http://127.0.0.1:5002
OSRM_CAR_URL=http://127.0.0.1:5003
```

Chaque variable absente ou vide utilise son profil public par défaut : `https://routing.openstreetmap.de/routed-foot`, `/routed-bike` ou `/routed-car`. Le préfixe public appartient à l'URL configurée ; le serveur ajoute uniquement `/route/v1/<profil>/` ou `/table/v1/<profil>/`. Les appels publics partagent toujours la limitation de débit. Une panne ne déclenche pas de bascule vers un autre hébergeur : le cache connu reste utilisable, sinon l'API répond 503.

Migration : remplacer l'ancienne variable `OSRM_BASE_URL` par ces trois variables. Après mise à jour d'une pile existante, `docker compose -f infra/compose.yml up -d --build --remove-orphans` retire aussi l'ancien conteneur Caddy.

Seul prérequis : **Docker**. `osmium` est facultatif — s'il est présent la région est découpée autour de Lyon et le prétraitement est bien plus rapide ; sinon toute la région Rhône-Alpes est traitée, pour un résultat identique sur Lyon.

OSRM sert un profil par processus : piéton, vélo et voiture n'ont pas les mêmes règles sur les mêmes rues. La trottinette reprend le moteur vélo ; le moteur voiture utilise le profil `driving` et ne fournit que la référence carbone, jamais une option proposée. Trois URL distinctes évitent un conteneur intermédiaire et sa consommation de ressources ; aucun gain mémoire chiffré n'a été mesuré.

## Commandes

```bash
bun install              # bun.lock est le seul lockfile du projet
python3 -m venv .venv && .venv/bin/python -m pip install -r requirements.txt

cp .env.example .env     # secrets (jeton GTFS, compte Grand Lyon) et réglages API, jamais committés
bun run dev              # serveur + reconstruction du client a chaque modification
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
Aucun bundler ni lanceur de tests tiers. Seules l'ingestion GTFS et la génération du dossier restent en
Python, faute d'équivalent dans l'écosystème JavaScript.

Le depot conserve TypeScript 7. En attendant sa prise en charge par
`typescript-eslint`, ESLint analyse la syntaxe TypeScript avec le parseur Babel ;
`tsc` strict reste l'autorite pour les types et les symboles inutilises, et une
regle ESLint interdit explicitement le mot-cle `any`. Le lint bloque aussi une
complexite cyclomatique superieure a 10 ou plus de trois niveaux d'imbrication :
un flux dense doit etre decoupe en responsabilites nommees avant d'etre fusionne.

Le serveur porte **l'API et le client** : une seule origine, donc un cookie de session de première partie
et aucun en-tête CORS. En développement, `bun run dev` lance le serveur et reconstruit le client à chaque
modification — il faut rafraîchir la page, il n'y a pas de rechargement à chaud.
L'API tourne sous Bun, sans étape de compilation et sans dépendance native à compiler : `bun server/src/index.ts`
suffit. La surface spécifique à Bun se limite à trois fichiers (`db/index.ts`, `security/password.ts`,
`config/index.ts`) : le portage vers Node se ferait via `@elysiajs/node`, le driver `drizzle-orm/better-sqlite3`
(les dépôts ne changent pas) et scrypt.

Le feed `public/data/gtfs-feed.json` est déjà versionné : `GTFS_SOURCE_URL` ne sert qu'à le régénérer.
Chemin Chromium des scripts configurable via `CHROME_BIN`.

## Sécurité / RGPD

Côté serveur : mots de passe hachés en argon2id (19 Mio, t=2, p=1 — paramètres OWASP, fonction *memory-hard*),
sessions opaques de 256 bits dont seule l'empreinte SHA-256 est stockée (révocables à la déconnexion), cookie
`httpOnly` + `SameSite=Lax` (pas de jeton manipulable en JavaScript, pas de CSRF inter-site), validation zod de
toute entrée (les memes contrats que les formulaires du client), limitation de débit (10 req/min sur l'authentification), en-têtes de sécurité helmet, message
d'erreur unique à la connexion pour ne pas divulguer l'existence d'un compte. Aucun en-tête CORS n'est émis :
l'API n'est consommée qu'en même origine.

RGPD : export complet du compte (`GET /api/me/export`, art. 20) et suppression en cascade (`DELETE /api/me`,
art. 17), historiques bornés à 50 entrées (minimisation), géolocalisation sur action explicite.
