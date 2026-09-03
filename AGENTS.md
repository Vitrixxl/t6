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
  `services/`, une requete dans `repositories/`, un contrat dans `models/`,
  une action d'interface dans `state/`. Un morceau de code qui ne sait pas
  dans quel dossier aller est mal decoupe.
- Une API se concoit par ressource : des routes qui disent ce qu'elles
  remplacent, des verbes qui ont leur sens (PUT idempotent), des reponses
  typees. Un point d'entree fourre-tout qui ecrase tout est un defaut de
  conception, pas une simplification.
- TypeScript strict, sans `any`, sans cast pour faire taire le compilateur,
  sans `eslint-disable` de confort. Un type qui refuse a souvent raison.
- Pas de code mort, pas de commentaire perime, pas de vocabulaire herite
  d'une version precedente. Quand la chose change, son nom change.
- Un changement de conception se propage partout ou il est decrit : code,
  tests, README, CHECKLIST, OpenAPI, et ce fichier.
- Avant de proposer, se demander comment un relecteur exigeant verrait le
  code. Si la reponse est « bricole », ne pas le proposer.

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

L'ingestion GTFS et la generation du dossier restent en Python : pas
d'equivalent JavaScript, et c'est assume.

## Architecture

Un fichier, une raison de changer. Ce n'est pas un seuil de lignes : un fichier
long mais cohesif reste preferable a trois fichiers qui se renvoient la balle.

**API** (`server/src/`) : `config/` `db/` `models/` `repositories/` `services/`
`plugins/` `routes/`. Les routes ne portent aucune regle metier, seule la
couche depot interroge la base (Drizzle sur `bun:sqlite`, jamais `sql.raw` sur
une entree), et les modeles TypeBox valident la requete, typent le gestionnaire
et generent l'OpenAPI depuis une source unique.

Le schema vit dans `server/src/db/schema.ts`. Toute modification passe par
`bun run db:generate`, et la migration produite dans `server/drizzle/` se
committe avec le schema : elle est appliquee au demarrage, y compris sur la
base `:memory:` des tests.

**Client** (`src/`) : `lib/planner/` (un generateur par mode dans `options/`),
`lib/transport/` (`geocoding/`, `routing/`, `feeds/`), `lib/api/` (client HTTP,
reprise de session, envoi de l'etat par partie), `lib/auth/`, `components/map/`,
`components/planner/trips/`, `components/app/hooks/`, et `state/` : l'etat
global en atomes jotai (session, etat du compte, derives, actions). Les
composants lisent les atomes dont ils ont besoin ; on ne fait pas transiter
l'etat par des props.

Le contrat de donnees (`src/types.ts`) est importe **par le client et par
l'API**. Un changement casse la compilation des deux cotes : c'est voulu, ne
pas le contourner en dupliquant les types.

## Regles de fond

**Ne jamais afficher un plafond comme une mesure.** Ce fut un vrai bogue
(B9) : l'interface annoncait « 300 trottinettes » parce que c'etait la
constante de troncature. Si une liste est bornee pour le rendu, le nombre
annonce reste le nombre reel.

**Le serveur est la seule source de verite.** Il n'y a ni mode sans serveur
ni cache local : c'est l'API qui sert le client, l'etat du compte est recu a la
connexion (`GET /api/state`), tenu en memoire (atomes jotai), et chaque action
renvoie en entier la ou les collections qu'elle a touchees, chacune vers sa
route (`PUT /api/trips/planned`, `/api/trips/recurring`, `/api/trips/history`,
`/api/saved-routes`, `/api/me/profile`). Une preference ne reecrit aucun
trajet. Une ecriture refusee par le reseau se dit a l'utilisateur, elle ne se
masque pas, et la partie refusee repart avec la prochaine action.

**Jamais de geometrie approchee.** Un trace faux se lit comme un itineraire
reel et envoie l'utilisateur ailleurs ; un trace absent se voit. Tant qu'une
source reelle n'a pas repondu, un segment n'a pas de trace, la carte n'affiche
rien pour lui et l'interface dit lequel des deux etats s'applique — calcul en
cours, ou service indisponible. Ce fut un vrai bogue (B14) : des points
intermediaires decores, invisibles tant que le routage reel les remplaçait,
sont apparus le jour ou le service tiers a cesse de repondre.

**Nommer les limites plutot que les masquer.** Le moteur d'itineraires reste
heuristique et il n'y a pas de graphe horaire GTFS : les frequences sont des
moyennes, pas des horaires. Ces limites sont ecrites dans le code et dans le
dossier ; ne pas produire d'affichage qui les contredit.

En revanche le nom de ligne **est** affiche depuis l'integration de la desserte
publiee : une ligne n'est proposee que si elle dessert reellement les deux
stations du segment.

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
