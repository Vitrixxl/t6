# AGENTS.md

Consignes pour tout agent travaillant sur ce dépôt. UrbanFlow Mobility est le
projet professionnel du Titre 6 CDSD (RNCP 36146, session septembre 2026) : une
plateforme de mobilité urbaine multimodale. Le code sera **ouvert et discuté en
revue face-à-face** devant un jury, ce qui oriente la plupart des règles
ci-dessous.

## Exigence de qualité

Le but est un dépôt propre, qu'un développeur senior peut lire sans deviner
qu'un agent y a travaillé. Pas un prototype qui marche par accident, pas du
code produit sans comprendre ce qu'il fait.

- Chaque chose a sa place, et une seule : une règle métier vit dans
  `services/`, une requête dans `repositories/`, un contrat dans
  `src/contracts/`, une ressource servie par l'API dans `src/queries/`, un
  état d'écran dans `src/state/`. Un morceau de code qui ne sait pas dans
  quel dossier aller est mal découpé.
- Une API se conçoit par ressource : des routes qui disent ce qu'elles
  remplacent, des verbes qui ont leur sens (PUT idempotent), des réponses
  typées. Un point d'entrée fourre-tout qui écrase tout est un défaut de
  conception, pas une simplification.
- TypeScript strict, sans `any`, sans cast pour faire taire le compilateur,
  sans `eslint-disable` de confort. Un type qui refuse a souvent raison.
- Pas de code mort, pas de commentaire périmé, pas de vocabulaire hérité
  d'une version précédente. Quand la chose change, son nom change.
- ESLint bloque une complexité cyclomatique supérieure à 10 et plus de trois
  niveaux d'imbrication. L'objectif n'est pas de déplacer les branches dans un
  relais générique : extraire une responsabilité nommée et garder le parcours
  appelant linéaire.
- Un changement de conception se propage partout où il est décrit : code,
  tests, README, CHECKLIST, OpenAPI, ce fichier, et les supports de revue
  maintenus (section ci-dessous).
- Pour faciliter l’apprentissage, préférer les appels directs aux relais qui
  ne font que transmettre des arguments. Transformer une ressource seule sur
  un objet, sans collection temporaire. Regrouper les variantes qui partagent
  le même parcours ; ne pas créer de framework générique pour quelques actions.
  Ne pas transmettre une fonction système comme `fetch` à travers plusieurs
  couches uniquement pour les tests ; simuler le réseau dans les tests.
- Avant de proposer, se demander comment un relecteur exigeant verrait le
  code. Si la réponse est « bricolé », ne pas le proposer.

## Dossier PDF — artefact gelé

**Ne jamais modifier `scripts/generate_dossier.py`, ne jamais régénérer ni
contrôler `output/pdf/`.** Le dossier PDF est un livrable historique gelé qui
ne sera plus mis à jour. Un changement fonctionnel futur ne s'y reporte pas,
même si son contenu devient antérieur au code courant.

## Supports de revue — à tenir à jour

Le dépôt est défendu à l'oral à partir de fichiers qui décrivent
l'application. Ils ne sont pas versionnés (`output/` est ignoré, sauf le diaporama
`output/presentation/`) mais ils sont critiques : une phrase qui contredit le code se voit en revue, et c'est le
candidat qui la porte.

- `output/soutenance/01-deroule.html` : le déroulé d'oral, ce qu'il faut dire
  et dans quel ordre.
- `output/soutenance/02-bogues.html` : l'échantillon de bogues présenté en
  revue de test.
- `output/soutenance/03-ecarts.html` : les écarts assumés entre le sujet et
  le livrable.
- `output/revue-code.html` : la roadmap de lecture du dépôt, dans l'ordre des
  appels, avec les fichiers et symboles à ouvrir dans l'éditeur.

**Toute modification fonctionnelle se reporte dans ces quatre fichiers dans
le même travail**, pas dans un second temps : nombre d'options du moteur, modes et
combinaisons proposés, règles de gestion, nombre de tests par suite,
comportement en cas de panne d'une API. Pour la roadmap, vérifier les chemins,
les symboles et l'ordre des appels. Avant de rendre la main, relire chacun
d'eux en se demandant s'il décrit encore l'application telle qu'elle est.

## Journal des bogues — obligatoire

**Tout bogue corrigé donne lieu à une entrée dans le [journal complet](docs/BUGS-ARCHIVE.md).**

