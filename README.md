# UrbanFlow Mobility

Application PWA React/TypeScript **mobile first** pour le sujet T6 CDSD "Urban Flow Mobility" (session septembre 2026).

## Livrables

- `src/` : application fonctionnelle (auth + profils, planificateur multimodal, navigation GPS, suivi carbone).
- `public/manifest.webmanifest` + `public/sw.js` : PWA installable avec cache offline.
- `output/pdf/dossier-projet-urbanflow.pdf` : dossier projet (21 pages, généré par script).
- `output/screens/` : captures automatisées (Playwright) intégrées au dossier.
- `CHECKLIST.md` : traçabilité exigences → preuves.

## APIs réelles intégrées

| Domaine | Source | Mode |
| --- | --- | --- |
| Géocodage | `api-adresse.data.gouv.fr` (BAN) | live navigateur |
| Routage | OSRM `routing.openstreetmap.de` (foot/bike/driving) | live navigateur |
| Vélos partagés | GBFS v3 Vélo'v (`api.cyclocity.fr`) | live navigateur |
| Trottinettes | GBFS v2.3 Dott Lyon (`gbfs.api.ridedott.com`) | live navigateur |
| Transport public | GTFS statique TCL/SYTRAL (ODbL, transport.data.gouv.fr) | intégré au build (`npm run generate:gtfs`) |
| Météo | Open-Meteo | live navigateur |

Chaque flux a un fallback local (`public/data/`) signalé dans l'UI ; les incidents sont simulés (flux SIRI opérateur sous clé).

## Commandes

```bash
npm install
python3 -m venv .venv && .venv/bin/python -m pip install -r requirements.txt

npm run generate:gtfs    # régénère le feed GTFS depuis le zip officiel TCL
npm run generate:icons   # icônes PWA
npm run generate:pdf     # dossier projet PDF
npm run check            # lint + 9 tests unitaires + build production
npm run dev              # serveur de développement
```

## Sécurité / RGPD

Comptes et historiques restent dans le navigateur (version autonome). Mots de passe dérivés PBKDF2-SHA-256
(120 000 itérations, sel aléatoire) via Web Crypto. Géolocalisation avec consentement explicite, historique
et compte supprimables en un clic.
