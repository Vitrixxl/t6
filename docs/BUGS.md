# Journal des bogues

Ce document existe pour une raison précise. La compétence **C3.3** est évaluée
lors d'une revue face-à-face ou le candidat doit expliciter et valider trois
pratiques :

- ses pratiques pour **identifier la source** des bogues ;
- ses pratiques de **correction** des bogues ;
- ses pratiques de **test et validation des correctifs**.

Chaque entrée ci-dessous suit donc ces trois sections, dans cet ordre. Un
correctif non consigné est un correctif indéfendable : ce qui n'est pas écrit
ici ne peut pas être montré en revue.

**Règle de verrouillage.** Un correctif n'est déclare verrouille que si son test
a été vu **rouge avant le correctif, puis vert après**. Un test écrit après coup
qui passe du premier coup ne prouve rien : il peut très bien ne rien couvrir.
La vérification rouge-puis-vert est notée dans chaque entrée.

---

## B16 — L'objectif hebdomadaire était calcule sur tout l'historique

**Criticité** : majeur — l'indicateur central de la fonctionnalité F4
(calculateur d'empreinte carbone avec suivi personnel) annonçait un chiffre faux.

### Identifier la source

La recherche est partie d'une hypothèse de terrain plutôt que d'un signalement :
**les fenêtres d'agrégation sont un endroit ou les défauts se logent souvent**,
parce que la période est portée par le libellé et non par le calcul. J'ai donc
relu les fonctions d'agrégation en cherchant, pour chacune, ou était la borne de
temps.

`summarizeCarbon` acceptait un `weeklyGoalGrams` mais sommait **tous** les
enregistrements, sans aucun filtre de date. Restait à savoir si c'était
volontaire : un cumul de toujours est une quantité légitime. J'ai donc cherché
le libellé affiché a côté, et trouvé dans `CarbonPanel` :

> `{summary.goalUsagePercent}% de l'objectif hebdomadaire de ... g`

C'est l'appariement qui tranchait. La confirmation est venue d'un second écran :
`TripGoalsCard` affiche la même notion en s'appuyant sur `savedThisWeekGrams`,
lui correctement borne à la semaine par `summarizeTripActivity`.

**Symptôme, une fois nomme** : la barre de progression hebdomadaire ne
redescendait jamais le lundi, et deux écrans annonçaient des chiffres
différents pour la même notion.

**Cause racine** : aucune des deux fonctions n'était fausse. `summarizeCarbon`
est un cumul de toujours, `summarizeTripActivity` filtre bien la semaine. Le
défaut était **l'appariement** d'un total sans borne avec un libellé
hebdomadaire — un défaut qui n'existe dans aucun des deux fichiers, seulement
entre eux.

### Corriger

La fenêtre est appliquée **à la source**, dans `summarizeCarbon`, et non dans
chaque écran : laisser chaque appelant filtrer aurait reproduit le même défaut
au prochain écran ajoute.

`startOfWeek` vivait dans `trips/summary.ts`. Le laisser la et l'importer
depuis le suivi carbone aurait couple deux modules sans rapport ; le
reimplementer aurait créé deux définitions du lundi, libres de diverger. Il
part donc dans `src/lib/week.ts`, dont c'est la seule raison d'exister.

Les libellés de `CarbonPanel` deviennent explicites — « Trajets cette semaine »,
« CO2 évité cette semaine » — parce que l'entête porte désormais sur la semaine
alors que l'historique dessous porte sur les cinquante derniers trajets. Deux
périodes sur un même écran doivent se dire.

**Ou le voir** : `src/lib/week.ts`, `src/lib/carbon.ts`,
`src/components/carbon/CarbonPanel.tsx`

### Tester et valider le correctif

Trois tests unitaires ecrits **avant** le correctif, sur une fonction pure a
horloge injectée :

1. un trajet de la semaine, un de la semaine précédente : seul le premier compte ;
2. bascule du lundi : le même trajet compte le dimanche soir, plus le lundi matin ;
3. borne inférieure : un trajet fait lundi a 00:00 est dans la semaine.

Un quatrième test verrouille la cause racine plutôt que son symptôme : il
construit des trajets planifies, les convertit en enregistrements par le chemin
réel (`plannedTripToRecord`), et exige que **les deux agrégats annoncent le même
CO2 évité**. C'est celui-la qui empeche les deux écrans de rediverger ; les
trois premiers ne verrouillent que le calcul.

**Validation** : les deux premiers tests vus **rouges** avant le correctif
(`expected 2 to be 1`, `expected 1 to be +0`), **verts** après. Suite complète
verte : 94 tests unitaires, 37 tests d'API.

**Niveau de verrouillage** : **automatisé**.

---

## B17 — Une trottinette proposée sur 416 kilomètres

**Criticité** : majeur — la contrainte C6 exige de « garantir la précision et la
fiabilité des données de géolocalisation et d'itinéraires ». Un itinéraire
impossible presente comme une option y contrevient directement.

### Identifier la source

Aucun signalement ne pointait ce défaut : il fallait aller le chercher. J'ai
soumis le moteur a des **entrées aux limites** et vérifie des **invariants**
plutôt que des valeurs attendues — technique proche du property-based testing.
L'interet est de ne pas avoir a deviner ou est le bogue.

Entrées : origine égale à la destination, destination hors périmètre (Paris),
antipode, profil PMR, covoiturage à un occupant. Invariants contrôles sur
**toutes** les options rendues : distance et durée finies et positives, CO2
positif, score entre 0 et 100, aucun segment de durée nulle.

Aucun invariant n'a saute. C'est une **comparaison** qui a revele le défaut :
pour Paris, le moteur rendait une option trottinette mais aucune option vélo.
Deux modes presque identiques, dont un seul survit à une destination absurde —
cette asymétrie n'a aucune justification métier, et c'est elle qui a désigné
l'oubli.

Mesures depuis Bellecour, une fois le soupçon confirme : Vienne 28 km / 2 h,
Grenoble 100 km / 6 h, **Paris 416 km / 23 h / 6233 g**. Au même moment,
l'application affichait sa propre banniere « hors métropole de Lyon :
vélos/trottinettes indisponibles » au-dessus de la liste qui proposait
exactement cela.

**Cause racine** : RG3 — un vehicule partage doit être a distance de marche —
était vérifiée **aux deux extrémités** dans `createBikeOption`, mais
**seulement à l'origine** dans `createScooterOption`. Rien d'autre ne bornait
la course.

Le vélo n'était donc pas protege par une intention, mais **par effet de bord** :
sa seconde vérification existe parce qu'un Vélo'v se rend à une borne, pas
parce que quelqu'un avait pense au problème de la distance.

### Corriger

La correction évidente — copier la vérification du vélo — aurait produit un
second bogue. Le Vélo'v est un service **a bornes** : exiger une station a
l'arrivée est légitime. La trottinette est en **flotte libre** : exiger une
trottinette à l'arrivée n'a aucun sens, il n'y en a peut-etre aucune la-bas
justement parce que personne n'y est encore alle.

La règle manquante n'est donc pas la même. Pour une flotte libre, la contrainte
de fin de trajet est la **zone de service de l'opérateur** : au-delà, le
vehicule est immobilise et l'utilisateur penalise. `withinServiceArea` s'appuie
sur le périmètre métropolitain déjà utilisé par la banniere de couverture, ce
qui les rend d'accord par construction plutôt que par coincidence.

**Ou le voir** : `src/lib/planner/geo.ts` (`withinServiceArea`),
`src/lib/planner/options/scooter.ts`

### Tester et valider le correctif

Trois tests écrits **avant** le correctif :

1. destination hors zone : aucune option trottinette ;
2. destination dans la zone : l'option est toujours la — un correctif qui
   supprimerait le mode passerait le premier test et echouerait celui-ci ;
3. **les deux modes partagés sont bornes**, sans qu'aucun ne survive à l'autre.
   C'est le test de la cause racine : il verrouille l'asymétrie elle-même, la ou
   les deux premiers ne couvrent que la trottinette.

**Validation** : tests 1 et 3 vus **rouges** avant le correctif
(`expected [ 'scooter', 'carpool', 'walk' ] to not include 'scooter'`),
**verts** après. Puis rejeu de la sonde initiale : Vienne, Grenoble et Paris ne
rendent plus que marche et covoiturage — exactement ce que la banniere annonce —
tandis que Villeurbanne, a 8 km, conserve sa trottinette.

**Niveau de verrouillage** : **automatisé**.

---

## B18 — Des trajets déjà passes comptes comme à venir

**Criticité** : mineur — aucun calcul faux ni action erronee, mais un compteur
qui ment sur l'écran principal.

### Identifier la source

Les dates sont un terrain a fort rendement : elles concentrent les cas limites
que personne ne joue à la main. J'ai donc sonde le moteur de recurrence **sans
navigateur**, en injectant une horloge — `syncRecurringOccurrences` et
`summarizeTripActivity` acceptent toutes deux un `now`, ce qui rend chaque
scénario reproductible à la seconde près.

Quatre situations passées au crible, en une seule sonde :

| Situation | Résultat |
| --- | --- |
| Rejeu de la génération | idempotent, aucun doublon |
| Fenêtre a cheval sur le passage à l'heure d'hiver | 08:00 local des deux côtés, correct |
| Trajet fait le dimanche, consulté le lundi | bien rattache à la semaine précédente |
| **Génération a 22 h un mercredi** | **occurrences de 08:00 et 18:00 du jour créées** |

La derniere ligne est le défaut. `upcomingTrips` les renvoyait ensuite comme
« à venir » : a 22 h, la pastille annonçait **2 trajets à venir**, tous deux
passes depuis longtemps.

**Cause racine** : deux decisions raisonnables qui se composent mal.
`syncRecurringOccurrences` parcourt les jours à partir d'aujourd'hui sans jamais
comparer l'heure de l'occurrence a `now`. Et la tolérance de 24 h de
`upcomingTrips` — voulue, pour marquer « fait » en fin de journee un trajet du
matin — **masque** l'erreur au lieu de l'arrêter.

Aucune des deux n'est fautive isolement. C'est leur composition qui l'est, ce
qui explique qu'aucune relecture d'un seul fichier ne l'aurait revelee.

### Corriger

Le correctif porte sur la **génération**, pas sur la tolérance. Une occurrence
n'est matérialisée que si son heure est encore devant : ce qui n'a jamais existe
n'a pas a naître dans le passe.

Corriger du côté de `upcomingTrips` aurait été le reflexe le plus court — c'est
là que le symptôme se voit — et aurait casse un comportement voulu : on ne
pourrait plus marquer fait, le soir, le trajet du matin. Le symptôme et la cause
n'étaient pas dans le même fichier.

**Ou le voir** : `src/lib/trips/routines.ts`

### Tester et valider le correctif

Trois tests écrits **avant** le correctif :

1. génération a 22 h : aucune occurrence du jour, et rien de passe dans la liste
   des trajets à venir ;
2. génération a 07 h : les deux occurrences du jour sont bien créées — un
   correctif qui supprimerait purement les occurrences du jour passerait le
   premier test et echouerait celui-ci ;
3. **non-regression de la tolérance** : une occurrence **déjà existante** et
   passée reste listee et marquable le soir. C'est le test qui empeche de
   « corriger » en cassant la grâce de 24 h.

**Validation** : premier test vu **rouge** avant le correctif
(`expected [ … ] to have a length of +0 but got 2`), **vert** après. Puis rejeu
de la sonde initiale : « occurrences du jour déjà passées : (aucune) », et
« comptées comme à venir : 0 », l'idempotence et le changement d'heure restant
inchanges.

**Niveau de verrouillage** : **automatisé**.

**Devenir** : le moteur de recurrence a été retire depuis. Une routine
n'engendre plus aucun trajet : ses passages sont comptes à la lecture, entre
sa création et maintenant, et seuls ceux dont l'heure est passée comptent
(`src/lib/trips/routines.ts`). Le défaut ne peut plus se produire, par
construction ; le test « ne compte pas un passage dont l'heure n'est pas
encore passée » (`src/lib/trips/trips.test.ts`) verrouille la même propriété
sous sa nouvelle forme.

---

## B19 — La pastille et la fiche annonçaient deux chiffres pour le même trajet

**Criticité** : majeur — deux mesures contradictoires du même itinéraire, a
quelques centimetres l'une de l'autre sur le même écran.

### Identifier la source

Trouve en **relisant une capture d'écran** produite pour la soutenance, pas en
lisant du code. La pastille de l'option retenue annonçait « Trottinette 11 min
· 2,3 km » et la fiche de détail, juste en dessous, « 21 min · 3,2 km ».

C'est une méthode a part entière : regarder son propre produit avec les yeux de
celui qui va le decouvrir. Le défaut était la depuis l'introduction du routage
par segment, et aucune relecture de code ne l'avait revele — parce qu'il ne se
voit que lorsque les deux valeurs sont affichées côté a côté.

**Cause racine** : seul l'itinéraire selectionne est route segment par segment,
choix delibere qui borne le nombre d'appels au calculateur. `selectedRoute`
recevait donc les mesures réelles, mais la liste qui alimente les pastilles
continuait de porter les estimations à vol d'oiseau. Les deux composants lisaient
deux objets différents pour le même trajet.

Même famille que B16 : deux vues d'une même grandeur, alimentees par des sources
qui ne se parlent pas.

### Corriger

La réconciliation est extraite dans une fonction pure, `applyRoutedSelection`,
plutôt que laissee dans le hook : c'est ce qui la rend testable, et le défaut
était précisément dans la couche non testee.

Les options **non sélectionnées** gardent leur estimation. Ce n'est pas un
compromis : elles n'ont pas été routees, l'estimation est donc la seule mesure
dont on dispose, et l'annoncer est exact.

**Ou le voir** : `src/lib/planner/legs.ts`,
`src/components/app/hooks/useRouteOptions.ts`

### Tester et valider le correctif

Trois tests écrits **avant** le correctif, la fonction ayant d'abord été posee
en passe-plat pour obtenir un échec d'assertion plutôt qu'une erreur de
compilation :

1. la liste porte les mesures routees de l'option sélectionnée ;
2. les autres options restent **identiques par référence** — un correctif qui
   recalculerait tout passerait le premier test et echouerait celui-ci ;
3. sans itinéraire route, la liste est rendue inchangée.

**Validation** : premier test vu **rouge** (`expected 14 to be 28`), **vert**
après. Suite complète : 103 tests unitaires, 37 tests d'API. Capture mobile
régénérée pour verifier que les deux valeurs concordent à l'écran.

**Niveau de verrouillage** : **automatisé**.

---

## B20 — Les chiffres d'une option changeaient selon qu'elle était sélectionnée

**Criticité** : majeur — la liste d'options existe pour comparer, et ses lignes
n'étaient pas comparables entre elles.

### Identifier la source

Signale par l'utilisateur, captures à l'appui : le même trajet, deux relevés.

| Option | Vélo selectionne | Trottinette sélectionnée |
| --- | --- | --- |
| Vélo | **32 min, 5,0 km** | 26 min, 4,5 km |
| Trottinette | 17 min, 4,0 km | **24 min, 4,8 km** |

Chaque option changeait de valeurs en devenant sélectionnée, et y revenait en
cessant de l'être.

**Cause racine** : pour borner le nombre d'appels au calculateur, un seul
itinéraire était mesure segment par segment — celui affiche. Les autres
restaient sur l'estimation à vol d'oiseau du moteur local. La liste melangeait
donc **deux méthodes de mesure**, et comparer 24 minutes mesurées a 31 minutes
estimées n'a aucun sens.

**Ce bogue est ne d'un correctif.** B19 avait corrige la contradiction entre la
pastille et la fiche de détail en faisant remonter la valeur mesurée dans la
liste. La contradiction a disparu de l'écran de détail pour reapparaître, sous
une autre forme, dans la comparaison. Une correction qui deplace un défaut au
lieu de le supprimer est une correction incomplete : la vraie question n'était
pas « quelle valeur afficher ou », mais « pourquoi deux valeurs coexistent ».

### Corriger

Toutes les options sont mesurées, plus seulement celle qu'on regarde. Le calcul
local ne sert qu'à savoir **quelles** options existent ; ses chiffres ne
sortent plus du hook.

Trois consequences assumées :

- le coût passe de trois appels à une quinzaine par recherche. Il est absorbe
  par le cache partagé introduit en B13 : les mêmes trajets ne repartent pas
  chez le calculateur, et une instance auto-hébergée rend là question sans
  objet ;
- une option dont un segment n'a pas pu être mesure est **écartée**. La garder
  supposerait de retomber sur son estimation, donc de remettre deux méthodes
  dans la même liste ;
- le classement est refait après mesure. Le score dépend de la durée et du
  carbone : le figer sur l'estimation aurait contredit les chiffres affiches.

L'orchestration est extraite dans `measureRoutes`, fonction pure prenant le
routeur en paramètre — c'est ce qui la rend testable, la version précédente
vivant dans un hook React hors de portée des tests.

`applyRoutedSelection`, le correctif de B19, disparaît : la structure rend
désormais la contradiction impossible, la pastille et la fiche lisant le même
objet. Un garde-fou qui ne garde plus rien est du bruit.

**Ou le voir** : `src/lib/planner/index.ts` (`measureRoutes`, `rankRoutes`),
`src/components/app/hooks/useRouteOptions.ts`

### Tester et valider le correctif

Trois tests écrits **avant** le correctif, la fonction ayant d'abord été posee
en passe-plat pour obtenir des échecs d'assertion plutôt qu'une erreur d'import :

1. **toutes** les options ressortent mesurées, aucune ne reste à l'estimation ;
2. une option dont un segment n'a pas de tracé est écartée — un correctif qui la
   garderait avec son estimation passerait le premier test et echouerait
   celui-ci ;
3. le classement est recalcule sur les mesures : les scores différent de ceux de
   l'estimation, et restent ordonnes.

Le routeur de test est un doublon qui double les distances et pose un tracé.
La première version ne posait pas de tracé, et le test échouait pour une raison
étrangère au correctif : un doublon doit se comporter comme la chose qu'il
remplace, sinon il teste autre chose.

**Validation** : les trois vus **rouges** (`expected 2.67 to be close to 5.34`,
`expected [ … ] to have a length of +0 but got 6`, `expected [ 100, 93, … ] to
not deeply equal [ 100, 93, … ]`), **verts** après. Suite complète : 103 tests
unitaires, 37 tests d'API.

**Niveau de verrouillage** : **automatisé**.

---

## B21 — Le service worker servait l'API depuis son cache, y compris après la déconnexion

**Criticité** : critique — une session révoquée en base restait « vivante »
dans le navigateur, et le compte suivant sur le même appareil pouvait recevoir
l'état du précédent.

### Identifier la source

Trouve en verifiant la déconnexion de bout en bout, après le passage de l'état
du compte sur des atomes. Le scénario bureau demandait `/api/state` juste après
la déconnexion et recevait **200**, alors que le journal du serveur montrait,
dans l'ordre, la révocation puis un **401** sur la même route.

Deux témoins qui se contredisent désignent un intermédiaire. Rejoue avec
`curl` sans navigateur : connexion, déconnexion, `/api/state` → 401. Le serveur
est donc hors de cause ; il reste, entre la page et lui, le service worker.
`public/sw.js` appliquait « cache d'abord » a **toute** requête GET de même
origine en 200, `/api/*` compris. Une fois `/api/state` vue une première fois,
chaque lecture suivante venait du cache, déconnexion ou non. Le même mécanisme
pouvait renvoyer `/api/auth/session` en cache au rechargement : la session d'un
compte précédent ressuscitee sur un appareil partage.

La cause est antérieure à l'état en mémoire : elle existait depuis la mise en
place du service worker, masquée tant que le cache local du client faisait
écran entre l'interface et l'API.

### Corriger

Le service worker laisse passer `/api/*` sans jamais le mettre en cache
(`public/sw.js`, garde en tete du gestionnaire `fetch`). Les réponses de l'API
dépendent de la session et changent à chaque action : aucune n'est cachable.
Le soclé de l'application et les données statiques (GTFS, stations de repli)
restent en cache pour le hors ligne, c'est leur rôle. Le nom du cache passe en
`v3` pour que les installations existantes jettent le leur à l'activation.

### Tester et valider le correctif

Le scénario `bun run e2e` gagne une septieme assertion, ecrite **avant** le
correctif : après déconnexion, `/api/state` répond 401 au navigateur et le
rechargement ramene l'écran de connexion. Un test unitaire ne suffit pas ici,
le comportement fautif est celui du navigateur avec son service worker actif ;
le scénario tourne sur le build de production, ou le service worker est
enregistre.

**Validation** : vu **rouge** avant le correctif (`apres deconnexion,
/api/state repond encore 200 au navigateur`), **vert** après (`7/7 assertions
passees`), sur un serveur et une base neufs. Le scénario bureau (profil,
objectifs, rechargement, déconnexion) rejoue aussi vert.

**Niveau de verrouillage** : **automatisé** (scénario E2E bloquant en CI).

---

## B22 — Une erreur React apparaissait pendant la déconnexion

**Criticité** : moyenne — la session était bien révoquée, mais la console du
navigateur signalait `Aucune session ouverte.` pendant le retour à l'écran de
connexion.

### Identifier la source

Le scénario E2E passait ses sept assertions tout en remontant une
`PAGE ERROR` juste après la purge du compte. `closeSession` publiait d'abord
une session nulle, puis supprimait les requêtes et mutations du compte. Entre
ces notifications, un composant encore monte pouvait se rendre, appeler
`useUser` et constater que sa session avait déjà disparu.

### Corriger

`closeSession` purge maintenant les mutations et les ressources du compte
avant de publier sa fermeture. Comme React Query regroupe ses notifications,
`useUser` conserve aussi dans une référence de composant sa derniere session
valide : le dernier rendu précédant le démontage reste cohérent, sans faire
survivre cette valeur au composant ni à la prochaine connexion.

**Ou le voir** : `src/queries/session.ts` (`closeSession`),
`src/queries/user.ts` (`useUser`)

**Commit** : [`65d2e5b`](https://github.com/Vitrixxl/t6/commit/65d2e5b)

### Tester et valider le correctif

Le test de déconnexion observe la requête de session et vérifie qu'au moment
exact où elle devient nulle, aucune requête de l'ancien compte ne subsiste.
Le scénario `bun run e2e` doit en plus terminer ses 7/7 assertions sans
`PAGE ERROR` dans un vrai navigateur.

**Niveau de verrouillage** : **automatisé** (test du cache + scénario E2E).

---

## B23 — Le point d'accès le plus proche n'était pas toujours le plus rapide

**Criticité** : majeur — un mur, des voies ferrees ou une entrée situee de
l'autre côté d'un îlot pouvaient faire choisir une station Vélo'v, une
trottinette ou un arrêt plus long a rejoindre qu'un candidat un peu plus loin.

### Identifier la source

Le défaut a été trouve en questionnant le choix technique pendant la revue du
moteur : la sélection des stations utilisait uniquement la distance Haversine,
alors que la durée affichée ensuite venait d'OSRM. Le moteur optimisait donc une
grandeur différente de celle annoncée à l'utilisateur.

**Symptôme** : deux points d'accès proches pouvaient être classes dans le
mauvais ordre des qu'un obstacle imposait un detour piéton.

**Cause racine** : `nearestStation` et les candidats GTFS decidaient directement
sur la distance à vol d'oiseau. OSRM n'intervenait qu'après la construction de
l'option, trop tard pour corriger le point d'accès choisi.

### Corriger

Haversine ne prend plus de decision : il borne seulement la recherche a huit
candidats. `POST /api/route-matrix` mesure ensuite, en une requête OSRM Table,
les durées réelles vers ces candidats. Le moteur retient le plus rapide dans la
limite métier, puis construit les options. La marche choisit le profil piéton ;
le rabattement vélo et trottinette utilise le profil vélo.

Les cellules de la matrice rejoignent le cache SQLite partagé de B13 sous des
clés distinctes des géométries. Une géométrie déjà connue peut fournir sa
mesure ; une entrée expirée peut encore servir si OSRM tombe.

**Ou le voir** : `src/lib/planner/access.ts`,
`server/src/services/routing/index.ts`, `server/src/routes/routing.ts`

**Commit** : [`4c170ad`](https://github.com/Vitrixxl/t6/commit/4c170ad)

### Tester et valider le correctif

`src/lib/planner/access.test.ts` oppose une station plus proche à vol d'oiseau
mais accessible en douze minutes à une station plus eloignee accessible en 110
secondes : la seconde doit gagner. Les tests API verifient qu'une matrice
complète ne produit qu'un appel amont, puis ressort entierement du cache.

Le test de sélection a été ajoute après la première implémentation : il
detectera une régression, mais n'a pas été vu rouge avant le correctif initial.

**Niveau de verrouillage** : **faible** (régression automatisee, protocole
rouge-puis-vert initial non observe).

---

## B24 — Le temps de correspondance métro était invisible dans les étapes

**Criticité** : moyenne — la durée totale comptait quatre minutes, mais la fiche
passait directement de la première ligne à la seconde. L'utilisateur ne voyait
ni qu'il devait marcher ni d'où venait ce temps.

### Identifier la source

Le défaut a été signale sur une capture du trajet Métro A vers Métro B a
Charpennes : les deux cartes de ligne étaient consecutives, sans étape entre
elles. La constante `TRANSFER_PENALTY_MINUTES` était seulement ajoutée au total
du parcours dans `findTransitJourney`.

**Cause racine** : la correspondance était une pénalité de scoring, pas un
segment du domaine. La restitution ne pouvait donc pas l'afficher, et le temps
de marche maximal du profil ne pouvait pas la compter comme marche.

### Corriger

`transitLegs` insère entre deux trajets un segment `walk` intitule
« Correspondance à pied », de quatre minutes. Il reste visible même avec une
distance nulle et participe aux agrégats. Le segment porte `transfer: true` :
le routeur et la vérification de géométrie savent alors que l'absence de tracé
est volontaire. Le GTFS ne publiant pas les cheminements intérieurs entre quais,
aucune ligne droite trompeuse n'est dessinée sur la carte.

**Ou le voir** : `src/lib/planner/transit.ts`,
`src/components/planner/RouteSteps.tsx`, `src/lib/transport/routing/legs.ts`

**Commit** : [`4c170ad`](https://github.com/Vitrixxl/t6/commit/4c170ad)

### Tester et valider le correctif

Le test construit deux lignes qui se croisent a Charpennes et exige exactement
trois segments : métro A, marche, métro B. La première exécution a été vue
**rouge** : la fabrique ajoutait sa minute minimale de parcours aux quatre
minutes fixes et rendait cinq minutes. Après distinction entre distance nulle
et temps fixe, le test est vert a quatre minutes. Un second test vérifie
qu'OSRM n'est pas appele et que la géométrie vide est acceptee.

**Niveau de verrouillage** : **automatisé**.

---

## B25 — L'objectif mensuel de CO2 ne pouvait pas être choisi

**Criticité** : moyenne — le planificateur affichait une progression mensuelle,
mais sa cible était toujours l'objectif hebdomadaire multiplie par quatre. Un
utilisateur ne pouvait donc pas fixer une ambition propre au mois.

### Identifier la source

**Symptôme** : modifier l'objectif hebdomadaire changeait automatiquement la
cible mensuelle, sans champ mensuel dans le profil.

**Cause racine** : `TripGoalsCard` calculait directement
`weeklySavedGoalGrams * 4`. Le contrat `MobilityProfile` ne portait aucune
valeur mensuelle a persister ; l'interface ne pouvait donc pas faire autrement.

### Corriger

Le contrat partagé porte maintenant `monthlySavedGoalGrams`, avec ses bornes et
une valeur par défaut pour les comptes antérieurs. Le profil presente deux
champs explicites et indépendants, puis le planificateur compare chaque agregat
à la cible de sa période. `PUT /api/me/profile` persiste le profil entier :
aucune route ou table supplémentaire n'est nécessaire.

**Ou le voir** : `src/contracts/profile.ts`,
`src/components/profile/ProfilePanels.tsx`,
`src/components/planner/trips/TripGoalsCard.tsx`

**Commit** : [`23c028a`](https://github.com/Vitrixxl/t6/commit/23c028a)

### Tester et valider le correctif

Le test de contrat fixe deux valeurs volontairement non proportionnelles et
vérifie leurs bornes indépendamment. Le test d'intégration API remplace ensuite
le profil avec un objectif mensuel, le relit et exige la même valeur. Enfin, la
recette navigateur a enregistré 2 300 g par semaine et 11 500 g par mois, puis
a confirmé leur conservation après rechargement.

Le test automatise a été ajoute avec le champ et n'a pas été vu rouge avant sa
première implémentation.

**Niveau de verrouillage** : **faible** (contrat et persistance automatises,
recette visuelle manuelle, protocole rouge-puis-vert initial non observe).

---

## B26 — Chaque option inventait sa propre référence voiture

**Criticité** : majeur — deux alternatives entre le même départ et la même
arrivée n'étaient pas comparées au même scénario, donc l'indicateur central de
la fonctionnalité carbone pouvait favoriser artificiellement l'option la plus
longue.

### Identifier la source

Le défaut a été trouve en expliquant la formule pendant la revue du moteur.
`summarizeLegs` calculait la référence comme `distance de l'option x 180`, puis
soustrayait l'empreinte de cette option. Une option de cinq kilomètres recevait
donc une voiture fictive de cinq kilomètres, même si la route automobile entre
les extrémités n'en faisait que trois.

**Symptôme** : deux options allant au même endroit affichaient des références
voiture différentes, proportionnelles a leurs propres detours. Une option plus
longue pouvait annoncer davantage de CO2 évité uniquement parce que sa voiture
de comparaison avait été rallongee avec elle.

**Cause racine** : la comparaison contrefactuelle était calculée dans
`summarizeLegs`, fonction qui ne connaît que les segments de l'alternative.
Elle ne disposait ni des extrémités globales de la recherche ni d'une mesure
automobile. Le `Math.max(..., 0)` masquait en plus tout résultat négatif.

### Corriger

La voiture reste hors de `MobilityMode` et n'apparaît jamais dans les options
ou les préférences. `car` n'existe que dans `RoutableMode` et pointe vers le
profil OSRM `driving`. Au lancement d'une recherche, une matrice `1 x 1`
mesure la distance voiture en parallèle du choix des accès. Après le routage de
toutes les alternatives, `applyCarbonReference` leur applique le même objet
`CarbonReference` : distance, empreinte et version du facteur.

Le facteur est fige a 142 gCO2e/passager-km pour une voiture thermique moyenne
diesel, une personne, modélisation ADEME 2025. Les transports publics utilisent
désormais le facteur de leur `route_type` GTFS : 3,8 pour le tramway, 4,2 pour
le métro, et le funiculaire reprend explicitement le métro par approximation.

Une économie négative est conservée et affichée en émissions supplémentaires.
Si le profil voiture echoue, l'empreinte propre des options reste visible,
`carbonSavedGrams` vaut `null` dans le contrat et en base, et l'interface dit
« Comparaison voiture indisponible ».

**Ou le voir** : `src/queries/routes.ts`,
`src/lib/planner/emissions.ts`, `src/lib/planner/legs.ts`,
`server/src/services/routing/osrm.ts`, `server/drizzle/0003_reference-carbone-nullable.sql`

**Commit** : [`a25171e`](https://github.com/Vitrixxl/t6/commit/a25171e)

### Tester et valider le correctif

Les tests couvrent la cause plutôt qu'un seul affichage :

1. une route voiture de 3 km produit exactement `3 x 142 = 426 gCO2e` ;
2. des options de 2 et 5 km partagent le même objet de référence ; la seconde,
   a 500 gCO2e, conserve `426 - 500 = -74 gCO2e` ;
3. la comparaison est appliquée après le remplacement de l'estimation de 2 km
   par une mesure OSRM de 5 km ;
4. une panne voiture rend `null`, jamais zéro ;
5. le test API exige `/routed-car/table/v1/driving/`, puis vérifie qu'un second
   appel ressort du cache partagé sans nouvel appel amont ;
6. le contrat interdit toujours `car` dans les modes proposes et la migration
   persiste bien une comparaison absente.

La recette navigateur a affiché, pour le même trajet, une empreinte piétonne de
`0 gCO₂e` et `564 gCO₂e evites` issus de la référence routière. Le scénario E2E
reste vert a 8/8 et axe-core ne detecte aucune violation sur les quatre écrans.

Ces tests ont été ajoutés avec la correction et n'ont pas été observes rouges
sur la version initiale.

**Niveau de verrouillage** : **faible** (régressions automatisées et recette
navigateur, protocole rouge-puis-vert initial non observe).

---

## B27 — Modifier un élément reecrivait toute sa collection

**Criticité** : majeur — une vue locale périmée pouvait effacer silencieusement
des trajets crees depuis un autre appareil, et une coupure entre deux requêtes
pouvait laisser un trajet terminé sans son entrée carbone.

### Identifier la source

Le défaut est apparu pendant la revue du dépôt `trip-records.ts` :
`replaceAll` supprimait toutes les lignes de l'utilisateur, puis reinserait la
liste fournie par le navigateur. La même forme existait dans les quatre dépôts
de collections et remontait jusqu'à une mutation React Query générique.

**Symptôme** : enregistrer, annuler ou supprimer un seul élément envoyait une
liste complète. Si deux appareils partaient de vues différentes, le dernier
PUT gagnait à l'échelle de la collection et supprimait les lignes absentes de
son cache. Marquer un trajet fait envoyait en plus deux PUT indépendants : un
pour le trajet, un pour l'historique.

**Cause racine** : l'idempotence avait été conçue autour du remplacement de
liste plutôt qu'autour de l'identité des ressources. Le client était donc
traite comme l'autorité sur une collection qu'il ne pouvait connaître qu'a un
instant donne.

### Corriger

Les collections restent lisibles par GET, mais chaque trajet programmé,
routine et itinéraire sauvegarde possède maintenant un
`PUT /api/.../:id` et un `DELETE /api/.../:id`. Les dépôts exposent
`findById`, `upsert` et `deleteById` sur la clé composée utilisateur/id ; aucun
d'eux ne reçoit une collection complète. Les limites de conservation retirent
uniquement les lignes excedentaires.

La complétion passe par
`PUT /api/trips/planned/:id/completion`. Le service termine le trajet et crée
son `TripRecord` dans une seule transaction SQLite ; le rejeu rend le même
état sans doublon. Chaque fichier React Query porte directement la lecture et
les commandes de sa ressource : il n'existe plus d'orchestrateur générique
capable de modifier une partie arbitraire du compte. Après un succès, seule la
réponse du serveur est appliquée aux caches concernés ; Eden Treaty n'envoie
que la ressource ciblée. Seul
`DELETE /api/trips/history`, déclenche par le bouton d'effacement explicite,
supprime volontairement tout l'historique.

**Ou le voir** : `server/src/routes/planned-trips.ts`,
`server/src/services/planned-trips.ts`,
`server/src/repositories/planned-trips.ts`, `src/queries/planned-trips.ts`,
`src/lib/api/planned-trips.ts`

**Commit** : [`e32f643`](https://github.com/Vitrixxl/t6/commit/e32f643)

**Simplification du flux client** :
[`8d2257b`](https://github.com/Vitrixxl/t6/commit/8d2257b)

### Tester et valider le correctif

Les tests d'API prouvent qu'un second PUT conserve le premier élément, qu'un
DELETE conserve sa voisine et les autres collections, et reproduisent ces
garanties pour les routines et les itinéraires enregistrés. Ils verifient
aussi le rejeu de la complétion, l'unicite de l'historique, le 404 sans trajet
source et l'impossibilite d'injecter directement un statut `done`.

Les tests du client inspectent les requêtes réelles produites par Eden : corps
unitaire sans `id` ni `userId`, identifiant dans l'URL, un seul endpoint de
complétion, DELETE explicites et sérialisation des commandes en rafale. Un
refus invalide uniquement la vue concernée.

Ces tests ont été ajoutés avec le refactoring et n'ont pas été observes rouges
sur une reproduction isolée avant la correction.

**Niveau de verrouillage** : **faible** (régressions automatisées et scénario
E2E adapte, protocole rouge-puis-vert initial non observe).

---

## B28 — L'action des objectifs n'indiquait pas ce qu'elle modifiait

**Criticité** : faible — la carte Objectifs ne contenait qu'un bouton
« Modifier ». Dans un planificateur qui permet aussi de modifier le profil et
les trajets, l'objet de cette action devait être devine.

### Identifier la source

**Symptôme** : dans l'en-tête « Objectifs », l'action secondaire affichait le
seul mot « Modifier », sans nom accessible plus précis.

**Cause racine** : le libellé avait été raccourci pour tenir dans la carte,
alors que l'espace disponible permettait de nommer directement la ressource.

### Corriger

Le bouton porte désormais le texte visible et le nom accessible « Modifier les
objectifs ». L'action, son objet et le formulaire qui s'ouvre utilisent ainsi
le même vocabulaire.

**Ou le voir** : `src/components/planner/trips/TripGoalsCard.tsx`

**Commit** : [`8d2257b`](https://github.com/Vitrixxl/t6/commit/8d2257b)

### Tester et valider le correctif

Le scénario navigateur ouvre le planificateur après avoir programmé un trajet,
puis cherche exactement un bouton accessible nommé « Modifier les objectifs ».
Le test echoue si le libellé redevient vague ou si l'action disparaît. Une
capture en vue mobile a aussi confirmé que le texte tient dans l'en-tête.

Le contrôle a été ajoute avec le correctif et n'a pas été observé rouge avant
sa première implémentation.

**Niveau de verrouillage** : **faible** (contrôle E2E bloquant et recette
visuelle, protocole rouge-puis-vert initial non observe).

---

## B29 — Le tutoriel mobile sautait les fonctions de l'application

**Criticité** : majeur — lors d'une première visite sur téléphone, le guide
passait de la recherche à la fin sans montrer la carte, les couches, les
trajets, les objectifs ni le profil.

### Identifier la source

**Symptôme** : après l'écran d'accueil et la recherche, « Suivant » arrivait
presque immédiatement sur « C'est tout ! ». Les rares explications pouvaient en
plus se superposer au contrôle désigné sur un petit écran.

**Cause racine** : une liste unique d'étapes ciblait surtout les panneaux du
shell desktop. Le mécanisme sautait correctement une cible absente, mais sur
mobile presque toutes les cibles l'étaient. La règle de placement centrait
aussi la bulle sur toute cible large, y compris la barre de recherche mobile.

### Corriger

Le desktop conserve ses onze étapes. Le mobile possède maintenant un parcours
de neuf étapes qui cible les contrôles réellement rendus : recherche, carte,
position, proximité, couches, trajets/objectifs et profil. Les boutons de la
barre d'actions ainsi que leurs équivalents dans la feuille d'itinéraire
portent des cibles mobiles explicites.

La bulle mobile mesure l'espace disponible et se place sous une cible haute ou
au-dessus d'une cible basse. Sà largeur est bornée par celle du viewport. La
clé de première visite passe en version 2 afin que les utilisateurs ayant déjà
vu le parcours incomplet reçoivent le parcours corrigé.

**Ou le voir** : `src/components/tutorial/TutorialOverlay.tsx`,
`src/components/planner/MobileQuickPanels.tsx`,
`src/components/app/MobilityLayouts.tsx`, `scripts/e2e-planning.mjs`

**Commit** : [`d3ac1b0`](https://github.com/Vitrixxl/t6/commit/d3ac1b0)

### Tester et valider le correctif

Le scénario E2E a d'abord été étendu avec les neuf titres et les sept cibles
attendus. Son premier passage rouge s'est arrête sur
`la cible mobile-search n'est pas visible`. Après correction, il parcourt les
neuf étapes, vérifie que chaque cible existe et calcule l'intersection entre la
bulle et chaque contrôle : toute superposition fait échouer le test.

La recette visuelle en 390 x 844 confirme que la carte reste lisible et que le
bouton « Trajets et objectifs » est seul dans le spotlight. Le scénario complet
termine ensuite la planification, la complétion et la déconnexion en 8/8.

**Niveau de verrouillage** : **automatisé** (E2E écrit et observé rouge avant
le correctif, puis vert ; captures mobiles de contrôle).

---

## B30 — Les textes français perdaient leurs accents

**Criticité** : mineur — défaut rédactionnel visible dans les écrans, les
messages de l’API et les supports présentés au jury.

### Identifier la source

**Symptôme** : l’interface affichait notamment « Velo », « Enregistre »,
« Ou vas-tu ? » et « CO₂e evite ». Les commentaires et les descriptions
OpenAPI reprenaient le même français sans accents.

**Cause racine** : une ancienne consigne imposait l’ASCII dans les commentaires
et les messages Git. Cette habitude s’était propagée aux textes du produit,
alors que les fichiers et les pages étaient déjà encodés en UTF-8.

### Corriger

Les textes d’interface, les messages d’erreur, les commentaires et les documents
maintenus utilisent les accents français. `AGENTS.md` demande désormais de les
conserver. Les identifiants, paramètres HTTP, chemins et migrations historiques
gardent leur orthographe technique ; le dossier PDF gelé reste inchangé.

**Où le voir** : `src/components/tutorial/TutorialOverlay.tsx`,
`src/components/profile/ProfilePanels.tsx`, `src/components/planner/SearchPanels.tsx`,
`server/src/services/routing/instructions.ts`, `AGENTS.md`.

**Commit** : [`3f7fa7a`](https://github.com/Vitrixxl/t6/commit/3f7fa7a)

### Tester et valider le correctif

`bun run check` passe avec 170 tests. Les sélecteurs du scénario navigateur
suivent les nouveaux libellés : tutoriel, recherche, planification, complétion
et déconnexion passent en 8/8. L’audit axe-core ne relève aucune violation sur
ses quatre écrans. Une lecture dans le navigateur confirme les accents sur
l’authentification et le profil ; les captures du parcours mobile couvrent le
tutoriel, les options et la planification.

La validation a aussi détecté une substitution indue dans le paramètre OSRM
`geometries`. Elle a été corrigée avant livraison et le test de routage existant
vérifie désormais explicitement sa valeur `geojson`.

**Niveau de verrouillage** : **faible** pour la qualité rédactionnelle globale
(relecture et recette visuelle). Les assertions E2E et le contrat de l’appel
OSRM sont automatisés, mais ils ne constituent pas un correcteur orthographique.

---

## B31 — La CI appelait un script Bun inexistant après la passe rédactionnelle

**Symptôme** : la [CI du 4 septembre](https://github.com/Vitrixxl/t6/actions/runs/33926099505)
s'arrêtait avec `Script not found "seed:démo"`, après les 178 tests et le build,
avant les contrôles navigateur.

**Cause racine** : la correction des accents avait touché un identifiant
exécutable dans le YAML, hors du périmètre vérifié par `bun run check`.
Le script déclaré dans `package.json` s'appelle `seed:demo`.

**Correctif** : restaurer `bun run seed:demo` dans le workflow et le conseil
de dépannage E2E. Préciser dans `AGENTS.md` que les corrections rédactionnelles
ne modifient jamais les commandes, chemins, clés ni paramètres techniques.

**Commit** : [`709e1c9`](https://github.com/Vitrixxl/t6/commit/709e1c9).

**Où le voir** : `.github/workflows/ci.yml`, `scripts/e2e-planning.mjs`, `package.json`.

**Test du correctif** : exécution réussie de `bun run seed:demo` sur une base
temporaire ; vérification que chacun des sept scripts appelés par le workflow
existe dans `package.json`. Comparaison des blocs `run` du YAML avec la version
antérieure à la passe : ils sont identiques. La CI complète est relancée au push.

**Niveau de verrouillage** : **faible** en local (contrôle ponctuel, sans nouveau
test permanent). L'exécution du script reste bloquante dans la CI ; les tests
unitaires seuls ne vérifient pas les commandes du workflow.

---

## B32 — Le planificateur débordait horizontalement sur mobile

**Symptôme observé** : sur la capture mobile, les chiffres des objectifs,
la quatrième section et les actions à droite des trajets étaient coupés.

**Cause racine** : les grilles et les cartes conservaient une largeur minimale
imposée par leur contenu. Le long bouton ne revenait pas à la ligne, les
quatre onglets restaient sur une seule rangée et un libellé long pouvait
repousser la pastille de pause hors de la carte. Masquer le débordement du
dialogue dissimulait les contrôles au lieu d’adapter leur disposition.

**Correctif** : colonnes réductibles et cartes bornées, bouton multilignes,
onglets sur deux colonnes sur mobile, chiffres et actions capables de revenir
à la ligne, séparation du titre tronqué et de la pastille de pause.

**Commit** : [b73ffd7 — hub mobile et annulations](https://github.com/Vitrixxl/t6/commit/b73ffd7cc82a0e369b2c7b2bea5af2c6ba992a4c).

**Où le montrer** : `src/components/planner/trips/TripsHubDialog.tsx`,
`TripGoalsCard.tsx` et `lists/{UpcomingList,RecurringList,SavedList,HistoryList}.tsx`
dans le même dossier ; captures dans `tmp/screenshots/trips-*-mobile.png`.

**Test du correctif** : `bun run e2e:trips` ouvre chaque onglet dans Chromium
à 320, 390, 540, 768 et 1280 px, avec des noms et adresses longs. Il compare
les limites des éléments à celles du dialogue. Ce contrôle a échoué à 320 px
sur les grilles, puis sur la pastille de pause, pendant le correctif ; il passe
après correction. Les captures ont également été relues. Le scénario existant
`bun run e2e` reste vert (8/8), axe-core détecte zéro violation sur quatre écrans.

**Niveau de verrouillage** : **automatisé** pour les débordements mesurés dans
ces vingt configurations ; **faible** pour l’appréciation visuelle et les
tailles non parcourues par le scénario.

---

## B33 — Un passage récurrent non effectué restait compté dans le bilan CO₂e

**Symptôme observé** : l’utilisateur ne pouvait pas retirer un aller ou un
retour non effectué des économies et émissions calculées automatiquement.
L’historique ne montrait que les ponctuels marqués faits ; un ponctuel passé
non confirmé ou annulé en disparaissait. Annuler un ponctuel déjà fait via
son remplacement pouvait laisser sa contribution dans l’historique carbone.

**Cause racine** : aucun contrat ni stockage ne représentait une exception
par date et sens. Le comptage ne regardait que les périodes d’activité, et
l’historique filtrait sur `status === 'done'`. La mise à jour du statut et le
retrait de l’enregistrement carbone n’étaient pas une transition atomique.
Enfin, une date civile devait être interprétée dans le même fuseau côté
serveur et côté navigateur pour désigner le même passage.

**Correctif** : quatre onglets Une fois, Récurrents, Historique et Enregistrés.
Les récurrences restent automatiques, sans action Fait/Annuler sur leur fiche.
L’historique rapproche les ponctuels passés et les journées récurrentes ; il
propose Annuler l’aller, Annuler le retour ou Annuler les deux pour les seuls
passages échus. `cancelledPassages` conserve les exceptions `(date, direction)`
sans matérialiser les occurrences. Le fuseau est enregistré avec la routine
(Europe/Paris pour les anciennes données lors de la migration).

Le PUT d’annulation ajoute atomiquement les sens choisis sans perdre les
exceptions précédentes. Tous les agrégats retirent seulement les passages
annulés, en conservant les références carbone négatives ou indisponibles.
Annuler un ponctuel, même terminé, conserve sa trace et retire sa contribution
carbone dans une transaction. Le cache applique la réponse serveur ; un refus
est affiché et provoque une relecture des ressources concernées.

**Commit** : [b73ffd7 — annulations persistées par sens](https://github.com/Vitrixxl/t6/commit/b73ffd7cc82a0e369b2c7b2bea5af2c6ba992a4c).

**Où le montrer** : `src/contracts/trips.ts`,
`server/drizzle/0004_annulations-par-sens.sql`,
`server/src/services/{recurring-trips,planned-trips}.ts`,
`src/lib/trips/{routines,calendar,history}.ts`,
`src/queries/{recurring-trips,planned-trips}.ts` et
`src/components/planner/trips/lists/HistoryList.tsx`.

**Test du correctif** :

- `src/lib/trips/history.test.ts` vérifie chaque combinaison de sens, les
  journées voisines, les pauses, les passages futurs, le calendrier dans le
  fuseau enregistré, les changements d’heure et les agrégats semaine/mois.
- `server/src/__tests__/cancellations.test.ts` vérifie la persistance en base,
  le rejeu sans doublon, la conservation des autres dates et des exceptions
  lors d’un PUT ultérieur, l’isolation des comptes, les refus et l’atomicité.
- `src/queries/account.test.ts` vérifie les corps envoyés par Eden, la mise à
  jour du bilan depuis l’état initial et l’affichage des écritures refusées.
- `bun run e2e:trips` annule séparément l’aller et le retour, recharge la page,
  annule un ponctuel fait, puis utilise le bouton Annuler les deux sur une
  seconde routine. Les données relues par GET doivent correspondre aux actions.

Ces tests ont été ajoutés avec le correctif. Une réintroduction contrôlée du
comptage sans exceptions produit **cinq échecs** ; supprimer le retrait du
carbone lors d’une annulation ponctuelle produit **un échec API**. Les fichiers
corrigés ont été restaurés et les suites repassent. Vérification complète :
**191 tests verts dans 21 fichiers** (136 client/métier, 55 API), lint et typage
strict verts, build produit, E2E historique et planification verts.
Après intégration des huit tests OSRM présents sur `main`, la suite fusionnée
compte **199 tests verts** (136 client/métier, 63 API), toujours dans 21 fichiers.

**Niveau de verrouillage** : **automatisé** pour les règles, la persistance et
les parcours contrôlés ; **faible** pour les détails purement visuels.

---

## B34 — Un trajet de plus d’une heure s’affichait « 63 min »

**Symptôme observé** : sur le trajet vers le 26 rue de Gerland, le choix à pied
annonçait « 63 min », y compris dans sa fiche et ses étapes.

**Cause racine** : les vues concaténaient directement la durée numérique avec
« min » ; aucun format partagé ne convertissait les durées longues en heures.

**Correctif** : `formatDuration` arrondit les minutes puis affiche `1h03` dès
une heure. Les choix mobile et bureau, détails, étapes, planification et listes
de trajets utilisent ce format. Les contrats conservent les minutes numériques.

**Commit** : [34ee6e1 — options complètes et panneau mobile](https://github.com/Vitrixxl/t6/commit/34ee6e1).

**Où le montrer** : `src/lib/duration.ts`,
`src/components/planner/{MobilePanels,RoutePanels,RouteSteps}.tsx` ; capture
`tmp/screenshots/routes-gerland-390.png`.

**Test du correctif** : `src/lib/duration.test.ts` couvre 0, 33, 59, 59,5, 60,
63, 120 et 125 minutes. `MobilePanels.test.tsx` exige `1h03` et refuse `63 min`
dans le rendu des choix. Recette Chromium du trajet signalé : `1h03` dans le
choix, la durée et l’étape à pied.

**Niveau de verrouillage** : **automatisé** pour le format et le rendu des
choix ; **faible** pour la vérification visuelle des autres écrans.

---

## B35 — Le choix mobile pouvait masquer des options calculées

**Symptôme observé** : certaines alternatives manquaient au choix mobile,
alors que le moteur sait produire six familles. Le réglage « Marche max »
laissait également apparaître un trajet à pied dépassant la valeur choisie.

**Cause racine** : `MobileRouteChoices` tronquait la liste à quatre entrées
avec `slice(0, 4)`. Indépendamment, la marche maximale ajoutait un avertissement
et une pénalité au score ; son libellé laissait entendre un plafond d’exclusion.

**Correctif** : toutes les options calculables sont rendues et sélectionnables.
Le réglage de marche, son avertissement et sa pénalité sont retirés du profil,
du contrat partagé, du formulaire et du score. `toUserRow` applique le contrat
courant aux profils JSON historiques avant les lectures et exports ; aucune
migration de structure n’est nécessaire. L’OpenAPI générée ne porte plus ce
champ. Les contraintes de disponibilité, desserte, PMR et mesure réelle restent
appliquées ; les préférences influencent le classement et la présélection.

**Commit** : [34ee6e1 — options complètes et panneau mobile](https://github.com/Vitrixxl/t6/commit/34ee6e1).

**Où le montrer** : `src/components/planner/MobilePanels.tsx`,
`src/contracts/profile.ts`, `src/lib/planner/scoring.ts`,
`server/src/repositories/mappers.ts` et `src/components/profile/ProfilePanels.tsx`.

**Test du correctif** : `MobilePanels.test.tsx` rend six choix, dont le dernier
sélectionné ; le test échouerait avec la troncature précédente. Le test métier
conserve une marche de plus d’une heure sans avertissement. Les tests du contrat
et de l’API relisent un ancien profil sans exposer le champ retiré. Vérification
de l’OpenAPI servie : aucun `maxWalkMinutes`. Recette Chromium complémentaire
sur six options de test, à 320 et 390 px : chaque bouton sélectionne son option
(captures `tmp/screenshots/routes-six-*.png`, données de présentation simulées).

**Niveau de verrouillage** : **automatisé** pour la liste, le contrat, l’API et
la marche longue ; **faible** pour la lisibilité vérifiée sur captures.

---

## B36 — La taille du panneau mobile était difficile à régler

**Symptôme observé** : il était difficile de comprendre comment agrandir ou
réduire le panneau de résultats, notamment au toucher.

**Cause racine** : une petite poignée muette portait seule les interactions.
Les hauteurs maximales du panneau et de son contenu étaient calculées séparément,
sans réserver correctement l’espace de la poignée et de la zone sûre du téléphone.
La poignée traitait les événements pointeur et clavier sans clic natif.

**Correctif** : trois boutons nommés Carte, Aperçu et Détails choisissent
respectivement 30 %, 54 % et 82 % de la hauteur visible. Les commandes d’au moins
44 px restent hors du contenu défilant. Une colonne flex répartit la hauteur
entre commandes, contenu et zone sûre. Le glissement reste disponible ; le clic
natif couvre aussi les activations clavier et lecteur d’écran, sans double
changement après un glissement. Le mouvement respecte la préférence de réduction
des animations. Les quatre mesures du détail passent sur deux colonnes : le
libellé « indisponible » débordait des colonnes trop étroites à 320 px.

**Commit** : [34ee6e1 — options complètes et panneau mobile](https://github.com/Vitrixxl/t6/commit/34ee6e1).

**Évolution** : ce premier correctif a été remplacé par la hauteur automatique
demandée ensuite (B42). Les contrôles et leur hook ont été supprimés. Le rendu
courant se montre dans `src/components/planner/MobilePanels.tsx`.

**Test du correctif** : le scénario `bun run e2e` contrôle les trois hauteurs
réelles et les cibles tactiles à 320 et 390 px. Il vérifie les commandes après
défilement, les flèches et Entrée au clavier, le glissement vers le bas et la
sélection des options, puis planifie et termine le trajet. Les captures du
panneau agrandi et réduit sont relues. Vérification complète : 203 tests verts
(139 client/métier, 64 API) dans 23 fichiers, lint et typage strict verts, build
produit, planification 9/9 et parcours historique/annulations verts.

**Niveau de verrouillage** : **automatisé** pour les hauteurs, les cibles et
les interactions exercées par l’E2E ; **faible** pour l’appréciation visuelle,
les gestes et appareils non parcourus et le lecteur d’écran réel.

---

## B37 — MapLibre ne pouvait pas cadrer le trajet sur un petit écran

**Symptôme observé** : la console affichait « Map cannot fit within canvas with
the given bounds, padding, and/or offset. » lors du cadrage de l’itinéraire.

**Cause racine** : les marges mobiles fixes réservaient 140 px en haut et
300 px en bas, indépendamment de la hauteur réelle du canvas. En paysage sur
844 × 390 px, elles dépassaient la surface disponible. Un changement de taille
sans nouvelle sélection ne recalculait pas non plus le cadrage.

**Correctif** : `routeViewportPadding` conserve au moins un tiers de hauteur
et la moitié de largeur pour le trajet. `UrbanMap` calcule ses marges depuis
le conteneur, ignore les dimensions nulles et recadre après un redimensionnement.

**Commit** : [98b373f — cadrage et image Docker](https://github.com/Vitrixxl/t6/commit/98b373f).

**Où le montrer** : `src/components/map/viewport.ts`, `UrbanMap.tsx` et
`scripts/e2e-planning.mjs`.

**Test du correctif** : deux tests couvrent les marges habituelles, le paysage,
les canvas réduits et le cas 1 × 1 px. Le parcours E2E tourne l’écran à
844 × 390, sélectionne une option et échoue si la console émet cet avertissement.
La même rotation a été vérifiée dans Chromium sur l’image Docker reconstruite,
sans erreur de cadrage. Capture : `tmp/screenshots/container-map-landscape.png`.

**Niveau de verrouillage** : **automatisé** pour les marges et le parcours de
rotation ; **faible** pour l’appréciation visuelle des cadrages non parcourus.

---

## B38 — Le certificat local empêchait l’activation du service worker

**Symptôme observé** : la page HTTPS s’ouvrait, mais Chromium refusait
`/sw.js` avec une `SecurityError` et « An SSL certificate error occurred ».

**Cause racine** : le conteneur présentait un certificat auto-signé absent de
la base de confiance du navigateur. Accepter l’avertissement de navigation ne
rendait pas le certificat fiable pour l’enregistrement du service worker.

**Correctif** : import du certificat public de ce serveur local dans la base
NSS du compte Linux, avec les attributs `P,,` (certificat serveur de confiance,
sans lui donner le rôle d’autorité). Procédure documentée dans le README selon
la documentation officielle Chromium. Ni la vérification TLS ni le service
worker ne sont désactivés ; aucune clé privée n’entre dans le dépôt.

**Commit** : [98b373f — cadrage et image Docker](https://github.com/Vitrixxl/t6/commit/98b373f).

**Où le montrer** : `README.md`, section « Certificat local et service worker »,
et panneau Application / Service workers de Chromium sur `https://localhost:4000`.

**Test du correctif** : lancement d’un nouveau Chromium sans option d’ignorance
des erreurs TLS ; navigation HTTPS puis enregistrement de `/sw.js` : état
`activated`, aucune erreur SSL. Contrôle répété après mise à jour du conteneur.
La confiance reste locale au poste ; un autre appareil doit reconnaître son
certificat. Une fenêtre déjà ouverte peut nécessiter un redémarrage du navigateur.

**Niveau de verrouillage** : **faible** : correction d’environnement vérifiée
ponctuellement, non installée automatiquement par le dépôt et propre au poste.

---

## B39 — L’image Docker n’embarquait plus les modules partagés requis par l’API

**Symptôme observé** : le conteneur consulté sur le port 4000 servait toujours
l’ancienne interface, limitée à quatre choix. En préparant sa reconstruction,
le Dockerfile ne copiait que `src/types.ts` alors que le serveur courant charge
les contrats et les règles calendaires depuis `src/`.

**Cause racine** : la liste de fichiers copiés dans l’image d’exécution n’avait
pas suivi les dépendances partagées introduites dans l’API. Une modification de
`main` local ne remplace pas une image déjà démarrée.

**Correctif** : copie explicite des contrats et des modules `calendar.ts` et
`routines.ts` dans l’image. Les worktrees locaux sont exclus du contexte Docker.
Construction et démarrage d’un conteneur candidat sur une copie de la base,
puis remplacement du conteneur `urbanflow` avec les mêmes volumes `/data` et
`/certs`. L’ancien conteneur arrêté et deux sauvegardes SQLite cohérentes sont
conservés pour la reprise.

Les migrations existantes adoptent la base et gardent le compte, les sessions,
la routine et l’historique. Les huit anciennes occurrences planifiées de la
routine disparaissent conformément à la migration 0002 : leurs passages sont
désormais calculés à la lecture. Le trajet ponctuel est conservé.

**Commit** : [98b373f — cadrage et image Docker](https://github.com/Vitrixxl/t6/commit/98b373f).

**Où le montrer** : `infra/api.Dockerfile`, `.dockerignore`, `README.md` et
`server/drizzle/0002_routines-a-la-volee.sql`.

**Test du correctif** : `docker build -f infra/api.Dockerfile` réussit. Dans un
conteneur jetable, retirer les contrats reproduit « Cannot find module
'../../../src/contracts/index.ts' ». L’image complète démarre, applique les
migrations et sert `/api/health`. Chromium affiche les nouvelles commandes de
panneau, active le service worker et passe du portrait au paysage sans erreur.
Les états de compte issus de la copie migrée passent le contrat `accountState`.

**Niveau de verrouillage** : **faible** pour la composition de l’image et le
déploiement (recette Docker ponctuelle) ; les règles de migration et de compte
restent couvertes par la suite API. Validation courante : 205 tests verts
(141 client/métier, 64 API) dans 24 fichiers ; lint, typage, build et E2E 9/9 verts.


---

## B40 — Une coupure Internet ne précisait pas les fonctionnalités indisponibles

**Symptôme observé** : couper le réseau sur l’écran de connexion ou de carte
ne faisait apparaître aucun avertissement global. La page de secours annonçait
que l’application restait disponible ; les données de transport de secours
étaient étiquetées « Mode hors ligne », même lors d’une simple panne de flux.

**Cause racine** : aucun composant commun ne suivait la connexion du navigateur.
Les messages dépendaient d’une requête échouée ou du choix d’une source de données,
sans expliciter la dépendance des recherches et des modifications à Internet.

**Correctif** : `OfflineBanner`, monté dans `App` avant `AppContent`, utilise
`useOnlineStatus` et les événements `online`/`offline`. Le message demandé apparaît
sur mobile et bureau, y compris pendant le chargement et l’authentification,
puis disparaît au retour réseau. Une région `status` persistante annonce les
changements sans déplacer le focus. Le bandeau occupe sa propre place au-dessus
du contenu. La page de secours et le libellé des disponibilités sont alignés.
Une erreur API seule ne déclenche pas l’avertissement hors ligne.

**Commit** : [c35a007 — signaler la perte de connexion](https://github.com/Vitrixxl/t6/commit/c35a007af2f76a41d1ada1ec06e2117ebb3dad99).

**Où le montrer** : `src/App.tsx`, `src/components/app/OfflineBanner.tsx`,
`src/components/app/hooks/useOnlineStatus.ts`, `public/offline.html`,
`src/components/layout/Shell.tsx` et `scripts/e2e-offline.mjs`.

**Test du correctif** : `bun run e2e:offline` a échoué avant la correction
sur l’absence du bandeau après une coupure réelle de Chromium à 320 px.
Après correction, il vérifie le texte, la place réservée, l’apparition et le
retrait sur les écrans de connexion et de carte à 320, 390 et 1280 px, ainsi
que la carte en paysage 844 × 390. Il recharge le socle en cache hors ligne
(service worker de production actif) et distingue une réponse API 503 d’une
coupure Internet. Captures relues : `tmp/screenshots/offline-*.png`.
`bun run check` passe : 205 tests, 24 fichiers, lint, typage et build verts.
`bun run e2e` passe ses 9 assertions jusqu’à la complétion et la déconnexion.

**Niveau de verrouillage** : **automatisé** pour les transitions et les cas
exercés dans Chromium ; **faible** pour la lisibilité et l’annonce effective
par un lecteur d’écran. Le signal du navigateur ne mesure pas la disponibilité
réelle d’Internet ou du serveur, notamment sur un réseau local sans accès extérieur.

## B41 — Seule la marche restait proposée après un échec de matrice

**Symptôme observé** : la recherche entre la rue Mazenod et la rue Cuvier ne
proposait plus que la marche ; `POST /api/route-matrix` répondait 503.

**Cause racine** : le conteneur utilisait les URL OSRM publiques par défaut.
Le service amont a répondu 429 avec « Bandwidth limit exceeded » : chaque
cellule de matrice compte dans le quota, donc la cadence d’une requête HTTP par
seconde ne suffit pas. La matrice piétonne croisée calculait aussi les trajets
entre stations, inutilisés. Sans accès mesurés, le moteur écartait les modes
partagés et les transports ; seul le trajet direct restait calculable.
Le script local bloquait en outre sur `/opt/bike.lua`, absent de l’image OSRM.

**Correctif** : préparation et branchement des trois moteurs OSRM locaux sur
le réseau Docker de l’application. Deux matrices en étoile mesurent seulement
les accès depuis le départ et vers l’arrivée (36 cellules au lieu de 345 sur
la recherche reproduite). Le prétraitement vélo utilise `bicycle.lua`.
Aucun tracé ni mesure de repli n’est inventé. La disponibilité des véhicules
et la desserte restent nécessaires pour proposer les six familles.

**Commit** : [7a7d72a — routage local et panneau automatique](https://github.com/Vitrixxl/t6/commit/7a7d72a).

**Où le montrer** : `src/lib/planner/access.ts`, `infra/osrm-prepare.sh`,
`infra/compose.yml` et les variables OSRM du conteneur.

**Test du correctif** : `src/lib/planner/access.test.ts` vérifie la forme des
matrices et le choix de la station la plus rapide. Dans Chromium mobile, la
recherche vers le 111 rue Cuvier renvoie six options, toutes les matrices en
200, sans erreur MapLibre ni service worker. Le script local a préparé les
trois profils, puis les moteurs ont servi les mesures et les géométries.

**Niveau de verrouillage** : **automatisé** pour les matrices en étoile ;
**faible** pour la configuration du déploiement et la disponibilité des sources.
Les URL publiques ne conviennent pas à une utilisation multimodale soutenue.

## B42 — Les réglages de taille compliquaient encore le panneau mobile

**Symptôme observé** : les commandes Carte/Aperçu/Détails ajoutées en B36
imposaient encore de choisir une taille pour lire le résultat.

**Cause racine** : trois hauteurs fixes obligeaient l’utilisateur à régler
le panneau alors que le besoin était de voir directement son contenu.

**Correctif** : hauteur automatique, bornée à l’espace disponible sous la
recherche ; seul le contenu long défile. L’en-tête et la fermeture restent
accessibles. La poignée, les sélecteurs et leur hook sont supprimés.

**Commit** : [7a7d72a — routage local et panneau automatique](https://github.com/Vitrixxl/t6/commit/7a7d72a).

**Où le montrer** : `src/components/planner/MobilePanels.tsx`,
`MobileTripPanel` ; `scripts/e2e-planning.mjs`.

**Test du correctif** : E2E planification 9/9, hauteur sous la recherche,
défilement et sélection à 320 et 390 px, rotation en paysage, puis planification
et complétion persistée. Captures relues avec les six options et le détail long.
`bun run check` : 205 tests dans 24 fichiers ; scénario hors ligne réussi.

**Niveau de verrouillage** : **automatisé** pour les limites du panneau,
le défilement et les sélections ; **faible** pour l’appréciation visuelle.
