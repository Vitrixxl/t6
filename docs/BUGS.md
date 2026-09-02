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

## B10 — Couche `symbol` muette faute de source `glyphs`

- **Criticite** : majeur (fonctionnalite invisible, sans erreur)
- **Symptome** : les libelles de mode poses sur les segments de transport ne
  s'affichaient pas. Aucune erreur en console, la couche existait bien et son
  filtre etait correct : `queryRenderedFeatures` rendait simplement zero entite.
- **Cause racine** : une couche `symbol` avec un `text-field` exige une source
  `glyphs` dans le style de la carte. Le fond OpenStreetMap utilise ici est un
  style raster minimal, sans `glyphs`. MapLibre n'echoue pas, il n'affiche rien.
- **Correctif** : libelles poses en marqueurs HTML plutot qu'en couche symbole.
  Aucune dependance a un serveur de polices tiers, et la typographie de
  l'application est reprise telle quelle.
- **Ou le voir** : `src/components/map/legLabels.ts`
- **Verrouillage** : **faible** — verification en navigateur
  (`queryRenderedFeatures` sur les couches de segments, puis comptage des
  marqueurs par instance de carte). Un test de rendu serait la vraie
  couverture.

## B11 — Le trajet selectionne etait dessine deux fois

- **Criticite** : majeur (carte illisible, trace incoherent)
- **Symptome** : deux traces bleus distincts pour un seul itineraire, formant
  une boucle qui ne correspondait a aucun trajet reel.
- **Cause racine** : introduit avec le rendu par mode. La couche `routes`
  dessinait toujours l'itineraire selectionne en entier — un seul appel OSRM
  origine vers destination, avec le profil du dernier mode — pendant que les
  nouvelles couches `legs` dessinaient le meme trajet decoupe par segment,
  chacun route avec son propre profil. Les deux geometries different, d'ou la
  superposition.
- **Correctif** : la couche `routes` ne porte plus que les alternatives ; le
  trajet selectionne n'est rendu que par ses segments.
- **Ou le voir** : `src/components/map/UrbanMap.tsx`, filtre
  `routes.filter((route) => route.id !== selectedRoute?.id)`
- **Verrouillage** : **faible** — verification en navigateur : les
  identifiants rendus par la couche des alternatives ne contiennent plus celui
  du trajet selectionne.

## B12 — Ligne de metro inventee et tracee sur la voirie

- **Criticite** : bloqueur (l'itineraire affiche ne correspondait a aucun
  trajet possible, C6/C10)
- **Symptome** : des qu'un itineraire en transport public etait calcule, un
  trait bleu partait a l'oppose de la destination, et l'etiquette posee dessus
  annoncait « Metro » pour un trajet qui n'empruntait aucun metro.
- **Cause racine** : trois defauts qui se cumulaient, tous nes de la meme
  lacune — le feed ne disait pas quelle ligne dessert quel arret.
  1. L'arret de montee etait le plus proche du depart, tous arrets confondus.
     Sur 600 arrets, la quasi-totalite sont des arrets de bus : le voyageur
     montait donc presque toujours a un arret qu'aucune ligne structurante ne
     dessert.
  2. La ligne affichee etait celle au passage le plus frequent du reseau
     entier (`trips` trie par `headway_minutes`), sans aucun lien avec les deux
     arrets du segment. « Metro » etait donc un libelle tire au hasard.
  3. Le segment etait ensuite envoye a OSRM comme les autres. OSRM ne route pas
     le rail : il repondait avec un itineraire *routier* entre les deux arrets,
     quais et sens uniques compris. D'ou le detour.
- **Correctif** : integration de la desserte reelle. Un nouveau script
  d'ingestion lit le portail open data de la Metropole (licence ODbL, sans
  jeton) et ajoute au feed ce que notre extraction GTFS ne donnait pas : les
  lignes desservant chaque arret, et le trace reel de chaque ligne. Le moteur
  ne retient plus que les stations effectivement desservies, ne propose un
  trajet que si une ligne relie la montee a la descente — directement ou par
  une correspondance a une station commune —, nomme la ligne exactement
  (« Metro D ») et la dessine sur son trace, a sa couleur officielle. Les
  segments de transport public ne passent plus par OSRM.
