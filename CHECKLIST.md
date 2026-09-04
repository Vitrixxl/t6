# UrbanFlow Mobility - Checklist Projet

Source: `/home/vitrix/Downloads/2026 SEPTEMBRE T6 CDSD - SUJET 'URBAN FLOW MOBILITY'.pdf`

## 1. Cadrage et livrables

- [x] Identifier les objectifs client et besoins utilisateurs d'une métropole de 500 000 habitants.
- [x] Créer une application fonctionnelle originale pour une plateforme de mobilité urbaine intelligente.
- [x] Créer un dossier projet PDF structure, limite a 40 pages.
- [x] Fournir une preuve de vérification terminal: lint, build, tests automatises et génération PDF.

## 2. Dossier projet PDF

- [x] Expliquer le contexte, les objectifs client et les besoins spécifiques.
- [x] Proposer plusieurs solutions techniques et recommander une solution justifiée.
- [x] Définir l'approche de développement, l'environnement, les outils et les rôles de l'équipe.
- [x] Integrer une demarche d'amelioration continue.
- [x] Ajouter un diagramme UML de cas d'utilisation avec description.
- [x] Ajouter un diagramme UML de séquence avec description.
- [x] Ajouter un diagramme UML de communication avec description.
- [x] Rediger les specifications fonctionnelles d'une fonctionnalité clé.
- [x] Rediger les specifications techniques d'une fonctionnalité clé.
- [x] Decrire l'architecture technique avec évolutivité et maintenabilite.
- [x] Decrire le traitement des bogues, notamment en préproduction.

## 3. Application - Fonctionnalités obligatoires

- [x] F1 - Inscription utilisateur.
- [x] F1 - Connexion utilisateur.
- [x] F1 - Gestion de profil de mobilité personnalise.
- [x] F2 - Planificateur d'itinéraires multimodal.
- [x] F2 - Utilisation de la géolocalisation en temps réel.
- [x] F2 - Carte interactive affichant la position, la destination et les trajets disponibles.
- [x] F2 - Sélection visuelle des différents trajets alternatifs.
- [x] F2 - Prise en compte des préférences utilisateur dans le calcul d'itinéraire.
- [x] F3 - Intégration de données type GTFS pour les transports publics.
- [x] F3 - Intégration de données de vélos/trottinettes partagés.

## 4. Application - Fonctionnalité au choix

- [x] Implémenter un calculateur d'empreinte carbone avec suivi personnel.

## 5. Contraintes techniques et reglementaires

- [x] C1 - PWA: manifest, service worker et application installable.
- [x] C2 - Responsive/UX: interface utilisable mobile et desktop.
- [x] C2 - Interface mobile-first inspirée d'Urbaninator avec carte plein écran, panneaux flottants et bottom sheet mobile.
- [x] C2 - Mode shell inspire d'Urbaninator: rail gauche docke, carte centrale encadrée, barre recherche fusionnée au shell, rail détail droit.
- [x] C3 - UI basée sur shadcn/Tailwind avec composants locaux Button, Card, Badge, Input et Select.
- [x] C3 - Composants Radix/shadcn pour les contrôles principaux (dialog, popover, calendrier react-day-picker, drawer), pas de contrôles natifs bruts.
- [x] C3 - Normes et standards: TypeScript, ESLint, structure maintenable.
- [x] C4 - Sécurité OWASP: cartographie OWASP Top 10:2025, limites de l'auth locale et contrôles cibles documentés.
- [x] C5 - Eco-conception: bundle léger, cache offline, limitation des ressources.
- [x] C6 - Géolocalisation: précision affichée, consentement et fallback manuel.
- [x] C7 - Accessibilité cible WCAG 2.1 AA: navigation clavier, contrastes, labels et ARIA ; audit formel restant explicite.
- [x] C8 - RGPD: consentement géolocalisation, minimisation et suppression des données locales.
- [x] C9 - Interopérabilité: modèles de données transport compatibles GTFS/GBFS.
- [x] C10 - Performances: fonctionnement avec connectivite variable, cache et états de chargement.
- [x] C11 - Sécurité des données de déplacement sensibles: sessions locales et suppression des historiques.
- [x] C12 - Normes transport: prise en compte PMR et accessibilité des transports publics.

## 6. Vérification finale

