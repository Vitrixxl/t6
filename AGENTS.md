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
l'application. Ils ne sont pas versionnés (`output/` est ignoré) mais ils sont
critiques : une phrase qui contredit le code se voit en revue, et c'est le
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

**Tout bogue corrigé donne lieu à une entrée dans [`docs/BUGS.md`](docs/BUGS.md).**

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
bun run test         # tests du client et de l'API (src/ et server/)
bun run e2e          # scénario de planification (Playwright)
bun run audit:a11y   # axe-core sur quatre écrans
```

L'ingestion GTFS reste en Python : pas d'équivalent JavaScript, et c'est
assumé. La génération du dossier PDF est gelée par la règle ci-dessus.

## Architecture

Les moteurs OSRM sont appelés directement depuis l'API : `OSRM_FOOT_URL`,
`OSRM_BIKE_URL` et `OSRM_CAR_URL`, avec une adresse configurable pour chaque moteur local.
Compose fournit les noms des trois services internes, sans Caddy ni port OSRM
publié. Ces moteurs locaux sont les seules sources de routage : aucun défaut
public, aucune bascule externe ni file de quota public. En cas de panne, seules
les mesures réelles du cache peuvent être réutilisées ; sinon l’API répond 503. La trottinette partage le moteur vélo ; la voiture reste une référence.

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

**Client** (`src/`) : `lib/planner/` (générateurs dans `options/`, rabattements vélo et
trottinette réunis dans `feeder-transit.ts`),
`lib/transport/` (`geocoding/`, `routing/`, `feeds/`), `lib/api/` (client HTTP,
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

**Toutes les options calculables sont proposées, sur mobile comme sur bureau.**
Ne jamais tronquer leur liste. Les options sont triées par durée réelle croissante. Les préférences influencent
le score et la présélection, pas l’ordre ni la visibilité des options. Il n’y a plus de plafond de marche
dans le profil ni de pénalité associée. Les contraintes de disponibilité,
de desserte et de mesure réelle restent celles du moteur. Les durées sont
formatées par `src/lib/duration.ts` : `63 min` se lit `1h03`.
Le panneau mobile prend la hauteur de son contenu, limitée à l’espace sous la
recherche. Son contenu long défile ; l’en-tête et la fermeture restent accessibles.
Aucune poignée ni commande ne règle sa taille.
Le cadrage de carte utilise les dimensions du canvas : les marges doivent
laisser une zone de dessin positive, même en paysage ou après redimensionnement.

**Les disponibilités Vélo’v et Dott exigent les flux en direct.** En cas
d’échec du groupe GBFS, `sharedMobility` vaut `null` : afficher l’indisponibilité,
sans fichier de secours ni compteur à zéro présenté comme une mesure. La carte
et le moteur ne proposent alors aucun véhicule partagé. Le repli météo reste
indépendant. Vérifier cette panne avec `bun run e2e:offline`.

**Ne jamais afficher un plafond comme une mesure.** Ce fut un vrai bogue
(B9) : l'interface annonçait « 300 trottinettes » parce que c'était la
constante de troncature. Si une liste est bornée pour le rendu, le nombre
annoncé reste le nombre réel.

**Le serveur est la seule source de vérité.** Il n'y a ni mode sans serveur
ni cache local persistant : c'est l'API qui sert le client, l'état du compte
est reçu à la connexion et amorce le cache de requêtes (React Query,
`src/queries/`). Chaque commande transporte une ressource, jamais la collection
complète ; les envois sont sérialisés. La complétion d'un trajet et la création
de son historique forment une seule transaction serveur. Une préférence ne
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

**Jamais de géométrie approchée.** Un tracé faux se lit comme un itinéraire
réel et envoie l'utilisateur ailleurs ; un tracé absent se voit. Tant qu'une
source réelle n'a pas répondu, un segment n'a pas de tracé, la carte n'affiche
rien pour lui et l'interface dit lequel des deux états s'applique — calcul en
cours, ou service indisponible. Ce fut un vrai bogue (B14) : des points
intermédiaires décorés, invisibles tant que le routage réel les remplaçait,
sont apparus le jour où le service tiers a cessé de répondre.

**Nommer les limites plutôt que les masquer.** Le moteur d'itinéraires reste
heuristique et il n'y a pas de graphe horaire GTFS : les fréquences sont des
moyennes, pas des horaires. Ces limites sont écrites dans le code et dans les
supports de revue maintenus ; ne pas produire d'affichage qui les contredit.

Un service horaire est préparé dans `server/src/services/transit/`, avec
`GET /api/transit/network` et `GET /api/transit/journeys`. Il n’est pas encore
branché au client : ne pas présenter les horaires comme livrés. L’import réel
attend une archive TCL récente et des tracés compatibles. Le suivi est dans
`docs/PLAN-ATTENTE-GTFS.md` ; aucun horaire fictif des tests ne doit être activé.

En revanche le nom de ligne **est** affiché depuis l'intégration de la desserte
publiée : une ligne n'est proposée que si elle dessert réellement les deux
stations du segment.

Les objectifs d'économie de CO2 hebdomadaire et mensuel sont deux valeurs de
profil indépendantes. Le mensuel ne se dérive pas du premier : chaque période
est comparée à son propre objectif persisté par l'API.

**La voiture est une référence, jamais une option.** Elle n'entre pas dans
`MobilityMode`, les préférences ni la liste des itinéraires : seul
`RoutableMode` connaît `car`. Une matrice OSRM driving `1 x 1` mesure sa
distance entre les extrémités de la recherche, une seule fois et en parallèle
du reste. Cette même référence est appliquée à toutes les options après leurs
mesures réelles. Le facteur est versionné dans `src/lib/planner/emissions.ts` ;
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
d'options, planification, marquage « fait ». Le relancer après toute
modification qui touche ce chemin.

## Git

Messages en français, avec les accents. Le corps explique le **problème résolu**
avant la solution — ces messages sont lus en revue et servent de trace de
raisonnement. Ne jamais committer `.env`, la base SQLite, ni le dossier
`output/`.
