# UrbanFlow Mobility - Checklist Projet

Source: `/home/vitrix/Downloads/2026 SEPTEMBRE T6 CDSD - SUJET 'URBAN FLOW MOBILITY'.pdf`

## 1. Cadrage et livrables

- [x] Identifier les objectifs client et besoins utilisateurs d'une metropole de 500 000 habitants.
- [x] Creer une application fonctionnelle originale pour une plateforme de mobilite urbaine intelligente.
- [x] Creer un dossier projet PDF structure, limite a 40 pages.
- [x] Fournir une preuve de verification terminal: lint, build, tests automatises et generation PDF.

## 2. Dossier projet PDF

- [x] Expliquer le contexte, les objectifs client et les besoins specifiques.
- [x] Proposer plusieurs solutions techniques et recommander une solution justifiee.
- [x] Definir l'approche de developpement, l'environnement, les outils et les roles de l'equipe.
- [x] Integrer une demarche d'amelioration continue.
- [x] Ajouter un diagramme UML de cas d'utilisation avec description.
- [x] Ajouter un diagramme UML de sequence avec description.
- [x] Ajouter un diagramme UML de communication avec description.
- [x] Rediger les specifications fonctionnelles d'une fonctionnalite cle.
- [x] Rediger les specifications techniques d'une fonctionnalite cle.
- [x] Decrire l'architecture technique avec evolutivite et maintenabilite.
- [x] Decrire le traitement des bogues, notamment en preproduction.

## 3. Application - Fonctionnalites obligatoires

- [x] F1 - Inscription utilisateur.
- [x] F1 - Connexion utilisateur.
- [x] F1 - Gestion de profil de mobilite personnalise.
- [x] F2 - Planificateur d'itineraires multimodal.
- [x] F2 - Utilisation de la geolocalisation en temps reel.
- [x] F2 - Carte interactive affichant la position, la destination et les trajets disponibles.
- [x] F2 - Selection visuelle des differents trajets alternatifs.
- [x] F2 - Prise en compte des preferences utilisateur dans le calcul d'itineraire.
- [x] F3 - Integration de donnees type GTFS pour les transports publics.
- [x] F3 - Integration de donnees de velos/trottinettes partages.

## 4. Application - Fonctionnalite au choix

- [x] Implementer un calculateur d'empreinte carbone avec suivi personnel.

## 5. Contraintes techniques et reglementaires

- [x] C1 - PWA: manifest, service worker et application installable.
- [x] C2 - Responsive/UX: interface utilisable mobile et desktop.
- [x] C2 - Interface mobile-first inspiree d'Urbaninator avec carte plein ecran, panneaux flottants et bottom sheet mobile.
- [x] C2 - Mode shell inspire d'Urbaninator: rail gauche docke, carte centrale encadree, barre recherche fusionnee au shell, rail detail droit.
- [x] C3 - UI basee sur shadcn/Tailwind avec composants locaux Button, Card, Badge, Input et Select.
- [x] C3 - Composants Radix/shadcn pour les controles principaux (dialog, popover, calendrier react-day-picker, drawer), pas de controles natifs bruts.
- [x] C3 - Normes et standards: TypeScript, ESLint, structure maintenable.
- [x] C4 - Securite OWASP: cartographie OWASP Top 10:2025, limites de l'auth locale et controles cibles documentes.
- [x] C5 - Eco-conception: bundle leger, cache offline, limitation des ressources.
- [x] C6 - Geolocalisation: precision affichee, consentement et fallback manuel.
- [x] C7 - Accessibilite cible WCAG 2.1 AA: navigation clavier, contrastes, labels et ARIA ; audit formel restant explicite.
- [x] C8 - RGPD: consentement geolocalisation, minimisation et suppression des donnees locales.
- [x] C9 - Interoperabilite: modeles de donnees transport compatibles GTFS/GBFS.
- [x] C10 - Performances: fonctionnement avec connectivite variable, cache et etats de chargement.
- [x] C11 - Securite des donnees de deplacement sensibles: sessions locales et suppression des historiques.
- [x] C12 - Normes transport: prise en compte PMR et accessibilite des transports publics.

## 6. Verification finale

- [x] Installer les dependances sans erreur.
- [x] Executer les tests unitaires avec succes.
- [x] Executer le lint avec succes.
- [x] Executer le build de production avec succes.
- [x] Generer le dossier projet PDF.
- [x] Rendre le PDF en images et verifier la lisibilite.
- [x] Auditer la checklist: chaque case doit etre cochee avec une preuve concrete.

## 7. Integration d'APIs reelles (mise a jour finale)

