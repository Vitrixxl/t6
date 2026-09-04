# AGENTS.md

Consignes pour tout agent travaillant sur ce depot. UrbanFlow Mobility est le
projet professionnel du Titre 6 CDSD (RNCP 36146, session septembre 2026) : une
plateforme de mobilite urbaine multimodale. Le code sera **ouvert et discute en
revue face-a-face** devant un jury, ce qui oriente la plupart des regles
ci-dessous.

## Exigence de qualite

Le but est un depot propre, qu'un developpeur senior peut lire sans deviner
qu'un agent y a travaille. Pas un prototype qui marche par accident, pas du
code produit sans comprendre ce qu'il fait.

- Chaque chose a sa place, et une seule : une regle metier vit dans
  `services/`, une requete dans `repositories/`, un contrat dans
  `src/contracts/`, une ressource servie par l'API dans `src/queries/`, un
  etat d'ecran dans `src/state/`. Un morceau de code qui ne sait pas dans
  quel dossier aller est mal decoupe.
- Une API se concoit par ressource : des routes qui disent ce qu'elles
  remplacent, des verbes qui ont leur sens (PUT idempotent), des reponses
  typees. Un point d'entree fourre-tout qui ecrase tout est un defaut de
  conception, pas une simplification.
- TypeScript strict, sans `any`, sans cast pour faire taire le compilateur,
  sans `eslint-disable` de confort. Un type qui refuse a souvent raison.
- Pas de code mort, pas de commentaire perime, pas de vocabulaire herite
  d'une version precedente. Quand la chose change, son nom change.
- ESLint bloque une complexite cyclomatique superieure a 10 et plus de trois
  niveaux d'imbrication. L'objectif n'est pas de deplacer les branches dans un
  relais generique : extraire une responsabilite nommee et garder le parcours
  appelant lineaire.
- Un changement de conception se propage partout ou il est decrit : code,
  tests, README, CHECKLIST, OpenAPI, ce fichier, et les supports de revue
  maintenus (section ci-dessous).
- Avant de proposer, se demander comment un relecteur exigeant verrait le
  code. Si la reponse est « bricole », ne pas le proposer.

## Dossier PDF — artefact gele

**Ne jamais modifier `scripts/generate_dossier.py`, ne jamais regenerer ni
controler `output/pdf/`.** Le dossier PDF est un livrable historique gele qui
ne sera plus mis a jour. Un changement fonctionnel futur ne s'y reporte pas,
meme si son contenu devient anterieur au code courant.

## Supports de revue — a tenir a jour

Le depot est defendu a l'oral a partir de fichiers qui decrivent
l'application. Ils ne sont pas versionnes (`output/` est ignore) mais ils sont
critiques : une phrase qui contredit le code se voit en revue, et c'est le
candidat qui la porte.

- `output/soutenance/01-deroule.html` : le deroule d'oral, ce qu'il faut dire
  et dans quel ordre.
- `output/soutenance/02-bogues.html` : l'echantillon de bogues presente en
  revue de test.
- `output/soutenance/03-ecarts.html` : les ecarts assumes entre le sujet et
  le livrable.
- `output/revue-code.html` : la roadmap de lecture du depot, dans l'ordre des
  appels, avec les fichiers et symboles a ouvrir dans l'editeur.

**Toute modification fonctionnelle se reporte dans ces quatre fichiers dans
le meme travail**, pas dans un second temps : nombre d'options du moteur, modes et
combinaisons proposes, regles de gestion, nombre de tests par suite,
comportement en cas de panne d'une API. Pour la roadmap, verifier les chemins,
les symboles et l'ordre des appels. Avant de rendre la main, relire chacun
d'eux en se demandant s'il decrit encore l'application telle qu'elle est.

## Journal des bogues — obligatoire

**Tout bogue corrige donne lieu a une entree dans [`docs/BUGS.md`](docs/BUGS.md).**

C'est la contrainte la plus importante de ce depot. La competence C3.3 de la
grille est evaluee lors d'une revue de test portant sur « un echantillon de
bogues traites », ou il faut expliciter trois pratiques : identification,
correction, **et test du correctif**. Un correctif non consigne est un
correctif indefendable.

Chaque entree porte :

- le symptome observe, pas la conclusion ;
- la cause racine, distincte du symptome ;
- le correctif et le **lien de commit** ;
- le fichier ou le montrer ;
- le **niveau de verrouillage** : automatise, faible, ou ouvert.

