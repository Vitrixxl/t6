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
- [x] GTFS statique reel TCL/SYTRAL (ODbL) integre au build: scripts/fetch_gtfs.py + scripts/fetch_tcl_lines.py, 2435 arrets et 13 lignes structurantes avec leur desserte et leur trace reel (metropole entiere, rayon 16 km).
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
- F1 inscription/connexion/profil: `src/lib/api/auth.ts`, `src/queries/session.ts`, `src/App.tsx` (`AuthScreen`, `ProfileDrawer`).
- F2 planificateur multimodal + geolocalisation temps reel: `src/lib/routePlanner.ts`, `src/App.tsx` (`MobilityMapApp`, `navigator.geolocation.watchPosition`).
- Carte mobile-first: `src/components/UrbanMap.tsx`, MapLibre GL, route selectionnee, alternatives, position utilisateur, destination, arrets GTFS et stations partagees.
- UI shadcn: `src/components/ui/button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`, `select.tsx`, `src/styles.css`.
- APIs reelles: `src/lib/externalApis.ts` pour `api-adresse.data.gouv.fr` et OSRM public; fallback local explicite pour transport GTFS/GBFS sans endpoint operateur.
- F3 integration transport: `src/lib/transportApi.ts`, `public/data/gtfs-feed.json`, `public/data/shared-mobility.json`.
- Option carbone: `src/lib/carbon.ts`, `src/App.tsx` (`CarbonDashboard`).
- Contraintes C1-C12: matrice de couverture dans `output/pdf/CASCALES_Vitrice_Titre6_B3DEV_Septembre2026.pdf`, section 12.
- Dossier projet PDF: `scripts/generate_dossier.py`, rendu final `output/pdf/CASCALES_Vitrice_Titre6_B3DEV_Septembre2026.pdf` (30 pages, limite 40 pages respectee).
- Rendu visuel PDF inspecte: 30 pages rendues temporairement et controlees en planche-contact et pleine page.
- Verification terminal finale: `bun run check` OK (`eslint .`, 64 tests Vitest, `tsc -b && vite build`), `bun run audit:a11y` OK (0 violation), `bun run e2e` OK, `bun run bench:perf` OK, puis `bun run generate:pdf` OK.

## 10. Backend (ajout post-audit)

- [x] API HTTP dediee (`server/`) : Elysia sur Bun + SQLite via `bun:sqlite`, aucune dependance native, aucune etape de compilation.
- [x] Schema relationnel migre au demarrage (users, sessions, trip_records, planned_trips, recurring_trips, saved_routes) avec cles etrangeres et suppression en cascade.
- [x] Inscription / connexion / deconnexion serveur : `POST /api/auth/register`, `/login`, `/logout`, `GET /api/auth/session`.
- [x] Mots de passe argon2id 19 Mio / t=2 / p=1 (parametres OWASP, fonction memory-hard) via Bun.password ; comparaison a temps constant.
- [x] Sessions opaques 256 bits, seule l'empreinte SHA-256 est stockee, revocation en base a la deconnexion, purge des sessions expirees.
- [x] Cookie `httpOnly` + `SameSite=Lax` + `Secure` en production : verifie en navigateur reel (`document.cookie` ne voit pas le jeton).
- [x] Validation zod de toutes les entrees (contrats `src/contracts/` partages avec les formulaires du client), limitation de debit (300 req/min globale, 10 req/min sur l'authentification), en-tetes helmet, corps de requete borne a 512 ko.
- [x] Cloisonnement des donnees : toute requete est filtree par l'utilisateur de la session (test dedie : un compte ne voit jamais les trajets d'un autre).
- [x] Enumeration de comptes bloquee : message unique et verification de mot de passe a vide sur email inconnu.
- [x] Etat du compte : rendu a la connexion, tenu dans le cache React Query, une route par collection en lecture et en remplacement (`GET`/`PUT /api/trips/*`, `/api/saved-routes`, `/api/me/profile` : chaque liste remplacee seule, en transaction, bornee par le contrat ; relue apres un refus).
- [x] Une seule origine : l'API sert le client, pas de mode sans serveur  ; une ecriture refusee par le reseau est signalee a l'utilisateur.
- [x] RGPD : export complet du compte (`GET /api/me/export`, art. 20), suppression en cascade (`DELETE /api/me`, art. 17).
- [x] Documentation OpenAPI generee a partir des schemas des routes (`/api/doc`), donc impossible a desynchroniser du code.
- [x] Tests d'integration API via `app.handle` (base :memory:) et tests client sur les operations pures (trajets, routines, carbone, profil) ; suite complete sous `bun test`.
- [x] Verification bout en bout en navigateur : inscription depuis l'interface -> ligne SQLite avec empreinte scrypt -> session restauree apres rechargement par cookie httpOnly, zero erreur de page.

## 11. Architecture de fichiers (revue de code)

- [x] API decoupee par responsabilite : `config/`, `db/`, `repositories/`, `services/`, `plugins/`, `routes/`, contrats zod dans `src/contracts/` ; 113 lignes au maximum par fichier.
- [x] Module trajets eclate : 955 lignes -> 11 fichiers (hub, quatre listes, formulaire, objectifs, briques, formats).
- [x] Moteur d'itineraires eclate : 559 lignes -> 13 fichiers, un generateur par mode dans `options/`.
- [x] Couche transport eclatee : 780 lignes -> 14 fichiers (`geocoding/`, `routing/`, `feeds/`), une source externe par fichier.
- [x] Module d'authentification : appels API, cache de session, normalisation du profil.
- [x] Carte eclatee (composant, popups avec echappement HTML, sources) et type `LayerState` dedoublonne.
- [x] Geolocalisation et calcul d'itineraires extraits en hooks testables.
- [x] Aucun fichier de plus de 450 lignes ; verification apres chaque etape par lint, typage, tests et scenario E2E 5/5.

## 12. Chaine d'outillage unifiee sous Bun

- [x] Gestionnaire de paquets : `bun install`, `bun.lock` seul lockfile versionne (package-lock.json retire).
- [x] API : `bun server/src/index.ts`, sans etape de compilation ni dependance native.
- [x] Serveur de developpement et build Vite forces sur le runtime Bun (`bun --bun vite`).
- [x] Tests client : Vitest execute sous Bun (`bun --bun vitest run`), 72 tests verts.
- [x] Tests d'API : `bun test server`, 27 tests verts.
- [x] Scripts d'outillage (E2E, audit a11y, banc de performance, metriques, captures) executes par Bun.
- [x] Verifications rejouees apres bascule : `bun run check` complet, E2E 5/5, audit axe-core 0 violation sur 4 ecrans.
- [x] Limite assumee : l'ingestion GTFS et la generation du dossier restent en Python, faute d'equivalent JavaScript.