[`docs/BUGS.md`](docs/BUGS.md) reste limité aux trois exemples retenus pour la
revue C3.3 : B16, B17 et B20, avec leurs PR. Les autres correctifs et la section
« Ouverts » sont conservés dans `docs/BUGS-ARCHIVE.md`.

C'est la contrainte la plus importante de ce dépôt. La compétence C3.3 de la
grille est évaluée lors d'une revue de test portant sur « un échantillon de
bogues traités », où il faut expliciter trois pratiques : identification,
correction, **et test du correctif**. Un correctif non consigné est un
correctif indéfendable.

Chaque entrée porte :

- le symptôme observé, pas la conclusion ;
- la cause racine, distincte du symptôme ;
- le correctif et le **lien de commit** ;
- le fichier où le montrer ;
- le **niveau de verrouillage** : automatisé, faible, ou ouvert.

Un bogue identifié mais non corrigé va dans la section « Ouverts ». Ne rien
cacher : un bogue documenté et assumé vaut mieux qu'un bogue découvert par
l'évaluateur.

Ne jamais qualifier un correctif d'« automatisé » si aucun test, audit ou lint
n'échoue en cas de régression. Une configuration de build ou un rendu visuel se
verrouille faiblement, et cela se dit.

## Chaîne d'outillage

Les corrections d'accents concernent les textes destinés à être lus, jamais
les identifiants techniques : commandes, noms de scripts, chemins, clés JSON,
variables d'environnement et paramètres HTTP gardent leur orthographe exacte.
Un libellé affiché peut dire « démo » ; la commande reste `bun run seed:demo`.

Toute la chaîne tourne sous **Bun**, sans exception : exécution, regroupement,
tests, serveur. Pas de `npm`, pas de `node`, pas de bundler tiers. Un outil de
plus doit se justifier par un besoin que Bun ne couvre pas.

Le dépôt reste sur **TypeScript 7**. Tant que `typescript-eslint` ne le prend
pas en charge, ESLint utilise le parseur Babel pour la syntaxe ; `tsc` strict
reste l'autorité pour les types et les symboles inutilisés.

Le format de référence des fichiers JavaScript et TypeScript est celui du LSP
TypeScript 7 appelé par Neovim à la sauvegarde : espaces, indentation de quatre
colonnes, sans Prettier ni Biome. `.editorconfig` porte ces options pour éviter
qu'un autre éditeur ne reformate le dépôt avec deux espaces.

Le serveur porte **l'API et le client** : une seule origine, donc un cookie de
session de première partie et aucun en-tête CORS. Il n'y a pas de serveur de
développement séparé.

```bash
bun install          # bun.lock est le seul lockfile
bun run dev          # serveur + reconstruction du client, un seul Ctrl+C
bun run build        # construit le client dans dist/
bun run start        # sert le build de production
bun run check        # lint + typage + tests + build
bun run ci           # recette complète identique à GitHub, moteur MOTIS isolé
bun run test         # tests du client et de l'API (src/ et server/)
bun run e2e          # scénario de planification (Playwright)
bun run audit:a11y   # axe-core sur quatre écrans
```

L'ingestion GTFS reste en Python : pas d'équivalent JavaScript, et c'est
assumé. La génération du dossier PDF est gelée par la règle ci-dessus.

## Architecture

Le calcul d'itinéraires est délégué à MOTIS, appelé directement depuis l'API
(`MOTIS_URL`, par défaut le service Compose `motis:8080`, aucun port publié).
MOTIS calcule sur un graphe unique — voirie OSM, flux GBFS, horaires GTFS optionnels — et
rend des trajets non dominés ; le serveur retient la première arrivée parmi les trajets autorisés, traduit ce seul
trajet (`server/src/services/motis/`) et y applique la référence voiture mesurée
par `one-to-many`. Un seul appel plan autorise tous les moyens demandés. Ce moteur local est la seule source de routage :
aucun défaut public, aucune bascule externe. En cas de panne, l’API répond 503.
La voiture reste une référence, jamais une option.

Un fichier, une raison de changer. Ce n'est pas un seuil de lignes : un fichier
long mais cohésif reste préférable à trois fichiers qui se renvoient la balle.