Un bogue identifie mais non corrige va dans la section « Ouverts ». Ne rien
cacher : un bogue documente et assume vaut mieux qu'un bogue decouvert par
l'evaluateur.

Ne jamais qualifier un correctif d'« automatise » si aucun test, audit ou lint
n'echoue en cas de regression. Une configuration de build ou un rendu visuel se
verrouille faiblement, et cela se dit.

## Chaine d'outillage

Toute la chaine tourne sous **Bun**, sans exception : execution, regroupement,
tests, serveur. Pas de `npm`, pas de `node`, pas de bundler tiers. Un outil de
plus doit se justifier par un besoin que Bun ne couvre pas.

Le depot reste sur **TypeScript 7**. Tant que `typescript-eslint` ne le prend
pas en charge, ESLint utilise le parseur Babel pour la syntaxe ; `tsc` strict
reste l'autorite pour les types et les symboles inutilises.

Le format de reference des fichiers JavaScript et TypeScript est celui du LSP
TypeScript 7 appele par Neovim a la sauvegarde : espaces, indentation de quatre
colonnes, sans Prettier ni Biome. `.editorconfig` porte ces options pour eviter
qu'un autre editeur ne reformate le depot avec deux espaces.

Le serveur porte **l'API et le client** : une seule origine, donc un cookie de
session de premiere partie et aucun en-tete CORS. Il n'y a pas de serveur de
developpement separe.

```bash
bun install          # bun.lock est le seul lockfile
bun run dev          # serveur + reconstruction du client, un seul Ctrl+C
bun run build        # construit le client dans dist/
bun run start        # sert le build de production
bun run check        # lint + typage + tests + build
bun run test         # tests du client et de l'API (src/ et server/)
bun run e2e          # scenario de planification (Playwright)
bun run audit:a11y   # axe-core sur quatre ecrans
```

L'ingestion GTFS reste en Python : pas d'equivalent JavaScript, et c'est
assume. La generation du dossier PDF est gelee par la regle ci-dessus.

## Architecture

Un fichier, une raison de changer. Ce n'est pas un seuil de lignes : un fichier
long mais cohesif reste preferable a trois fichiers qui se renvoient la balle.

**API** (`server/src/`) : `config/` `db/` `repositories/` `services/`
`plugins/` `routes/`. Les routes ne portent aucune regle metier, seule la
couche depot interroge la base (Drizzle sur `bun:sqlite`, jamais `sql.raw` sur
une entree), et les contrats zod de `src/contracts/` valident la requete,
typent le gestionnaire et generent l'OpenAPI depuis une source unique. Une
collection se lit par GET ; chaque ressource s'ecrit ou se retire par son URL.
Aucun depot ne remplace une collection complete.

Le schema vit dans `server/src/db/schema.ts`. Toute modification passe par
`bun run db:generate`, et la migration produite dans `server/drizzle/` se
committe avec le schema : elle est appliquee au demarrage, y compris sur la
base `:memory:` des tests.

**Client** (`src/`) : `lib/planner/` (un generateur par mode dans `options/`),
`lib/transport/` (`geocoding/`, `routing/`, `feeds/`), `lib/api/` (client HTTP,
authentification, une commande par ressource du compte), `queries/` (les ressources
servies par l'API dans le cache React Query : une ressource par fichier, sa
requete et ses actions), `state/` (l'etat d'ecran partage entre modules, en
atomes jotai), `components/map/` (cycle de vie et couches separes),
`components/planner/` (etat de recherche et rendu separes),
`components/app/` (orchestrateur, dispositions et hooks),
`components/tutorial/` (parcours distincts desktop et mobile, cibles posees sur
les controles reels). Tous les appels du client vers l'API UrbanFlow passent
par Eden Treaty et sont types depuis l'arbre Elysia ; aucun appel n'envoie une
collection complete. Les appels aux services tiers restent dans
`lib/transport/`. Les composants appellent les hooks dont ils ont
besoin ; on ne fait pas transiter l'etat par des props. Un formulaire valide
avec le contrat que l'API applique (react-hook-form + zod) : aucune borne
n'est recopiee dans un composant.

