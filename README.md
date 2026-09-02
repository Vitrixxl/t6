# UrbanFlow Mobility

Application PWA React/TypeScript **mobile first** pour le sujet T6 CDSD "Urban Flow Mobility" (session septembre 2026).

## Architecture

Deux briques, une seule origine pour le navigateur :

- **Client** (`src/`) : PWA React/TypeScript. Ecrit d'abord dans son cache local, donc utilisable hors ligne.
- **API** (`server/`) : Elysia sur Bun + SQLite (`bun:sqlite`). Comptes, sessions, trajets, routines, itinéraires sauvegardés, calcul d'itinéraires.

Le client sonde `/api/health` au demarrage. API joignable : elle fait autorite, le cache local est hydrate depuis
le serveur et les mutations partent dans une file d'attente rejouable (patron *outbox*, operations idempotentes).
API absente : l'application bascule en **mode autonome** (comptes et historiques dans le navigateur), sans rien
casser. C'est ce qui permet de tenir l'exigence C10 (connectivite variable) sans sacrifier la persistance serveur.

| | Mode serveur | Mode autonome |
| --- | --- | --- |
| Comptes | SQLite, mot de passe argon2id (OWASP) | navigateur, PBKDF2-SHA-256 |
| Session | cookie httpOnly + jeton revocable en base | `sessionStorage` |
| Donnees | serveur, synchronisees hors ligne | navigateur uniquement |
| Multi-appareil | oui | non |

## Organisation du code

Aucun fichier ne dépasse 450 lignes ; chaque dossier porte une responsabilité.

**API** (`server/src/`, 113 lignes au maximum)

| Dossier | Rôle |
| --- | --- |
| `config/` | lecture et validation des variables d'environnement |
| `db/` | ouverture SQLite ; le schéma vit dans `schema.sql`, versionné à part |
| `models/` | contrats TypeBox : valident la requête, typent le gestionnaire et génèrent l'OpenAPI |
| `repositories/` | un dépôt par table — seule couche qui connaisse le SQL |
| `services/` | règles métier (synchronisation, sessions, routage et son cache) |
| `plugins/` | contexte, garde d'authentification, débit, en-têtes, journal, erreurs |
| `routes/` | gestionnaires HTTP, sans règle métier |

**Client** (`src/`)

| Dossier | Rôle |
| --- | --- |
| `lib/planner/` | moteur d'itinéraires : un générateur par mode dans `options/`, plus scoring et règles |
| `lib/transport/` | intégration open data : `geocoding/`, `routing/`, `feeds/` |
| `lib/api/` | couche serveur du client : sonde, file d'attente hors ligne, synchronisation |
| `lib/auth/` | authentification : crypto, validation, stockage local, arbitrage API/autonome |
| `components/map/` | carte MapLibre : composant, popups, sources |
| `components/planner/trips/` | module trajets : hub, listes, formulaire, objectifs |
| `components/app/hooks/` | géolocalisation et calcul d'itinéraires |

Pour une revue de code, l'ordre de lecture le plus court : `server/src/routes/auth.ts` (sécurité),
`server/src/services/sync.ts` et `src/lib/api/outbox.ts` (le couple hors ligne / idempotence),
`src/lib/planner/index.ts` (le métier).

## Livrables