**API** (`server/src/`) : `config/` `db/` `repositories/` `services/`
`plugins/` `routes/`. Les routes ne portent aucune règle métier, seule la
couche dépôt interroge la base (Drizzle sur `bun:sqlite`, jamais `sql.raw` sur
une entrée), et les contrats zod de `src/contracts/` valident la requête,
typent le gestionnaire et génèrent l'OpenAPI depuis une source unique. Une
collection se lit par GET ; chaque ressource s'écrit ou se retire par son URL.
Aucun dépôt ne remplace une collection complète. Les services transactionnels
construisent directement leurs seuls dépôts utiles avec la transaction ;
`createRepositories` assemble ceux du contexte HTTP.

Le schéma vit dans `server/src/db/schema.ts`. Toute modification passe par
`bun run db:generate`, et la migration produite dans `server/drizzle/` se
committe avec le schéma : elle est appliquée au démarrage, y compris sur la
base `:memory:` des tests.

**Client** (`src/`) : `lib/planner/` (filtres de recherche, facteurs carbone, outils géographiques),
`lib/transport/` (`geocoding/`, `feeds/`, cellules cartographiques), `lib/api/` (client HTTP,
authentification, une commande par ressource du compte), `queries/` (les ressources
servies par l'API dans le cache React Query : une ressource par fichier, sa
requête et ses actions), `state/` (l'état d'écran partagé entre modules, en
atomes jotai), `components/map/` (cycle de vie et couches séparés),
`components/planner/` (état de recherche et rendu séparés),
`components/app/` (orchestrateur, dispositions et hooks),
`components/tutorial/` (parcours distincts desktop et mobile, cibles posées sur
les contrôles réels). Tous les appels du client vers l'API UrbanFlow passent
par Eden Treaty et sont typés depuis l'arbre Elysia ; aucun appel n'envoie une
collection complète. Les appels aux services tiers restent dans
`lib/transport/`. Les composants appellent les hooks dont ils ont
besoin ; on ne fait pas transiter l'état par des props. Un formulaire valide
avec le contrat que l'API applique (react-hook-form + zod) : aucune borne
n'est recopiée dans un composant.