Le contrat de donnees est importe **par le client et par l'API** :
`src/contracts/` porte un schema zod par objet echange ou saisi, et le type
qui en derive ; `src/types.ts` reexporte ces types et declare ceux qui ne se
valident pas (flux transport, options d'itineraire). Un changement casse la
compilation des deux cotes : c'est voulu, ne pas le contourner en dupliquant
les types ni les bornes.

## Regles de fond

**Ne jamais afficher un plafond comme une mesure.** Ce fut un vrai bogue
(B9) : l'interface annoncait « 300 trottinettes » parce que c'etait la
constante de troncature. Si une liste est bornee pour le rendu, le nombre
annonce reste le nombre reel.

**Le serveur est la seule source de verite.** Il n'y a ni mode sans serveur
ni cache local persistant : c'est l'API qui sert le client, l'etat du compte
est recu a la connexion et amorce le cache de requetes (React Query,
`src/queries/`). Chaque commande transporte une ressource, jamais la collection
complete ; les envois sont serialises. La completion d'un trajet et la creation
de son historique forment une seule transaction serveur. Une preference ne
reecrit aucun trajet. Une ecriture refusee se dit a l'utilisateur, elle ne se
masque pas : seule la vue concernee est relue depuis son GET, l'ecran revient a
ce que le serveur tient, et l'action est a rejouer.

**Jamais de geometrie approchee.** Un trace faux se lit comme un itineraire
reel et envoie l'utilisateur ailleurs ; un trace absent se voit. Tant qu'une
source reelle n'a pas repondu, un segment n'a pas de trace, la carte n'affiche
rien pour lui et l'interface dit lequel des deux etats s'applique — calcul en
cours, ou service indisponible. Ce fut un vrai bogue (B14) : des points
intermediaires decores, invisibles tant que le routage reel les remplaçait,
sont apparus le jour ou le service tiers a cesse de repondre.

**Nommer les limites plutot que les masquer.** Le moteur d'itineraires reste
heuristique et il n'y a pas de graphe horaire GTFS : les frequences sont des
moyennes, pas des horaires. Ces limites sont ecrites dans le code et dans les
supports de revue maintenus ; ne pas produire d'affichage qui les contredit.

En revanche le nom de ligne **est** affiche depuis l'integration de la desserte
publiee : une ligne n'est proposee que si elle dessert reellement les deux
stations du segment.

Les objectifs d'economie de CO2 hebdomadaire et mensuel sont deux valeurs de
profil independantes. Le mensuel ne se derive pas du premier : chaque periode
est comparee a son propre objectif persiste par l'API.

**La voiture est une reference, jamais une option.** Elle n'entre pas dans
`MobilityMode`, les preferences ni la liste des itineraires : seul
`RoutableMode` connait `car`. Une matrice OSRM driving `1 x 1` mesure sa
distance entre les extremites de la recherche, une seule fois et en parallele
du reste. Cette meme reference est appliquee a toutes les options apres leurs
mesures reelles. Le facteur est versionne dans `src/lib/planner/emissions.ts` ;
une economie negative reste negative, et une reference indisponible reste
`null` jusque dans les contrats et la base. Aucun zero de repli n'est invente.

Les facteurs de transport public suivent le `route_type` GTFS. Tramway et
metro portent leurs facteurs documentes ; le funiculaire reprend explicitement
le facteur metro tant qu'aucune donnee specifique n'est disponible. Toute
valeur carbone affichee utilise l'unite `gCO2e` (rendue `gCO₂e` dans l'UI).

**Commentaires : le pourquoi, pas le quoi.** Ils sont en francais, sans
accents, alignes sur le style existant. Un commentaire qui paraphrase la ligne
suivante est du bruit ; un commentaire qui explique un arbitrage a de la
valeur en revue.

## Verification

Une modification observable dans le navigateur se verifie **dans le
navigateur**, pas au compilateur. `bun run check` ne prouve pas qu'une carte
s'affiche ni qu'un bouton fait ce qu'il annonce.

Le scenario `bun run e2e` couvre le parcours critique : connexion, GPS, calcul
d'options, planification, marquage « fait ». Le relancer apres toute
modification qui touche ce chemin.

## Git

Messages en francais, sans accents. Le corps explique le **probleme resolu**
avant la solution — ces messages sont lus en revue et servent de trace de
raisonnement. Ne jamais committer `.env`, la base SQLite, ni le dossier
`output/`.