- [x] Installer les dépendances sans erreur.
- [x] Exécuter les tests unitaires avec succès.
- [x] Exécuter le lint avec succès.
- [x] Exécuter le build de production avec succès.
- [x] Générer le dossier projet PDF.
- [x] Rendre le PDF en images et verifier la lisibilité.
- [x] Auditer la checklist: chaque case doit être cochée avec une preuve concrète.

## 7. Intégration d'APIs réelles (mise à jour finale)

- [x] Geocodage live: api-adresse.data.gouv.fr (BAN).
- [x] Routage live: OSRM routing.openstreetmap.de (profils foot/bike/driving ; trottinette sur bike, voiture uniquement comme référence invisible), matrice de choix des accès puis traces et instructions traduites.
- [x] GBFS live Vélo'v v3 (station_information + station_status, api.cyclocity.fr) fusionne dans la carte.
- [x] GBFS live Dott Lyon v2.3 (free_bike_status) pour les trottinettes free-floating.
- [x] GTFS statique réel TCL/SYTRAL (ODbL) intègre au build: scripts/fetch_gtfs.py + scripts/fetch_tcl_lines.py, 2435 arrêts et 13 lignes structurantes avec leur desserte et leur tracé réel (métropole entière, rayon 16 km).
- [x] Planificateur: trajets programmés à une date, routines récurrentes (aller-retour, pause/reprise), statuts fait/annule, objectifs d'économie CO2 hebdomadaire et mensuel indépendants avec progression.
- [x] Recherche géocodée double source (BAN adresses + Photon quartiers/gares/lieux), typée et bornée à la métropole (dept 69).
- [x] Onboarding spotlight adapte à la disposition : 11 étapes desktop, 9 étapes mobile sur les contrôles réellement présents, auto à la première visite et relançable depuis le profil.
- [x] Météo live Open-Meteo injectée dans le scoring (pluie/vent).
- [x] Fallback local pour chaque flux + statut des sources affiche dans l'UI.
- [x] Tests unitaires sur la fusion GBFS et la classification météo (`src/lib/transport/feeds.test.ts`).
- [x] UI retravaillée (identité eco-urbaine, Bricolage Grotesque/Figtree, mobile first) via skill frontend-design.
- [x] Captures finales automatisées dans output/screens/ et intégrées au dossier.
- [x] Dossier projet finalise: 30 pages, 15 sections alignées sur la grille, 6 figures, 7 captures, sources officielles et matrice critère vers preuve.

## 8. Durcissement post-audit (revue croisée)

