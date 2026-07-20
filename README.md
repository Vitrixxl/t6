# UrbanFlow Mobility

Application PWA React/TypeScript **mobile first** pour le sujet T6 CDSD "Urban Flow Mobility" (session septembre 2026).

## Livrables

- `src/` : application fonctionnelle (auth + profils, planificateur multimodal, trajets programmes et routines, objectifs, suivi carbone).
- `public/manifest.webmanifest` + `public/sw.js` : PWA installable avec cache offline.
- `output/pdf/dossier-projet-urbanflow.pdf` : dossier projet (30 pages, généré par script).
- `output/screens/` : captures automatisées (Playwright) intégrées au dossier.
- `CHECKLIST.md` : traçabilité exigences → preuves.

## APIs réelles intégrées

| Domaine | Source | Mode |
| --- | --- | --- |
| Géocodage adresses | `api-adresse.data.gouv.fr` (BAN) | live navigateur |
| Géocodage lieux/quartiers | Photon (`photon.komoot.io`, OSM) | live navigateur |
| Routage | OSRM `routing.openstreetmap.de` (foot/bike/driving) | live navigateur |
| Vélos partagés | GBFS v3 Vélo'v (`api.cyclocity.fr`) | live navigateur |
| Trottinettes | GBFS v2.3 Dott Lyon (`gbfs.api.ridedott.com`) | live navigateur |
| Transport public | GTFS statique TCL/SYTRAL (ODbL, transport.data.gouv.fr) | intégré au build (`npm run generate:gtfs`) |
| Météo | Open-Meteo | live navigateur |
| Alertes trafic TCL | SIRI SX `data.grandlyon.com` (compte gratuit) | proxy serveur `/api/tcl-alertes` (cache 30 s) |

Chaque flux a un fallback local (`public/data/`) signalé dans l'UI ; sans compte data.grandlyon.com dans `.env`, les alertes TCL retombent sur des incidents simulés étiquetés.

## Commandes

```bash
npm install
python3 -m venv .venv && .venv/bin/python -m pip install -r requirements.txt

cp .env.example .env     # GTFS_SOURCE_URL (jeton) + GRANDLYON_LOGIN/PASSWORD (alertes TCL), jamais committés
npm run generate:gtfs    # régénère le feed GTFS depuis la source officielle TCL
npm run generate:icons   # icônes PWA
npm run generate:pdf     # dossier projet PDF
npm run check            # lint + tests unitaires + build production
npm run e2e              # scénario E2E de planification (Playwright, 5 assertions)
npm run dev              # serveur de développement
```

Le feed `public/data/gtfs-feed.json` est déjà versionné : `GTFS_SOURCE_URL` ne sert qu'à le régénérer.
Chemin Chromium des scripts configurable via `CHROME_BIN`.

## Sécurité / RGPD

Comptes et historiques restent dans le navigateur (version autonome). L'authentification locale PBKDF2-SHA-256
(120 000 itérations, sel aléatoire) démontre F1 mais n'est pas présentée comme une frontière de sécurité de
production. La cible prévoit une authentification serveur OIDC/Argon2id. Géolocalisation sur action explicite,
historique et compte supprimables en un clic ; les appels aux tiers et leurs limites sont documentés dans le dossier.