Le contrat de données est importé **par le client et par l'API** :
`src/contracts/` porte un schéma zod par objet échangé ou saisi, et le type
qui en dérive ; `src/types.ts` réexporte ces types et déclare ceux qui ne se
valident pas (flux transport, options d'itinéraire). Un changement casse la
compilation des deux côtés : c'est voulu, ne pas le contourner en dupliquant
les types ni les bornes.

## Règles de fond

**Une recherche propose un seul trajet : celui qui arrive le premier.** La durée
compte l’attente depuis l’heure demandée, même avant le départ effectif. Aucun
score, famille ou mécanisme de présélection. L’accueil demande les moyens
utilisables (Vélo’v, Dott, transport public) et le besoin PMR avant la première
recherche ; `onboardedAt` est persisté après validation, et un refus permet de
réessayer. Les anciens profils sont migrés sans perdre leurs objectifs.
Les filtres temporaires partent de `availableModes`. PMR utilise le profil fauteuil,
exclut les engins partagés et exige l’accessibilité publiée des segments publics.
Les durées sont formatées par `src/lib/duration.ts` : `63 min` se lit `1h03`.
Le panneau mobile suit son contenu, limité à 50 % de la carte (45 % en paysage
bas). Les détails sont repliés à l’ouverture ; le contenu long défile et
l’en-tête avec la fermeture reste accessible. Aucun contrôle de taille.
Le cadrage de carte utilise les dimensions du canvas : les marges doivent
laisser une zone de dessin positive, même en paysage ou après redimensionnement.

**Les disponibilités Vélo’v et Dott exigent les flux en direct.** En cas
d’échec du groupe GBFS, `sharedMobility` vaut `null` : afficher l’indisponibilité,
sans fichier de secours ni compteur à zéro présenté comme une mesure. La carte
et le moteur ne proposent alors aucun véhicule partagé. Vérifier cette panne avec `bun run e2e:offline`.

**Ne jamais afficher un plafond comme une mesure.** Ce fut un vrai bogue
(B9) : l'interface annonçait « 300 trottinettes » parce que c'était la
constante de troncature. Si une liste est bornée pour le rendu, le nombre
annoncé reste le nombre réel.

**Le serveur est la seule source de vérité.** Il n'y a ni mode sans serveur
ni cache local persistant : c'est l'API qui sert le client, l'état du compte
est reçu à la connexion et amorce le cache de requêtes (React Query,
`src/queries/`). Chaque commande transporte une ressource, jamais la collection
complète ; les envois sont sérialisés. La comptabilisation automatique d’un ponctuel passé non annulé et la création
de son historique forment une seule transaction serveur, datée au départ prévu. Une préférence ne
réécrit aucun trajet. Une écriture refusée se dit à l'utilisateur, elle ne se
masque pas : seule la vue concernée est relue depuis son GET, l'écran revient à
ce que le serveur tient, et l'action est à rejouer.

**La perte de connexion se dit sur tous les écrans.** Le bandeau global suit
le signal `online`/`offline` du navigateur et rappelle qu’Internet est nécessaire
aux recherches et aux modifications. Le retour réseau le retire ; il ne garantit
pas que l’API répond. Les données de transport de secours et les erreurs serveur
ne doivent pas être présentées comme une coupure Internet. Vérifier les transitions
et le rechargement hors ligne avec `bun run e2e:offline` sur le build de production.

**Les récurrences ne se cochent pas.** Le hub sépare Une fois, Récurrents,
Historique et Enregistrés. Une récurrence compte ses passages échus dans son
fuseau enregistré, sur ses périodes d’activité. L’historique permet d’annuler
l’aller, le retour ou les deux d’une journée passée : seules les exceptions
`(date, sens)` sont persistées dans `cancelledPassages`, jamais une collection
de trajets matérialisés. Une annulation exclut le passage de tous les agrégats
(distance, émissions et économies CO₂e, objectifs) et reste visible. Annuler
un ponctuel, même fait, conserve sa trace et retire son historique carbone
dans une seule transaction. Vérifier ce parcours avec `bun run e2e:trips`.

**Recette et évolution.** `bun run seed:test` réinitialise seulement le compte
réservé `test@urbanflow.local`, avec des données fictives datées relativement
au jour d’exécution. Docker le lance avant le serveur à chaque démarrage, y compris après un redémarrage. Les autres comptes restent intacts. Le suivi propose
huit semaines civiles (fuseau appareil), dont la dernière incomplète, à partir
des enregistrements carbone conservés et des passages récurrents échus. La limite
de 50 ponctuels est annoncée ; le maximum affiché reste celui du profil actuel.
Une annulation se confirme. Chaque sens récurrent annulé peut être rétabli par
suppression de son exception ; les autres dates et sens restent intacts.

**Jamais de géométrie approchée.** Un tracé faux se lit comme un itinéraire
réel et envoie l'utilisateur ailleurs ; un tracé absent se voit. Tant qu'une
source réelle n'a pas répondu, un segment n'a pas de tracé, la carte n'affiche
rien pour lui et l'interface dit lequel des deux états s'applique — calcul en
cours, ou service indisponible. Ce fut un vrai bogue (B14) : des points
intermédiaires décorés, invisibles tant que le routage réel les remplaçait,
sont apparus le jour où le service tiers a cessé de répondre.

**Nommer les limites plutôt que les masquer.** MOTIS calcule sur l'archive GTFS
chargée : sans archive récente, aucun trajet en transport n'existe aux dates
courantes. Sans `shapes.txt`, MOTIS relie les arrêts par des droites : seuls les
tracés SYTRAL vérifiés les remplacent ; sinon le segment reste sans géométrie. Ces limites sont écrites dans le code et dans les
supports de revue maintenus ; ne pas produire d'affichage qui les contredit.

Les horaires théoriques viennent de l’archive GTFS officielle chargée dans MOTIS (`infra/motis-prepare.sh`).
L'horaire de recette de `scripts/fixtures/` est dérivé du réseau livré et ne sert
qu'à `bun run ci` : ne jamais le présenter ni le charger comme horaire réel.

En revanche le nom de ligne **est** affiché depuis l'intégration de la desserte
publiée : une ligne n'est proposée que si elle dessert réellement les deux
stations du segment.

Toute suppression de trajet ponctuel, récurrent ou enregistré et tout effacement
de l’historique carbone passent par une confirmation explicite. Annuler, fermer
ou presser Échap ne déclenche aucune écriture. Utiliser le dialogue existant.

Le maximum carbone hebdomadaire porte sur les émissions des trajets suivis,
jamais sur les économies comparées à la voiture. Afficher le reste ou le
dépassement réel ; seul le remplissage graphique se borne à 100 %. Ce maximum
ne filtre pas les itinéraires et ne change pas le choix de la première arrivée. Tout repère national
a une source, un millésime et un périmètre explicites.

Les objectifs d'économie de CO2 hebdomadaire et mensuel sont deux valeurs de
profil indépendantes. Le mensuel ne se dérive pas du premier : chaque période
est comparée à son propre objectif persisté par l'API.

**La voiture est une référence, jamais une option.** Elle n'entre pas dans
`MobilityMode`, les préférences ni la liste des itinéraires : seul
le client MOTIS connaît `CAR`. Un appel `one-to-many` en voiture mesure sa
distance entre les extrémités de la recherche, une seule fois et en parallèle
du reste. Cette référence est appliquée au trajet retenu après ses mesures réelles. Le facteur est versionné dans `src/lib/planner/emissions.ts` ;
une économie négative reste négative, et une référence indisponible reste
`null` jusque dans les contrats et la base. Aucun zéro de repli n'est inventé.

Les facteurs de transport public suivent le `route_type` GTFS. Tramway et
métro portent leurs facteurs documentés ; le funiculaire reprend explicitement
le facteur métro tant qu'aucune donnée spécifique n'est disponible. Toute
valeur carbone affichée utilise l'unité `gCO2e` (rendue `gCO₂e` dans l'UI).

