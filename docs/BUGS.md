# Journal des bogues

Registre des bogues rencontres pendant la production, de leur cause racine et
de leur verrouillage. Il sert deux usages : la revue de test en face-a-face
(C3.3), ou il faut pouvoir montrer les pratiques d'identification, de
correction **et de test du correctif** ; et la reprise du projet par quelqu'un
d'autre, qui doit savoir ce qui a deja mordu.

Depot : <https://github.com/Vitrixxl/t6>

## Regles suivies

- **Qualification** : environnement, etapes de reproduction, resultat attendu
  et observe, criticite (bloqueur / majeur / mineur).
- **Non-regression** : pour un bogue sur une fonction pure (scoring, carbone,
  fusion de flux), le test qui reproduit le bogue est ecrit **avant** le
  correctif. Le bogue ne peut alors pas revenir sans que la suite le signale.
- **Limite de cette regle** : elle ne couvre pas une configuration de build ni
  un rendu visuel. Les bogues concernes sont marques « verrouillage faible »
  ci-dessous plutot que presentes comme couverts.
- **Sortie** : zero bloqueur, `bun run check` vert, et les majeurs restants
  explicitement acceptes.

## Niveaux de verrouillage

| Niveau | Signification |
| --- | --- |
| **Automatise** | Un test, un audit ou le lint echoue si le bogue revient. |
| **Faible** | Revue humaine ou controle visuel seulement. Assume, pas ignore. |
| **Ouvert** | Identifie, pas encore corrige. |

---

## B1 — Le service worker servait d'anciens modules en developpement

- **Criticite** : majeur (bloquait la boucle de developpement)
- **Symptome** : des correctifs livres restaient invisibles dans le navigateur,
  et le rechargement a chaud cassait sans message d'erreur.
- **Cause racine** : le service worker de la PWA etait enregistre aussi en
  developpement. Sa strategie *cache-first* resservait les modules precedents,
  y compris ceux que Vite venait de remplacer.
- **Correctif** : enregistrement limite a la production, et desinscription
  active des service workers existants hors production, pour reparer les postes
  deja pollues.