- [x] Secret retire du code : jeton GTFS en variable d'environnement (GTFS_SOURCE_URL), .env.example versionne, .env ignore.
- [x] Scoring : coefficients centralisés dans SCORING_WEIGHTS + test unitaire ; dossier aligne sur la formule réelle (fini le 40/30/20/10 inexistant).
- [x] RG3 (station à 400 m) et RG5 (marche maximale) réellement implémentées et testées ; le curseur de marche du profil agit sur le classement.
- [x] Plus de nom de ligne non garanti affiche (fini "Métro A vers Part-Dieu") ; encadre "limites assumées du MVP" ajoute (section 7.3).
- [x] CO2 ventile par leg conserve à l'enrichissement live (vélo+transport 136 g < transport seul 159 g).
- [x] Référence voiture contrefactuelle commune : matrice OSRM driving `1 x 1`, facteur versionne a 142 gCO2e/km, applique après la mesure réelle des options ; surplus et indisponibilité affiches sans faux zéro.
- [x] Facteur transport choisi par `route_type` GTFS : tramway 3,8, métro 4,2 et funiculaire documente comme approximation métro, en gCO2e/passager-km.
- [x] Timeout réseau 8 s sur tous les appels externes (BAN, OSRM), pas seulement le GBFS.
- [x] Crash latent nearestStop (profil PMR sans arrêt accessible) corrige : option non proposée plutôt que plantage.
- [x] Bundle decoupe : MapLibre en chunk charge à la demande (React.lazy), entrée initiale ~115 kB gzip ; source maps désactivées en production.
- [x] CI GitHub Actions (.github/workflows/ci.yml) : lint + tests + build sur push/PR ; contradiction CI du dossier levée.
- [x] theme-color aligne (index.html/manifest), scripts Bun e2e/screens exposés, chemin Chromium configurable, filtre Rhonexpress.
- [x] Dossier : 30 pages, diagrammes UML aux normes (include/extend, fragment alt, barres d'activation), RACI chiffre, deroule de sprint, économie chiffrée, table de nomenclature, identifiant F4, justification IA et registre de preuves.
- [x] 170 tests verts (19 fichiers), lint 0 erreur, build OK, scénario E2E tutoriel mobile + planification bloquant vert (8/8 assertions), audit axe-core 0 violation WCAG 2.1 A/AA (4 écrans) ; chiffres du dossier extraits automatiquement du build (`output/metrics/`).

## 9. Preuves concrètes

- Application PWA: `package.json`, `index.html`, `public/manifest.webmanifest`, `public/sw.js`, `public/icons/icon-192.png`, `public/icons/icon-512.png`.
- F1 inscription/connexion/profil: `src/lib/api/auth.ts`, `src/queries/session.ts`, `src/App.tsx` (`AuthScreen`, `ProfileDrawer`).
- F2 planificateur multimodal + géolocalisation temps réel: `src/lib/planner/`, `src/components/app/MobilityMapApp.tsx`, `src/components/app/hooks/useGeolocation.ts`.
- Carte mobile-first: `src/components/map/UrbanMap.tsx`, MapLibre GL, route sélectionnée, alternatives, position utilisateur, destination, arrêts GTFS et stations partagées.
- UI shadcn: `src/components/ui/button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`, `src/styles.css`.
- APIs réelles: `src/lib/transport/` pour BAN, Photon et les flux ; OSRM uniquement derrière `/api/route-matrix` et `/api/route`, avec cache SQLite partagé, profil driving de référence et aucune géométrie inventée.
- F3 intégration transport: `src/lib/transport/feeds/`, `public/data/gtfs-feed.json`, `public/data/shared-mobility.json`.
- Option carbone: `src/lib/carbon.ts`, `src/components/planner/trips/TripGoalsCard.tsx`, `src/components/profile/ProfilePanels.tsx` (objectifs hebdomadaire et mensuel indépendants).
- Contraintes C1-C12: matrice de couverture dans `output/pdf/CASCALES_Vitrice_Titre6_B3DEV_Septembre2026.pdf`, section 12.
- Dossier projet PDF: `scripts/generate_dossier.py`, rendu final `output/pdf/CASCALES_Vitrice_Titre6_B3DEV_Septembre2026.pdf` (30 pages, limite 40 pages respectée).
- Rendu visuel PDF inspecte: 30 pages rendues temporairement et contrôlées en planche-contact et pleine page.
- Vérification terminal finale: `bun run check` OK (`eslint .`, TypeScript 7 strict, 170 tests, `Bun.build`), `bun run audit:a11y` OK (0 violation sur 4 écrans) et `bun run e2e` OK (8/8).

## 10. Backend (ajout post-audit)

- [x] API HTTP dédiée (`server/`) : Elysia sur Bun + SQLite via `bun:sqlite`, aucune dépendance native, aucune étape de compilation.
- [x] Schéma relationnel migre au démarrage (users, sessions, trip_records, planned_trips, recurring_trips, saved_routes) avec clés étrangères et suppression en cascade.
- [x] Inscription / connexion / déconnexion serveur : `POST /api/auth/register`, `/login`, `/logout`, `GET /api/auth/session`.
- [x] Mots de passe argon2id 19 Mio / t=2 / p=1 (paramètres OWASP, fonction memory-hard) via Bun.password ; comparaison a temps constant.
- [x] Sessions opaques 256 bits, seule l'empreinte SHA-256 est stockée, révocation en base à la déconnexion, purge des sessions expirées.
- [x] Cookie `httpOnly` + `SameSite=Lax` + `Secure` en production : vérifie en navigateur réel (`document.cookie` ne voit pas le jeton).
- [x] Validation zod de toutes les entrées (contrats `src/contracts/` partagés avec les formulaires du client), limitation de débit (300 req/min globale, 10 req/min sur l'authentification), en-têtes helmet, corps de requête borne a 512 ko.
- [x] Cloisonnement des données : toute requête est filtrée par l'utilisateur de la session (test dédié : un compte ne voit jamais les trajets d'un autre).
- [x] Énumération de comptes bloquée : message unique et vérification de mot de passe à vide sur email inconnu.
- [x] État du compte : rendu à la connexion, tenu dans le cache React Query, collections lues par `GET`, ressources écrites seules par `PUT/DELETE /api/.../:id` ; complétion trajet + historique atomique, aucune liste renvoyée par le client, vue concernée relue après un refus.
- [x] Tous les appels du front vers l'API UrbanFlow passent par Eden Treaty et sont inférés depuis l'arbre Elysia ; aucun type HTTP duplique.
- [x] Profil : objectifs d'économie de CO2 hebdomadaire et mensuel configurables indépendamment, validés par zod, persistés par `PUT /api/me/profile` et visibles dans le planificateur.
- [x] Points d'accès Vélo'v, trottinette et transport classes par durée OSRM sur huit candidats bornes ; test de régression sur l'obstacle piéton.
- [x] Correspondance entre deux lignes rendue comme étape à pied de 4 min, sans trace intérieur invente en l'absence de `pathways.txt`.
- [x] Une seule origine : l'API sert le client, pas de mode sans serveur  ; une écriture refusée par le réseau est signalée à l'utilisateur.
- [x] RGPD : export complet du compte (`GET /api/me/export`, art. 20), suppression en cascade (`DELETE /api/me`, art. 17).
- [x] Documentation OpenAPI générée à partir des schémas des routes (`/api/doc`), donc impossible a désynchroniser du code.
- [x] Tests d'intégration API via `app.handle` (base :memory:) et tests client sur les opérations pures (trajets, routines, carbone, profil) ; suite complète sous `bun test`.
- [x] Vérification bout en bout en navigateur : tutoriel mobile complet, connexion, calcul d'options, planification, marquage fait, persistance et déconnexion, 8/8 assertions.

## 11. Architecture de fichiers (revue de code)

- [x] API découpée par responsabilité : `config/`, `db/`, `repositories/`, `services/`, `plugins/`, `routes/`, contrats zod dans `src/contracts/` ; un fichier garde une seule raison de changer, sans seuil de lignes artificiel.
- [x] Module trajets eclate : 955 lignes -> 11 fichiers (hub, quatre listes, formulaire, objectifs, briques, formats).
- [x] Moteur d'itinéraires eclate : 559 lignes -> 13 fichiers, un générateur par mode dans `options/`.
- [x] Couche transport éclatée : 780 lignes -> 14 fichiers (`geocoding/`, `routing/`, `feeds/`), une source externe par fichier.
- [x] Module d'authentification : appels API, cache de session, normalisation du profil.
- [x] Carte éclatée : cycle de vie dans `UrbanMap`, définitions dans `layers`, données GeoJSON, popups et marqueurs isoles.
- [x] Écran principal separe : `MobilityMapApp` tient l'état et les actions ; `MobilityLayouts` porte uniquement les dispositions desktop/mobile.
- [x] Recherche, gestes de feuille mobile, géolocalisation et calcul d'itinéraires extraits en hooks nommes.
- [x] Chaque ressource React Query porte directement sa lecture et ses actions ; aucun orchestrateur générique `AccountMutation` entre le clic et Eden.
- [x] Découpage par responsabilité plutôt que par seuil arbitraire de lignes ; ESLint bloque complexité > 10 et imbrication > 3, puis typage, tests et scénario E2E valident le comportement.

## 12. Chaîne d'outillage unifiée sous Bun

- [x] Gestionnaire de paquets : `bun install`, `bun.lock` seul lockfile versionne (package-lock.json retire).
- [x] API : `bun server/src/index.ts`, sans étape de compilation ni dépendance native.
- [x] Serveur de développement et build du client exécutés par Bun (`bun scripts/dev.ts`, `Bun.build`).
- [x] TypeScript 7 conserve ; `tsc` strict contrôle types et symboles inutilisés, ESLint utilise le parseur Babel tant que `typescript-eslint` ne prend pas TS7 en charge.
- [x] Tests client / métier : 122 tests verts dans `src/`.
- [x] Tests d'API : `bun test server`, 48 tests verts.
- [x] Scripts d'outillage (E2E, audit a11y, banc de performance, metriques, captures) exécutés par Bun.
- [x] Vérifications rejouées après bascule : `bun run check` complet (170 tests), E2E 8/8, audit axe-core 0 violation sur 4 écrans.
- [x] Limite assumée : l'ingestion GTFS et la génération du dossier restent en Python, faute d'équivalent JavaScript.