- `src/` : application fonctionnelle (auth + profils, planificateur multimodal, trajets programmes et routines, objectifs, suivi carbone).
- `server/` : API HTTP (authentification, profil, synchronisation, RGPD, calcul d'itinéraires).
- `public/manifest.webmanifest` + `public/sw.js` : PWA installable avec cache offline.
- `output/pdf/CASCALES_Vitrice_Titre6_B3DEV_Septembre2026.pdf` : dossier projet (30 pages, généré par script).
- `output/screens/` : captures automatisées (Playwright) intégrées au dossier.
- `CHECKLIST.md` : traçabilité exigences → preuves.

## APIs réelles intégrées

| Domaine | Source | Mode |
| --- | --- | --- |
| Géocodage adresses | `api-adresse.data.gouv.fr` (BAN) | live navigateur |
| Géocodage lieux/quartiers | Photon (`photon.komoot.io`, OSM) | live navigateur |
| Routage | OSRM (foot/bike/driving), auto-hébergeable | relais API `/api/route` (cache SQLite partagé) |
| Vélos partagés | GBFS v3 Vélo'v (`api.cyclocity.fr`) | live navigateur |
| Trottinettes | GBFS v2.3 Dott Lyon (`gbfs.api.ridedott.com`) | live navigateur |
| Transport public | GTFS statique TCL/SYTRAL (ODbL, transport.data.gouv.fr) | intégré au build (`bun run generate:gtfs`) |
| Desserte et tracés des lignes | WFS SYTRAL `data.grandlyon.com` (ODbL, sans jeton) | intégré au build (`bun run generate:lignes`) |
| Météo | Open-Meteo | live navigateur |

Chaque flux a un fallback local (`public/data/`) signalé dans l'UI.

## Calcul d'itinéraires

Le navigateur n'appelle jamais le calculateur directement : il passe par `GET /api/route`, qui met les tracés en cache dans SQLite et les partage entre tous les clients.

Sans configuration, la source est l'instance publique de démonstration d'OpenStreetMap. Elle dépanne, mais elle n'a **aucun engagement de service et limite par adresse IP** — une session de test un peu active suffit à la déclencher (cf. `docs/BUGS.md`, B13).

Pour supprimer toute dépendance tierce à l'exécution, héberger OSRM localement :

```bash
./infra/osrm-prepare.sh                      # télécharge et prétraite les 3 profils (une fois)
docker compose -f infra/compose.yml up -d    # API + calculateur
```

`infra/compose.yml` lance **l'API et le calculateur ensemble** : l'API y vise la façade interne, il n'y a rien à configurer. Le client reste lancé à part (`bun run dev`) — c'est une PWA, l'emballer n'apporterait rien.

Pour faire pointer une API lancée hors conteneur sur le calculateur local, publier le port de la façade et renseigner `OSRM_BASE_URL=http://127.0.0.1:5000` dans `.env`. **Tant que cette ligne est absente ou vide, l'application utilise l'instance publique** : revenir en arrière ne demande rien d'autre que de la commenter.

Seul prérequis : **Docker**. `osmium` est facultatif — s'il est présent la région est découpée autour de Lyon et le prétraitement est bien plus rapide ; sinon toute la région Rhône-Alpes est traitée, pour un résultat identique sur Lyon.

OSRM sert un profil par processus — piéton, vélo et voiture n'ont pas les mêmes règles sur les mêmes rues — d'où trois services, regroupés par une façade derrière un seul port. Les chemins reproduisent ceux de l'instance publique, si bien que basculer de l'une à l'autre ne change qu'une URL.

## Commandes

```bash
bun install              # bun.lock est le seul lockfile du projet
python3 -m venv .venv && .venv/bin/python -m pip install -r requirements.txt

cp .env.example .env     # secrets (jeton GTFS, compte Grand Lyon) et réglages API, jamais committés
bun run dev              # API + client ensemble (Ctrl+C coupe les deux)
bun run seed:demo        # compte de démonstration côté serveur
bun run generate:gtfs    # régénère le feed GTFS depuis la source officielle TCL
bun run generate:lignes  # desserte par arrêt et tracés réels des lignes (open data, sans jeton)
bun run generate:icons   # icônes PWA
bun run generate:pdf     # dossier projet PDF
bun run check            # lint + typage (client et serveur) + tests + build production
bun run e2e              # scénario E2E de planification (Playwright, 5 assertions)
```

`bun run dev:web` lance le client seul : sans API, l'application démarre en mode autonome.

**Toute la chaîne JavaScript tourne sous Bun** : gestionnaire de paquets, exécution de l'API, serveur de
développement et build Vite (`--bun`), tests client (Vitest) et tests d'API (`bun test`), scripts d'outillage.
Seules l'ingestion GTFS et la génération du dossier restent en Python, faute d'équivalent dans l'écosystème
JavaScript.
L'API tourne sous Bun, sans étape de compilation et sans dépendance native à compiler : `bun server/src/index.ts`
suffit. La surface spécifique à Bun se limite à trois fichiers (`db/index.ts`, `security/password.ts`,
`config/index.ts`) : le portage vers Node se ferait via `@elysiajs/node`, `node:sqlite` et scrypt.

Le feed `public/data/gtfs-feed.json` est déjà versionné : `GTFS_SOURCE_URL` ne sert qu'à le régénérer.
Chemin Chromium des scripts configurable via `CHROME_BIN`.

## Sécurité / RGPD

Côté serveur : mots de passe hachés en argon2id (19 Mio, t=2, p=1 — paramètres OWASP, fonction *memory-hard*),
sessions opaques de 256 bits dont seule l'empreinte SHA-256 est stockée (révocables à la déconnexion), cookie
`httpOnly` + `SameSite=Lax` (pas de jeton manipulable en JavaScript, pas de CSRF inter-site), validation TypeBox de
toute entrée, limitation de débit (10 req/min sur l'authentification), en-têtes de sécurité helmet, message
d'erreur unique à la connexion pour ne pas divulguer l'existence d'un compte. Aucun en-tête CORS n'est émis :
l'API n'est consommée qu'en même origine.

RGPD : export complet du compte (`GET /api/me/export`, art. 20) et suppression en cascade (`DELETE /api/me`,
art. 17), historiques bornés à 50 entrées (minimisation), géolocalisation sur action explicite.

En mode autonome, l'authentification locale PBKDF2-SHA-256 (120 000 itérations) démontre F1 sans être présentée
comme une frontière de sécurité : c'est le serveur qui joue ce rôle dès qu'il est présent.