**Commentaires : le pourquoi, pas le quoi.** Ils sont en français, avec les
accents et les caractères typographiques appropriés, alignés sur le style
existant. Un commentaire qui paraphrase la ligne
suivante est du bruit ; un commentaire qui explique un arbitrage a de la
valeur en revue.

## Vérification

Une modification observable dans le navigateur se vérifie **dans le
navigateur**, pas au compilateur. `bun run check` ne prouve pas qu'une carte
s'affiche ni qu'un bouton fait ce qu'il annonce.

Le scénario `bun run e2e` couvre le parcours critique : connexion, GPS, calcul
du trajet le plus rapide, planification, comptabilisation automatique après la date prévue. Le relancer après toute
modification qui touche ce chemin.

## Git

Messages en français, avec les accents. Le corps explique le **problème résolu**
avant la solution — ces messages sont lus en revue et servent de trace de
raisonnement. Ne jamais committer `.env`, la base SQLite, ni le dossier
`output/`.

**Ponctuels automatiques.** Aucun bouton ni endpoint de réalisation manuelle.
`completeDueTrips` synchronise le compte lors des lectures : seuls les ponctuels
passés non annulés comptent, et les ponctuels passés depuis plus de
`PAST_TRIP_RETENTION_MONTHS` sont effacés dans la même transaction (durée
annoncée dans `LegalNotice.tsx` et `docs/REGISTRE-TRAITEMENTS.md` : les trois
doivent dire la même chose). Les ressources sont relues toutes les 30 secondes
côté client. Ne pas recréer un historique volontairement effacé. Les pauses des
récurrences restent des intervalles entre leurs périodes d’activité en JSON,
sans table de pauses ni nettoyage des intervalles sans passage.

Un ponctuel annulé peut être rétabli depuis l’historique avec « Rétablir » :
`DELETE /api/trips/planned/:id/cancellation` le remet à venir si sa date est future,
ou fait avec son bilan daté au départ prévu si elle est passée. La commande est idempotente.

**Bus TCL.** Les bus réguliers vérifiés sont intégrés par `scripts/fetch_tcl_bus.py`.
Conserver les quais physiques et les tracés par sens ; `stopSequence` interdit le
contresens. Pas de transfert inventé entre quais distincts. Les anciens calculs par vitesse moyenne et intervalle constant sont retirés. Sans GTFS courant, les bus restent consultables sur la carte et ne sont pas proposés comme trajets. La référence
carbone bus thermique ADEME (122 gCO₂e/passager-km) reste une approximation explicite
lorsque la motorisation est inconnue. PMR exige le quai et la ligne accessibles.

**Export du compte.** « Profil et préférences → Exporter mes données » télécharge
`urbanflow-export.json` depuis `GET /api/me/export` via Eden, en un appel authentifié.
Le fichier contient les données actuelles du compte et les lieux des trajets,
sans mot de passe ni jeton de session. Un échec reste visible dans le profil
et permet de réessayer. Vérifier avec `bun scripts/e2e-account-export.mjs`.

**Types publics et documentation.** Bus/Métro/Tramway/Funiculaire apparaît dès
que les filtres autorisent transit, même sans résultat. Les types sélectionnés
sont transmis à MOTIS. Revenir au profil réinitialise les filtres temporaires.
`/api/doc` et `/api/doc/` ont une
CSP propre à Scalar ; `/api/doc/json` conserve la politique JSON stricte.