- **Ou le voir** : `scripts/fetch_tcl_lines.py`, `src/lib/planner/transit.ts`,
  `src/lib/planner/shape.ts`, `src/lib/transport/routing/legs.ts`
- **Verrouillage** : **automatise** — `src/lib/planner/transit.test.ts`. Le
  premier cas place un arret de bus a 10 m du depart et une station a 2 km :
  il echoue si le moteur recommence a faire monter le voyageur au plus proche.

## B13 — L'instance publique OSRM coupe le service sans prevenir

- **Criticite** : majeur (plus aucun trace routier affiche)
- **Symptome** : apres quelques recherches successives, les appels a
  `routing.openstreetmap.de` echouent en `Failed to fetch` cote navigateur.
  L'URL collee dans un onglet ne repond pas davantage.
- **Cause racine** : `routing.openstreetmap.de` est une instance de
  demonstration communautaire, sans engagement de service et limitee par
  adresse IP. Une session de test un peu active suffit a la declencher. Le
  quota etant partage par tous les utilisateurs derriere une meme sortie
  reseau, il n'existe aucun moyen de le respecter depuis le navigateur.
  S'ajoutait un defaut d'architecture : chaque navigateur appelait l'instance
  directement, donc rien n'etait mutualise ni mis en cache.
- **Correctif** : le calcul passe par `GET /api/route`. Un cache SQLite sert le
  meme trajet a tous les clients sans le recalculer, et sert une entree perimee
  plutot qu'une carte vide quand la source ne repond plus. Une indisponibilite
  reelle devient un 503 explicite, que le client traduit en message. Le
  protocole OSRM part entierement cote serveur : le client consomme un contrat
  fini. L'URL du service devient `OSRM_BASE_URL`, ce qui permet de basculer sur
  une instance auto-hebergee (`infra/osrm-compose.yml`) sans toucher au code.
- **Ou le voir** : `server/src/services/routing/`, `server/src/routes/routing.ts`
- **Verrouillage** : **automatise** — `server/src/__tests__/routing.test.ts`.
  Le calculateur est remplace par un `fetch` sous controle : la suite verifie
  que la source n'est sollicitee qu'une fois pour un meme trajet, qu'un trace
  connu est servi quand elle tombe, et qu'une absence totale de trace donne un
  503 et non une reponse vide.
- **Reste ouvert** : tant que `OSRM_BASE_URL` n'est pas renseigne, la source par
  defaut demeure l'instance publique. Le cache repousse la limite, il ne la
  supprime pas.

## B14 — Un trace invente partait a l'oppose de la destination

- **Criticite** : bloqueur (l'itineraire dessine ne correspondait a aucun
  chemin possible, C6)
- **Symptome** : sur une recherche de 400 m entre le 3e et le 7e, deux traits
  violets partaient vers la Croix-Rousse, a plusieurs kilometres au nord-ouest,
  pendant que l'entete annonçait « 0,4 km, 1 min ». Les chiffres etaient justes,
  le dessin non.
- **Cause racine** : chaque generateur d'option inserait un point intermediaire
  decale pour « arrondir » le trace. Le covoiturage utilisait le pire ecart,
  0,018 degre, soit un sommet a 2 km au nord et 1,4 km a l'ouest du milieu du
  trajet — d'ou le triangle, dont on voyait les deux cotes. Le defaut existait
  dans les cinq generateurs, de 0,004 a 0,018 degre, et restait invisible tant
  que le routage reel remplaçait la geometrie. Il n'est apparu que le jour ou
  le service tiers a cesse de repondre (B13) : un repli jamais exerce en
  conditions normales.
- **Correctif** : un segment n'a plus de geometrie tant qu'une source reelle ne
  lui en donne pas une — le trace publie d'une ligne, ou la reponse du routage.
  Sans geometrie, la carte n'affiche rien pour ce segment et l'interface
  distingue deux etats que l'utilisateur ne doit pas confondre : calcul en
  cours, ou service indisponible. La fonction qui fabriquait ces points
  intermediaires est supprimee, pas seulement contournee.
- **Ou le voir** : `src/lib/planner/options/*.ts`,
  `src/lib/transport/routing/legs.ts`, `src/components/map/UrbanMap.tsx`