- [x] Geocodage live: api-adresse.data.gouv.fr (BAN).
- [x] Routage live: OSRM routing.openstreetmap.de (profils foot/bike/driving) avec instructions traduites.
- [x] GBFS live Velo'v v3 (station_information + station_status, api.cyclocity.fr) fusionne dans la carte.
- [x] GBFS live Dott Lyon v2.3 (free_bike_status) pour les trottinettes free-floating.
- [x] GTFS statique reel TCL/SYTRAL (ODbL) integre au build: scripts/fetch_gtfs.py, 600 arrets et 14 lignes (metropole entiere, rayon 16 km).
- [x] Alertes trafic TCL temps reel (SIRI SX, data.grandlyon.com) via endpoint proxy /api/tcl-alertes: identifiants cote serveur, cache 30 s, fallback simule etiquete.
- [x] Planificateur: trajets programmes a une date, routines recurrentes (aller-retour, pause/reprise), statuts fait/annule, objectifs hebdomadaires et mensuels avec progression.
- [x] Recherche geocodee double source (BAN adresses + Photon quartiers/gares/lieux), typee et bornee a la metropole (dept 69).
- [x] Onboarding spotlight 11 etapes (auto premiere visite, relance via bouton « ? »).
- [x] Meteo live Open-Meteo injectee dans le scoring (pluie/vent).
- [x] Fallback local pour chaque flux + statut des sources affiche dans l'UI.
- [x] Tests unitaires sur la fusion GBFS et la classification meteo (transportApi.test.ts).
- [x] UI retravaillee (identite eco-urbaine, Bricolage Grotesque/Figtree, mobile first) via skill frontend-design.
- [x] Captures finales automatisees dans output/screens/ et integrees au dossier.
- [x] Dossier projet finalise: 30 pages, 15 sections alignees sur la grille, 6 figures, 7 captures, sources officielles et matrice critere vers preuve.

## 8. Durcissement post-audit (revue croisee)

- [x] Secret retire du code : jeton GTFS en variable d'environnement (GTFS_SOURCE_URL), .env.example versionne, .env ignore.
- [x] Scoring : coefficients centralises dans SCORING_WEIGHTS + test unitaire ; dossier aligne sur la formule reelle (fini le 40/30/20/10 inexistant).
- [x] RG3 (station a 400 m) et RG5 (marche maximale) reellement implementees et testees ; le curseur de marche du profil agit sur le classement.
- [x] Plus de nom de ligne non garanti affiche (fini "Metro A vers Part-Dieu") ; encadre "limites assumees du MVP" ajoute (section 7.3).
- [x] CO2 ventile par leg conserve a l'enrichissement live (velo+transport 136 g < transport seul 159 g).
- [x] Timeout reseau 8 s sur tous les appels externes (BAN, OSRM), pas seulement le GBFS.
- [x] Crash latent nearestStop (profil PMR sans arret accessible) corrige : option non proposee plutot que plantage.
- [x] Bundle decoupe : MapLibre en chunk charge a la demande (React.lazy), entree initiale ~115 kB gzip ; source maps desactivees en production.
- [x] CI GitHub Actions (.github/workflows/ci.yml) : lint + tests + build sur push/PR ; contradiction CI du dossier levee.
- [x] theme-color aligne (index.html/manifest), scripts npm e2e/screens exposes, chemin Chromium configurable, filtre Rhonexpress.
- [x] Dossier : 30 pages, diagrammes UML aux normes (include/extend, fragment alt, barres d'activation), RACI chiffre, deroule de sprint, economie chiffree, table de nomenclature, identifiant F4, justification IA et registre de preuves.
- [x] 64 tests unitaires verts (7 fichiers), lint 0 erreur, build OK sans avertissement, scenario E2E planification bloquant vert (5/5 assertions), audit axe-core 0 violation WCAG 2.1 A/AA (4 ecrans), banc de performance execute ; audits rejoues en CI, chiffres du dossier extraits automatiquement du build (output/metrics/).

## 9. Preuves concretes

- Application PWA: `package.json`, `index.html`, `public/manifest.webmanifest`, `public/sw.js`, `public/icons/icon-192.png`, `public/icons/icon-512.png`.
- F1 inscription/connexion/profil: `src/lib/auth.ts`, `src/App.tsx` (`AuthScreen`, `ProfilePanel`).
- F2 planificateur multimodal + geolocalisation temps reel: `src/lib/routePlanner.ts`, `src/App.tsx` (`MobilityMapApp`, `navigator.geolocation.watchPosition`).
- Carte mobile-first: `src/components/UrbanMap.tsx`, MapLibre GL, route selectionnee, alternatives, position utilisateur, destination, arrets GTFS et stations partagees.
- UI shadcn: `src/components/ui/button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`, `select.tsx`, `src/styles.css`.
- APIs reelles: `src/lib/externalApis.ts` pour `api-adresse.data.gouv.fr` et OSRM public; fallback local explicite pour transport GTFS/GBFS sans endpoint operateur.
- F3 integration transport: `src/lib/transportApi.ts`, `public/data/gtfs-feed.json`, `public/data/shared-mobility.json`.
- Option carbone: `src/lib/carbon.ts`, `src/App.tsx` (`CarbonDashboard`).
- Contraintes C1-C12: matrice de couverture dans `output/pdf/dossier-projet-urbanflow.pdf`, section 12.
- Dossier projet PDF: `scripts/generate_dossier.py`, rendu final `output/pdf/dossier-projet-urbanflow.pdf` (30 pages, limite 40 pages respectee).
- Rendu visuel PDF inspecte: 30 pages rendues temporairement et controlees en planche-contact et pleine page.
- Verification terminal finale: `npm run check` OK (`eslint .`, 64 tests Vitest, `tsc -b && vite build`), `npm run audit:a11y` OK (0 violation), `npm run e2e` OK, `npm run bench:perf` OK, puis `npm run generate:pdf` OK.