**Avant chaque push.** Exécuter `bun run ci` sur le code qui sera envoyé et
attendre sa réussite. `bun run check` seul ne suffit pas : la recette prépare
un moteur MOTIS dédié sur les fixtures versionnées, une base vide, puis lance l’audit et les scénarios
navigateur. Docker et Chromium sont nécessaires ; `CI_API_PORT` change le port
local (4101 par défaut). Après le push, vérifier la conclusion du run GitHub.
Un échec se corrige avant de considérer la livraison terminée.

**Surface API.** Ne pas réintroduire GET /api/state : la session rend déjà cet
état initial et chaque ressource possède son GET. Les anciens endpoints horaires
restent absents tant qu’aucun parcours client ne les consomme. Les appelants des
30 méthodes/chemins conservés sont documentés dans `docs/API-USAGE.md`.


**Transport et écoconception.** Le réseau TCL normalisé vit dans
`data/transport/gtfs-feed.json`, jamais dans `public/` ni le service worker.
`importTransportNetwork` le valide et l’importe en transaction SQLite lorsque
son empreinte change ; le dépôt transport porte les requêtes et l’index R*Tree.
La carte charge uniquement les cellules visibles par `GET /api/transport/stops`,
après le mouvement, avec cache React Query par cellule et version. Sous le zoom
11, demander de zoomer sans télécharger les quais. Ne pas confondre le nombre
total d’arrêts du contexte et le sous-ensemble affiché. `nearby-stops` conserve
le vrai compte du rayon et ses quatre résultats les plus proches.
`POST /api/transport/journeys` calcule le trajet le plus rapide côté serveur sur le
réseau complet : le cadrage ne doit jamais limiter une destination ou une
correspondance. Les anciennes routes `/api/route` et `/api/route-matrix` sont
retirées ; l’appel à MOTIS reste interne. La réponse objet `routeOption`
est validée dans `src/contracts/planning.ts`, les flux et ressources de carte
dans `src/contracts/transport.ts`. GBFS est mutualisé côté serveur
pendant 60 s ; le client relit le contexte chaque minute. Une panne après
expiration n’autorise aucune réutilisation d’un ancien flux GBFS.
Rejouer `bun run e2e:transport`, la planification et le hors-ligne après une
modification de ce parcours ; annoncer les octets mesurés, pas une économie
d’énergie supposée.


## Livraison avec horaires TCL officiels

La livraison du 6 septembre 2026 utilise l’archive officielle TCL fournie par l’utilisateur (`feed_start_date=20260906`, `feed_end_date=20270104`), importée dans MOTIS sur 60 jours. `MOTIS_TRANSIT_ENABLED=true` active les TCL à la préparation et au lancement. `GTFS_SOURCE_FILE` accepte le ZIP local ; `GTFS_SOURCE_URL` et les accès Data restent utilisables pour le téléchargement. Le renouvellement automatique et le temps réel restent à intégrer. L’archive ne contient pas `shapes.txt` : les tracés officiels SYTRAL complètent les segments dont la ligne, les quais et leur ordre concordent. Leur distance est mesurée sur ce tracé ; un segment sans correspondance vérifiée reste sans géométrie, avec une estimation de distance et de carbone annoncée. Les accès à pied conservent leur géométrie OSM. Sans archive, le mode `MOTIS_TRANSIT_ENABLED=false` reste disponible avec son bandeau et aucun trajet TCL. Les horaires de recette sont réservés à la CI.


## Navigation mobile de la présentation

La présentation conserve sa mise en page et se pilote aussi au toucher : balayage horizontal à gauche pour avancer, à droite pour revenir, en portrait ou paysage. Les petits gestes, le déplacement vertical, le zoom à plusieurs doigts et les liens ne déclenchent pas de changement de diapositive. `useSlideSwipe` dans `output/presentation/src/useSlideSwipe.ts` réutilise les fonctions de navigation de `Deck`. `scripts/e2e-presentation.mjs` vérifie de vrais événements tactiles Chromium et fait partie de `bun run ci`.