- **Verrouillage** : **automatise** — `planner.test.ts`, « ne fait sortir aucun
  segment du cadre de ses extremites ». Verifie rouge puis vert : reintroduire
  le sommet decale fait echouer ce seul test, le retirer le fait passer. Les
  segments de transport public sont exclus de l'invariant, leur trace publie
  pouvant legitimement sortir du cadre de ses deux stations quand la ligne
  courbe.
- **Consequence de conception** : la regle « jamais de geometrie approchee » est
  inscrite dans AGENTS.md. Un trace faux se lit comme un itineraire reel et
  envoie l'utilisateur ailleurs ; un trace absent se voit.

## B15 — Une validation plus stricte que la source coupait le routage

- **Criticite** : bloqueur (aucun trace affiche sur une partie des itineraires)
- **Symptome** : « Service de routage indisponible » sur des trajets ordinaires,
  alors que le calculateur repondait normalement sur d'autres. L'API renvoyait
  `Expected string to match '^-?\d{1,3}(\.\d{1,7})?,...'`.
- **Cause racine** : le schema de la route `/api/route` bornait les coordonnees
  a sept decimales. Le flux GBFS Velo'v publie **52 de ses 465 stations** avec
  treize decimales (`4.8687553636982`). Tout itineraire dont un segment partait
  ou arrivait a l'une d'elles etait rejete en 422, que le client traduisait par
  une indisponibilite du service. La contrainte n'etait pas fausse par exces de
  prudence : elle decretait une precision que la source ne respecte pas.
- **Correctif** : la validation borne desormais ce qui est reellement dangereux
  — la longueur totale de la chaine — et non le nombre de decimales. Le client
  arrondit par ailleurs a six decimales avant l'appel, soit une dizaine de
  centimetres : au-dela d'une precision inutile, cela rapproche la requete de la
  cle de cache du serveur, donc augmente le taux de reutilisation.
- **Ou le voir** : `server/src/models/routing.ts`,
  `src/lib/transport/routing/osrm.ts`
- **Verrouillage** : **automatise** — `server/src/__tests__/routing.test.ts`,
  « accepte la precision reelle des sources tierces », avec les coordonnees
  reelles d'une station Velo'v a treize decimales. Verifie rouge puis vert :
  reintroduire la borne fait echouer ce seul test.
- **Lecon** : une validation d'entree se derive des donnees observees, pas d'une
  idee de ce qu'elles devraient etre. Le meme defaut guette les autres schemas
  ecrits sans confronter le flux reel (cf. O2).

### O5 — Cibles tactiles calculees en rem sous une racine a 14px

- **Criticite** : mineur (accessibilite tactile), **corrige au passage**
- **Constat** : la racine du document est a `font-size: 14px`. Toute taille
  exprimee en rem vaut donc 12,5 % de moins qu'attendu : `min-h-12` rendait
  42 px au lieu de 48, et le `min-height: 2.75rem` du popover d'appui long
  tombait a 38,5 px au lieu de 44.
- **Pourquoi l'audit ne l'a pas vu** : axe-core ne verifie pas la taille des
  cibles. Le critere 2.5.5 (44 px) est de niveau AAA, hors du perimetre AA
  audite ; la mesure a ete faite a la main dans le navigateur.
- **Correctif** : cibles tactiles exprimees en pixels dans la barre d'actions
  mobile, le composeur de modes et le popover d'appui long.
- **A surveiller** : toute nouvelle cible tactile dimensionnee en rem heritera
  du meme decalage.

### O6 — Le scenario E2E depend d'une API tierce au demarrage

- **Criticite** : mineur (test intermittent)
- **Symptome** : `bun run e2e` a echoue sur `SyntaxError: Failed to parse JSON`,
  puis a repasse sans modification du code.
- **Cause racine** : le script resout sa destination via l'API Adresse avant
  d'ouvrir le navigateur, sans reessai ni repli. Une reponse non-JSON de la BAN
  fait echouer un test qui ne teste pourtant pas la BAN.
- **Consequence** : le test bloquant de la chaine de verification est
  intermittent pour une raison exterieure au projet.
- **Piste** : coordonnees de destination figees dans le script, ou reessai avec
  repli. Le geocodage a deja ses propres tests unitaires.

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