- **Commit** : [`4cd56fe`](https://github.com/Vitrixxl/t6/commit/4cd56fe)
- **Ou le voir** : `src/main.tsx`, garde `import.meta.env.PROD` puis
  `getRegistrations().forEach(unregister)`
- **Verrouillage** : **faible** — revue de configuration. Un test de bout en
  bout comparant le comportement dev et prod serait la vraie couverture.

## B2 — Onglets d'authentification non conformes ARIA

- **Criticite** : majeur (violation d'accessibilite critique)
- **Symptome** : l'audit axe-core signalait `aria-required-children` sur
  l'ecran de connexion.
- **Cause racine** : le conteneur declarait `role="tablist"` sans qu'aucun
  enfant ne porte `role="tab"`. La structure etait invalide pour les
  technologies d'assistance, et le lint statique ne pouvait pas la detecter.
- **Correctif** : `role="tab"` et `aria-selected` ajoutes sur les deux
  bascules Connexion / Inscription.
- **Commit** : [`4cd56fe`](https://github.com/Vitrixxl/t6/commit/4cd56fe)
- **Ou le voir** : `src/components/auth/AuthScreen.tsx:102-106`
- **Verrouillage** : **automatise** — `bun run audit:a11y` echoue en cas de
  regression. Actuellement 0 violation WCAG 2.1 A/AA sur quatre ecrans.

## B3 — Erreurs de lint « process is not defined »

- **Criticite** : mineur (bruit bloquant sur la commande de verification)
- **Symptome** : `bun run lint` echouait apres l'ajout du script de captures.
- **Cause racine** : les scripts d'outillage tournent sous Node, mais ESLint
  les analysait avec l'environnement navigateur par defaut. Les globales `process`
  et `console` etaient donc inconnues.
- **Correctif** : d'abord un perimetre d'exclusion explicite pour les scripts
  d'outillage ; remplace ensuite par une declaration des globales Node sur
  `scripts/**/*.mjs`, ce qui garde ces fichiers reellement analyses au lieu de
  les sortir du perimetre.
- **Commit** : [`29b07d1`](https://github.com/Vitrixxl/t6/commit/29b07d1)
- **Ou le voir** : `eslint.config.js:29`
- **Verrouillage** : **automatise** — le lint est bloquant dans `bun run check`.

## B4 — Carte illisible apres branchement des donnees reelles

- **Criticite** : majeur (fonctionnalite F2 inexploitable visuellement)
- **Symptome** : avec les flux reels, la carte devenait un aplat de marqueurs
  superposes.
- **Cause racine** : le rayon des marqueurs etait fixe, calibre sur la
  quinzaine d'arrets simules du prototype. Il ne tenait pas face aux centaines
  d'arrets et de stations reels.
- **Correctif** : rayons interpoles par niveau de zoom, et contrastes de
  couleur renforces couche par couche.
- **Commit** : [`1a21f5d`](https://github.com/Vitrixxl/t6/commit/1a21f5d)
- **Ou le voir** : `src/components/map/UrbanMap.tsx`, expressions
  `['interpolate', ['linear'], ['zoom'], ...]` sur `circle-radius`
- **Verrouillage** : **faible** — controle visuel par capture avant/apres.
- **Reouvert** : voir B9. Le retrait des plafonds a ramene le probleme de
  densite, avec une attenuation differente.

## B5 — Jeton d'API present dans le code source

- **Criticite** : bloqueur (secret expose dans un depot)
- **Symptome** : l'URL de la source GTFS, jeton d'acces inclus, etait ecrite en
  dur dans le script d'ingestion.
- **Cause racine** : commodite de developpement jamais reprise avant la mise
  en depot.
- **Correctif** : URL deplacee dans la variable d'environnement
  `GTFS_SOURCE_URL`, `.env.example` versionne, `.env` ignore.
- **Commit** : [`fe49015`](https://github.com/Vitrixxl/t6/commit/fe49015)
- **Ou le voir** : `scripts/fetch_gtfs.py`, `.env.example`
- **Verrouillage** : **faible** — revue. Un scan de secrets en CI serait la
  vraie couverture.

## B6 — Le curseur de marche du profil n'agissait pas sur le classement

- **Criticite** : majeur (preference utilisateur sans effet, F1/F2)
- **Symptome** : modifier « marche maximale » dans le profil ne changeait pas
  l'ordre des options proposees.
- **Cause racine** : la regle de gestion RG5 etait specifiee mais jamais
  implementee dans le calcul du score. RG3 (station a moins de 400 m) etait
  dans le meme cas.
- **Correctif** : RG3 et RG5 implementees, coefficients de score extraits dans
  `SCORING_WEIGHTS`, et penalites appliquees au classement.
- **Commit** : [`dc7b94b`](https://github.com/Vitrixxl/t6/commit/dc7b94b)
- **Ou le voir** : `src/lib/planner/rules.ts`, `src/lib/planner/scoring.ts`
- **Verrouillage** : **automatise** — tests unitaires dedies a RG3, RG5 et aux
  coefficients de score.

## B7 — Plantage sur un profil PMR sans arret accessible

- **Criticite** : bloqueur (ecran blanc pour un profil utilisateur entier)
- **Symptome** : avec le profil « accessibilite PMR » actif et aucun arret
  accessible a proximite, le calcul d'itineraire plantait.
- **Cause racine** : `nearestStop` pouvait rendre `null`, cas jamais traite par
  l'appelant, qui derefencait ensuite le resultat.
- **Correctif** : le cas `null` est gere — l'option transport public n'est plus
  proposee, au lieu de faire echouer tout le calcul.
- **Commit** : [`dc7b94b`](https://github.com/Vitrixxl/t6/commit/dc7b94b)
- **Ou le voir** : `src/lib/planner/options/transit.ts`, retour anticipe
- **Verrouillage** : **automatise** — test unitaire sur le profil PMR sans
  arret accessible.

## B8 — CO2 fausse a l'enrichissement par le routage reel

- **Criticite** : majeur (chiffre faux sur la fonctionnalite au choix)
- **Symptome** : un trajet velo + metro affichait la meme intensite carbone
  qu'un trajet 100 % metro.
- **Cause racine** : l'enrichissement live recalculait le CO2 au facteur du
  mode dominant, en perdant la ventilation par segment calculee localement.
- **Correctif** : l'intensite carbone moyenne de l'option (g/km) est conservee
  et appliquee a la distance reelle.
- **Commit** : [`dc7b94b`](https://github.com/Vitrixxl/t6/commit/dc7b94b)
- **Ou le voir** : `src/lib/transport/routing/index.ts`, `estimateLiveCarbon`
- **Verrouillage** : **automatise** — test comparant velo+transport et
  transport seul.

## B9 — Des plafonds d'affichage presentes comme des mesures

- **Criticite** : majeur (l'interface annoncait un chiffre faux)
- **Symptome** : l'interface affichait « 300 trottinettes » de facon constante,
  quelle que soit l'heure.
- **Cause racine** : `MAX_DOTT_VEHICLES = 300` tronquait la liste, et le
  libelle comptait les elements restants. Le nombre affiche etait donc la
  constante elle-meme. Verification faite contre l'API Dott le 31/08/2026 :
  3396 vehicules disponibles, 300 affiches. Meme mecanique pour les incidents
  (plafond 40) et les arrets GTFS (plafond 600 a l'ingestion). Velo'v n'etait
  pas concerne : 465 stations sous un plafond de 500, jamais atteint.
- **Correctif** : plafonds retires du code. Seul le rayon metropolitain de
  16 km filtre encore, et c'est une decision de service, pas une limite
  technique.
- **Commit** : [`30d0da6`](https://github.com/Vitrixxl/t6/commit/30d0da6)
- **Ou le voir** : `src/lib/transport/feeds/area.ts`,
  `src/lib/transport/feeds/gbfs.ts`, `src/lib/transport/feeds/tcl-alerts.ts`
- **Verrouillage** : **automatise** — le test qui verifiait le plafonnement a
  ete remplace par son inverse : `mergeVelovStations` doit rendre les 560
  stations d'un jeu de 560, et n'ecarter que ce qui sort du perimetre.
- **Reste a faire** : le feed GTFS versionne contient encore 600 arrets. Le
  plafond est retire de `scripts/fetch_gtfs.py`, mais regenerer le feed demande
  la variable `GTFS_SOURCE_URL`.

---

## Ouverts

Identifies et reproduits, pas encore corriges. Documentes ici plutot que
laisses a decouvrir.

### O0 — L'ecran mobile n'avait aucun etat de repos (corrige)

- **Criticite** : majeur (l'application paraissait vide sur mobile)
- **Symptome** : avant d'avoir saisi un depart **et** une arrivee, l'ecran
  mobile se reduisait a une carte de points, une barre de recherche et une
  pastille GPS. Aucune donnee.
- **Cause racine** : le panneau mobile etait rendu sous condition
  `routeRequested ? <MobileTripPanel/> : null`. Tant que les deux champs
  n'etaient pas remplis, il n'existait pas.
- **Correctif** : le panneau est desormais toujours monte et possede un etat de
  repos (`MobileHomePanel`) : station Velo'v, trottinette et arret les plus
  proches avec distance et disponibilite reelles, meteo, alertes en cours,
  prochain trajet planifie et progression carbone.
- **Commit** : voir l'historique de `src/components/planner/MobileHomePanel.tsx`
- **Verrouillage** : **faible** — scenario E2E et audit a11y couvrent la
  non-regression du parcours, pas le contenu du panneau lui-meme.

### O1 — Deux instances MapLibre montees simultanement

- **Criticite** : majeur (performance, C5 et C10)
- **Reproduction** : `document.querySelectorAll('canvas.maplibregl-canvas').length`
  rend `2` sur toute largeur d'ecran. Une carte est visible, l'autre est montee
  en 0x0.
- **Cause racine** : la mise en page bureau (`MobilityMapApp.tsx`, `hidden lg:grid`)
  et la mise en page mobile (`lg:hidden`) rendent chacune `<UrbanMap>`. Le CSS
  en masque une, mais `display: none` ne demonte pas un composant React. Le
  probleme depasse la carte : **les deux mises en page entieres sont montees**,
  y compris la barre de statut bureau, presente en 0x0 sur telephone.
- **Consequence** : deux contextes WebGL, deux chargements de style, et chaque
  mise a jour de source executee deux fois. Sur telephone, la carte bureau est
  montee elle aussi.
- **Piste** : rendre une seule carte, conditionnellement, depuis un `matchMedia`,
  au lieu de masquer en CSS.

### O2 — Aucune validation a l'execution des flux tiers

- **Criticite** : majeur (robustesse)
- **Constat** : l'API valide chaque requete entrante avec TypeBox. Le client,
  lui, fait confiance a ce que rendent GBFS, GTFS et OSRM : les reponses sont
  typees par assertion, ce qui ne verifie rien a l'execution.
- **Consequence** : un operateur qui renomme un champ produit un plantage ou
  des donnees silencieusement fausses, pas une erreur traitee.
- **Piste** : reutiliser les schemas TypeBox cote navigateur pour les trois
  formes de flux. Risque deja declare dans le dossier, section 4.3.

### O3 — Controles de carte en anglais

- **Criticite** : mineur (finition, visible en demonstration)
- **Constat** : « Zoom in », « Zoom out », « Drag to rotate map, click to reset
  north » dans une interface entierement francaise. Ce sont aussi les noms
  accessibles annonces par un lecteur d'ecran.
- **Piste** : passer un objet `locale` au constructeur `Map`.

### O4 — Serveur de tuiles public d'OpenStreetMap

- **Criticite** : mineur en demonstration, bloquant en production
- **Constat** : les tuiles viennent de `tile.openstreetmap.org`. La politique
  d'usage de l'OSM Foundation exclut ce point d'entree pour une application en
  production, et les clients trop gourmands sont bloques.
- **Non concerne** : l'attribution est presente et correcte.
- **Piste** : fournisseur de tuiles vectorielles avec cle, la cle etant portee
  par l'API comme pour les alertes TCL.