**Sélection sur la carte.** L’appui long de 500 ms ouvre le choix départ/arrivée. Le menu reste ouvert au relâchement et pendant les actualisations GPS ; un nouveau toucher extérieur ou la fermeture explicite le referme. Les déplacements, gestes annulés et appuis à plusieurs doigts ne sélectionnent aucun point. Rejouer `bun scripts/e2e-map-picker.mjs` après modification du sélecteur ou de son cycle de vie ; cette recette fait partie de `bun run ci`.


**Arrivée piétonne et tracés (B75–B77).** Une recherche utilise normalement un plan MOTIS et une référence voiture. Si aucun trajet direct partagé exploitable ne revient malgré des moyens partagés demandés, `recoverRentalArrival` reprend le calcul via un point du chemin piéton réel situé à au moins 150 m de marche de l’arrivée. Deux plans supplémentaires mesurent en parallèle l’approche multimodale et la fin à pied ; la destination exacte et les contraintes GBFS sont conservées. Le meilleur trajet complet reste comparé aux résultats initiaux. Cette reprise limitée ne garantit pas l’optimalité globale du moteur ; un échec conserve les résultats initiaux, sans tracé inventé. Les segments annulés, leurs quais annulés et les locations sans engin identifié sont exclus. `transitShape` raccorde les tracés officiels, avec les quais physiques dans le bon ordre pour le bus ; les types de bus étendus suivent le mode BUS de MOTIS pour le libellé et le facteur carbone. Sur la carte, le trajet avec contour blanc passe au-dessus des marqueurs. Vérifications : `server/src/__tests__/planning.test.ts`, `transit-shape.test.ts`, `scripts/e2e-tcl.mjs` et `scripts/e2e-arrival.mjs` (vrai moteur, destination exacte, trajet plus rapide que la marche et pixels du tracé mobile).


**Transfert mobile (B78).** Les GET publics `/api/transport/context`, `/api/transport/stops` et `/api/transport/nearby-stops` négocient gzip via `Accept-Encoding` et `Vary`, après validation du JSON. `transportCompression` utilise `Bun.gzipSync` sans dépendance supplémentaire, à partir de 1 024 octets. Les refus `gzip;q=0`, petits corps, erreurs et réponses du compte restent non compressés. Un instantané des disponibilités passe de 1 063 426 à 138 168 octets sans retirer aucun véhicule. Avant correction, le transfert public de cet instantané prenait 14–20 s et approchait le délai de 20 s du contexte transport. Les tests de `transport-compression.test.ts` vérifient identité du JSON, négociation et en-têtes ; `e2e-arrival.mjs` exige la compression des disponibilités, et `e2e-transport-map.mjs` distingue octets transférés et JSON décompressé. Aucun gain énergétique n’est déduit de cette mesure.


**Lecture du trajet (B79–B80).** Les terminus de bus sont comparés après normalisation des espaces et de la ponctuation ; les noms affichés, quais physiques et sens restent ceux de la source. TB12 est ainsi importé et raccordé au tracé officiel. Le réseau actualisé compte 98 lignes de bus, 203 tracés bus par sens et 3 135 quais bus (5 570 entrées et 216 tracés avec le rail). `boardingWaits` calcule chaque attente avant embarquement depuis le départ demandé, puis depuis l’arrivée du précédent transport et la durée des accès. Un départ à pied différé par MOTIS devient une attente au premier arrêt pour un départ immédiat ; la durée totale reste inchangée. Une heure manquante donne une attente indisponible, jamais zéro. Les détails montrent attente et départ théoriques de chaque transport. `RouteSequence` affiche les pictogrammes, flèches et lettres/numéros, avec libellés accessibles mais aucun texte « marche » visible. Vérifications : `boarding-waits.test.ts`, `scripts/bus-import.test.ts` et `scripts/e2e-tcl.mjs` (le cas officiel TB12 se rejoue avec `E2E_TCL_CASE=tb12`).


**Caméra après recherche (B81).** `UrbanMap` cadre le résultat à sa réception. Son `ResizeObserver` adapte ensuite le canvas sans rappeler `fitBounds` : déplacement et zoom restent libres, y compris lors d’un changement de hauteur du navigateur mobile. Le cadrage dépend du trajet reçu, pas des mises à jour des extrémités GPS pendant un calcul. Une nouvelle recherche cadre son résultat ; « Ma position » reste une demande explicite. `scripts/check-map-camera.mjs`, appelé par `e2e-map-picker.mjs` dans la CI, vérifie déplacement tactile, zoom, événements resize, changement réel de hauteur et cadrage du trajet inversé.
