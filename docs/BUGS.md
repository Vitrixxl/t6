# Journal des bogues

Ce document existe pour une raison precise. La competence **C3.3** est evaluee
lors d'une revue face-a-face ou le candidat doit expliciter et valider trois
pratiques :

- ses pratiques pour **identifier la source** des bogues ;
- ses pratiques de **correction** des bogues ;
- ses pratiques de **test et validation des correctifs**.

Chaque entree ci-dessous suit donc ces trois sections, dans cet ordre. Un
correctif non consigne est un correctif indefendable : ce qui n'est pas ecrit
ici ne peut pas etre montre en revue.

**Regle de verrouillage.** Un correctif n'est declare verrouille que si son test
a ete vu **rouge avant le correctif, puis vert apres**. Un test ecrit apres coup
qui passe du premier coup ne prouve rien : il peut tres bien ne rien couvrir.
La verification rouge-puis-vert est notee dans chaque entree.

---

## B16 — L'objectif hebdomadaire etait calcule sur tout l'historique

**Criticite** : majeur — l'indicateur central de la fonctionnalite F4
(calculateur d'empreinte carbone avec suivi personnel) annonçait un chiffre faux.

### Identifier la source

La recherche est partie d'une hypothese de terrain plutot que d'un signalement :
**les fenetres d'agregation sont un endroit ou les defauts se logent souvent**,
parce que la periode est portee par le libelle et non par le calcul. J'ai donc
relu les fonctions d'agregation en cherchant, pour chacune, ou etait la borne de
temps.

`summarizeCarbon` acceptait un `weeklyGoalGrams` mais sommait **tous** les
enregistrements, sans aucun filtre de date. Restait a savoir si c'etait
volontaire : un cumul de toujours est une quantite legitime. J'ai donc cherche
le libelle affiche a cote, et trouve dans `CarbonPanel` :

> `{summary.goalUsagePercent}% de l'objectif hebdomadaire de ... g`

C'est l'appariement qui tranchait. La confirmation est venue d'un second ecran :
`TripGoalsCard` affiche la meme notion en s'appuyant sur `savedThisWeekGrams`,
lui correctement borne a la semaine par `summarizeTripActivity`.

**Symptome, une fois nomme** : la barre de progression hebdomadaire ne
redescendait jamais le lundi, et deux ecrans annonçaient des chiffres
differents pour la meme notion.

**Cause racine** : aucune des deux fonctions n'etait fausse. `summarizeCarbon`
est un cumul de toujours, `summarizeTripActivity` filtre bien la semaine. Le
defaut etait **l'appariement** d'un total sans borne avec un libelle
hebdomadaire — un defaut qui n'existe dans aucun des deux fichiers, seulement
entre eux.

### Corriger

La fenetre est appliquee **a la source**, dans `summarizeCarbon`, et non dans
chaque ecran : laisser chaque appelant filtrer aurait reproduit le meme defaut
au prochain ecran ajoute.

`startOfWeek` vivait dans `trips/summary.ts`. Le laisser la et l'importer
depuis le suivi carbone aurait couple deux modules sans rapport ; le
reimplementer aurait cree deux definitions du lundi, libres de diverger. Il
part donc dans `src/lib/week.ts`, dont c'est la seule raison d'exister.

Les libelles de `CarbonPanel` deviennent explicites — « Trajets cette semaine »,
« CO2 evite cette semaine » — parce que l'entete porte desormais sur la semaine
alors que l'historique dessous porte sur les cinquante derniers trajets. Deux
periodes sur un meme ecran doivent se dire.

**Ou le voir** : `src/lib/week.ts`, `src/lib/carbon.ts`,
`src/components/carbon/CarbonPanel.tsx`

### Tester et valider le correctif

Trois tests unitaires ecrits **avant** le correctif, sur une fonction pure a
horloge injectee :

1. un trajet de la semaine, un de la semaine precedente : seul le premier compte ;
2. bascule du lundi : le meme trajet compte le dimanche soir, plus le lundi matin ;
3. borne inferieure : un trajet fait lundi a 00:00 est dans la semaine.

Un quatrième test verrouille la cause racine plutot que son symptome : il
construit des trajets planifies, les convertit en enregistrements par le chemin
reel (`plannedTripToRecord`), et exige que **les deux agregats annoncent le meme
CO2 evite**. C'est celui-la qui empeche les deux ecrans de rediverger ; les
trois premiers ne verrouillent que le calcul.

**Validation** : les deux premiers tests vus **rouges** avant le correctif
(`expected 2 to be 1`, `expected 1 to be +0`), **verts** apres. Suite complete
verte : 94 tests unitaires, 37 tests d'API.

**Niveau de verrouillage** : **automatise**.

---

## B17 — Une trottinette proposee sur 416 kilometres

**Criticite** : majeur — la contrainte C6 exige de « garantir la precision et la
fiabilite des donnees de geolocalisation et d'itineraires ». Un itineraire
impossible presente comme une option y contrevient directement.

### Identifier la source

Aucun signalement ne pointait ce defaut : il fallait aller le chercher. J'ai
soumis le moteur a des **entrees aux limites** et verifie des **invariants**
plutot que des valeurs attendues — technique proche du property-based testing.
L'interet est de ne pas avoir a deviner ou est le bogue.

Entrees : origine egale a la destination, destination hors perimetre (Paris),
antipode, profil PMR, covoiturage a un occupant. Invariants controles sur
**toutes** les options rendues : distance et duree finies et positives, CO2
positif, score entre 0 et 100, aucun segment de duree nulle.

Aucun invariant n'a saute. C'est une **comparaison** qui a revele le defaut :
pour Paris, le moteur rendait une option trottinette mais aucune option velo.
Deux modes presque identiques, dont un seul survit a une destination absurde —
cette asymetrie n'a aucune justification metier, et c'est elle qui a designe
l'oubli.

Mesures depuis Bellecour, une fois le soupçon confirme : Vienne 28 km / 2 h,
Grenoble 100 km / 6 h, **Paris 416 km / 23 h / 6233 g**. Au meme moment,
l'application affichait sa propre banniere « hors metropole de Lyon :
velos/trottinettes indisponibles » au-dessus de la liste qui proposait
exactement cela.

**Cause racine** : RG3 — un vehicule partage doit etre a distance de marche —
etait verifiee **aux deux extremites** dans `createBikeOption`, mais
**seulement a l'origine** dans `createScooterOption`. Rien d'autre ne bornait
la course.

Le velo n'etait donc pas protege par une intention, mais **par effet de bord** :
sa seconde verification existe parce qu'un Velo'v se rend a une borne, pas
parce que quelqu'un avait pense au probleme de la distance.

### Corriger

La correction evidente — copier la verification du velo — aurait produit un
second bogue. Le Velo'v est un service **a bornes** : exiger une station a
l'arrivee est legitime. La trottinette est en **flotte libre** : exiger une
trottinette a l'arrivee n'a aucun sens, il n'y en a peut-etre aucune la-bas
justement parce que personne n'y est encore alle.

La regle manquante n'est donc pas la meme. Pour une flotte libre, la contrainte
de fin de trajet est la **zone de service de l'operateur** : au-dela, le
vehicule est immobilise et l'utilisateur penalise. `withinServiceArea` s'appuie
sur le perimetre metropolitain deja utilise par la banniere de couverture, ce
qui les rend d'accord par construction plutot que par coincidence.

**Ou le voir** : `src/lib/planner/geo.ts` (`withinServiceArea`),
`src/lib/planner/options/scooter.ts`

### Tester et valider le correctif

Trois tests ecrits **avant** le correctif :

1. destination hors zone : aucune option trottinette ;
2. destination dans la zone : l'option est toujours la — un correctif qui
   supprimerait le mode passerait le premier test et echouerait celui-ci ;
3. **les deux modes partages sont bornes**, sans qu'aucun ne survive a l'autre.
   C'est le test de la cause racine : il verrouille l'asymetrie elle-meme, la ou
   les deux premiers ne couvrent que la trottinette.

**Validation** : tests 1 et 3 vus **rouges** avant le correctif
(`expected [ 'scooter', 'carpool', 'walk' ] to not include 'scooter'`),
**verts** apres. Puis rejeu de la sonde initiale : Vienne, Grenoble et Paris ne
rendent plus que marche et covoiturage — exactement ce que la banniere annonce —
tandis que Villeurbanne, a 8 km, conserve sa trottinette.

**Niveau de verrouillage** : **automatise**.

---

## B18 — Des trajets deja passes comptes comme a venir

**Criticite** : mineur — aucun calcul faux ni action erronee, mais un compteur
qui ment sur l'ecran principal.

### Identifier la source

Les dates sont un terrain a fort rendement : elles concentrent les cas limites
que personne ne joue a la main. J'ai donc sonde le moteur de recurrence **sans
navigateur**, en injectant une horloge — `syncRecurringOccurrences` et
`summarizeTripActivity` acceptent toutes deux un `now`, ce qui rend chaque
scenario reproductible a la seconde pres.

Quatre situations passees au crible, en une seule sonde :

| Situation | Resultat |
| --- | --- |
| Rejeu de la generation | idempotent, aucun doublon |
| Fenetre a cheval sur le passage a l'heure d'hiver | 08:00 local des deux cotes, correct |
| Trajet fait le dimanche, consulte le lundi | bien rattache a la semaine precedente |
| **Generation a 22 h un mercredi** | **occurrences de 08:00 et 18:00 du jour creees** |

La derniere ligne est le defaut. `upcomingTrips` les renvoyait ensuite comme
« a venir » : a 22 h, la pastille annonçait **2 trajets a venir**, tous deux
passes depuis longtemps.

**Cause racine** : deux decisions raisonnables qui se composent mal.
`syncRecurringOccurrences` parcourt les jours a partir d'aujourd'hui sans jamais
comparer l'heure de l'occurrence a `now`. Et la tolerance de 24 h de
`upcomingTrips` — voulue, pour marquer « fait » en fin de journee un trajet du
matin — **masque** l'erreur au lieu de l'arreter.

Aucune des deux n'est fautive isolement. C'est leur composition qui l'est, ce
qui explique qu'aucune relecture d'un seul fichier ne l'aurait revelee.

### Corriger

Le correctif porte sur la **generation**, pas sur la tolerance. Une occurrence
n'est materialisee que si son heure est encore devant : ce qui n'a jamais existe
n'a pas a naitre dans le passe.

Corriger du cote de `upcomingTrips` aurait ete le reflexe le plus court — c'est
la que le symptome se voit — et aurait casse un comportement voulu : on ne
pourrait plus marquer fait, le soir, le trajet du matin. Le symptome et la cause
n'etaient pas dans le meme fichier.

**Ou le voir** : `src/lib/trips/routines.ts`

### Tester et valider le correctif

Trois tests ecrits **avant** le correctif :

1. generation a 22 h : aucune occurrence du jour, et rien de passe dans la liste
   des trajets a venir ;
2. generation a 07 h : les deux occurrences du jour sont bien creees — un
   correctif qui supprimerait purement les occurrences du jour passerait le
   premier test et echouerait celui-ci ;
3. **non-regression de la tolerance** : une occurrence **deja existante** et
   passee reste listee et marquable le soir. C'est le test qui empeche de
   « corriger » en cassant la grace de 24 h.

**Validation** : premier test vu **rouge** avant le correctif
(`expected [ … ] to have a length of +0 but got 2`), **vert** apres. Puis rejeu
de la sonde initiale : « occurrences du jour deja passees : (aucune) », et
« comptees comme a venir : 0 », l'idempotence et le changement d'heure restant
inchanges.

**Niveau de verrouillage** : **automatise**.

**Devenir** : le moteur de recurrence a ete retire depuis. Une routine
n'engendre plus aucun trajet : ses passages sont comptes a la lecture, entre
sa creation et maintenant, et seuls ceux dont l'heure est passee comptent
(`src/lib/trips/routines.ts`). Le defaut ne peut plus se produire, par
construction ; le test « ne compte pas un passage dont l'heure n'est pas
encore passee » (`src/lib/trips/trips.test.ts`) verrouille la meme propriete
sous sa nouvelle forme.

---

## B19 — La pastille et la fiche annonçaient deux chiffres pour le meme trajet

**Criticite** : majeur — deux mesures contradictoires du meme itineraire, a
quelques centimetres l'une de l'autre sur le meme ecran.

### Identifier la source

Trouve en **relisant une capture d'ecran** produite pour la soutenance, pas en
lisant du code. La pastille de l'option retenue annonçait « Trottinette 11 min
· 2,3 km » et la fiche de detail, juste en dessous, « 21 min · 3,2 km ».

C'est une methode a part entiere : regarder son propre produit avec les yeux de
celui qui va le decouvrir. Le defaut etait la depuis l'introduction du routage
par segment, et aucune relecture de code ne l'avait revele — parce qu'il ne se
voit que lorsque les deux valeurs sont affichees cote a cote.

**Cause racine** : seul l'itineraire selectionne est route segment par segment,
choix delibere qui borne le nombre d'appels au calculateur. `selectedRoute`
recevait donc les mesures reelles, mais la liste qui alimente les pastilles
continuait de porter les estimations a vol d'oiseau. Les deux composants lisaient
deux objets differents pour le meme trajet.

Meme famille que B16 : deux vues d'une meme grandeur, alimentees par des sources
qui ne se parlent pas.

### Corriger

La reconciliation est extraite dans une fonction pure, `applyRoutedSelection`,
plutot que laissee dans le hook : c'est ce qui la rend testable, et le defaut
etait precisement dans la couche non testee.

Les options **non selectionnees** gardent leur estimation. Ce n'est pas un
compromis : elles n'ont pas ete routees, l'estimation est donc la seule mesure
dont on dispose, et l'annoncer est exact.

**Ou le voir** : `src/lib/planner/legs.ts`,
`src/components/app/hooks/useRouteOptions.ts`

### Tester et valider le correctif

Trois tests ecrits **avant** le correctif, la fonction ayant d'abord ete posee
en passe-plat pour obtenir un echec d'assertion plutot qu'une erreur de
compilation :

1. la liste porte les mesures routees de l'option selectionnee ;
2. les autres options restent **identiques par reference** — un correctif qui
   recalculerait tout passerait le premier test et echouerait celui-ci ;
3. sans itineraire route, la liste est rendue inchangee.

**Validation** : premier test vu **rouge** (`expected 14 to be 28`), **vert**
apres. Suite complete : 103 tests unitaires, 37 tests d'API. Capture mobile
regeneree pour verifier que les deux valeurs concordent a l'ecran.

**Niveau de verrouillage** : **automatise**.

---

## B20 — Les chiffres d'une option changeaient selon qu'elle etait selectionnee

**Criticite** : majeur — la liste d'options existe pour comparer, et ses lignes
n'etaient pas comparables entre elles.

### Identifier la source

Signale par l'utilisateur, captures a l'appui : le meme trajet, deux relevés.

| Option | Velo selectionne | Trottinette selectionnee |
| --- | --- | --- |
| Velo | **32 min, 5,0 km** | 26 min, 4,5 km |
| Trottinette | 17 min, 4,0 km | **24 min, 4,8 km** |

Chaque option changeait de valeurs en devenant selectionnee, et y revenait en
cessant de l'etre.

**Cause racine** : pour borner le nombre d'appels au calculateur, un seul
itineraire etait mesure segment par segment — celui affiche. Les autres
restaient sur l'estimation a vol d'oiseau du moteur local. La liste melangeait
donc **deux methodes de mesure**, et comparer 24 minutes mesurees a 31 minutes
estimees n'a aucun sens.

**Ce bogue est ne d'un correctif.** B19 avait corrige la contradiction entre la
pastille et la fiche de detail en faisant remonter la valeur mesuree dans la
liste. La contradiction a disparu de l'ecran de detail pour reapparaitre, sous
une autre forme, dans la comparaison. Une correction qui deplace un defaut au
lieu de le supprimer est une correction incomplete : la vraie question n'etait
pas « quelle valeur afficher ou », mais « pourquoi deux valeurs coexistent ».

### Corriger

Toutes les options sont mesurees, plus seulement celle qu'on regarde. Le calcul
local ne sert qu'a savoir **quelles** options existent ; ses chiffres ne
sortent plus du hook.

Trois consequences assumees :

- le cout passe de trois appels a une quinzaine par recherche. Il est absorbe
  par le cache partage introduit en B13 : les memes trajets ne repartent pas
  chez le calculateur, et une instance auto-hebergee rend la question sans
  objet ;
- une option dont un segment n'a pas pu etre mesure est **ecartee**. La garder
  supposerait de retomber sur son estimation, donc de remettre deux methodes
  dans la meme liste ;
- le classement est refait apres mesure. Le score depend de la duree et du
  carbone : le figer sur l'estimation aurait contredit les chiffres affiches.

L'orchestration est extraite dans `measureRoutes`, fonction pure prenant le
routeur en parametre — c'est ce qui la rend testable, la version precedente
vivant dans un hook React hors de portee des tests.

`applyRoutedSelection`, le correctif de B19, disparait : la structure rend
desormais la contradiction impossible, la pastille et la fiche lisant le meme
objet. Un garde-fou qui ne garde plus rien est du bruit.

**Ou le voir** : `src/lib/planner/index.ts` (`measureRoutes`, `rankRoutes`),
`src/components/app/hooks/useRouteOptions.ts`

### Tester et valider le correctif

Trois tests ecrits **avant** le correctif, la fonction ayant d'abord ete posee
en passe-plat pour obtenir des echecs d'assertion plutot qu'une erreur d'import :

1. **toutes** les options ressortent mesurees, aucune ne reste a l'estimation ;
2. une option dont un segment n'a pas de trace est ecartee — un correctif qui la
   garderait avec son estimation passerait le premier test et echouerait
   celui-ci ;
3. le classement est recalcule sur les mesures : les scores different de ceux de
   l'estimation, et restent ordonnes.

Le routeur de test est un doublon qui double les distances et pose un trace.
La premiere version ne posait pas de trace, et le test echouait pour une raison
etrangere au correctif : un doublon doit se comporter comme la chose qu'il
remplace, sinon il teste autre chose.

**Validation** : les trois vus **rouges** (`expected 2.67 to be close to 5.34`,
`expected [ … ] to have a length of +0 but got 6`, `expected [ 100, 93, … ] to
not deeply equal [ 100, 93, … ]`), **verts** apres. Suite complete : 103 tests
unitaires, 37 tests d'API.

**Niveau de verrouillage** : **automatise**.

---

## B21 — Le service worker servait l'API depuis son cache, y compris apres la deconnexion

**Criticite** : critique — une session revoquee en base restait « vivante »
dans le navigateur, et le compte suivant sur le meme appareil pouvait recevoir
l'etat du precedent.

### Identifier la source

Trouve en verifiant la deconnexion de bout en bout, apres le passage de l'etat
du compte sur des atomes. Le scenario bureau demandait `/api/state` juste apres
la deconnexion et recevait **200**, alors que le journal du serveur montrait,
dans l'ordre, la revocation puis un **401** sur la meme route.

Deux temoins qui se contredisent designent un intermediaire. Rejoue avec
`curl` sans navigateur : connexion, deconnexion, `/api/state` → 401. Le serveur
est donc hors de cause ; il reste, entre la page et lui, le service worker.
`public/sw.js` appliquait « cache d'abord » a **toute** requete GET de meme
origine en 200, `/api/*` compris. Une fois `/api/state` vue une premiere fois,
chaque lecture suivante venait du cache, deconnexion ou non. Le meme mecanisme
pouvait renvoyer `/api/auth/session` en cache au rechargement : la session d'un
compte precedent ressuscitee sur un appareil partage.

La cause est anterieure a l'etat en memoire : elle existait depuis la mise en
place du service worker, masquee tant que le cache local du client faisait
ecran entre l'interface et l'API.

### Corriger

Le service worker laisse passer `/api/*` sans jamais le mettre en cache
(`public/sw.js`, garde en tete du gestionnaire `fetch`). Les reponses de l'API
dependent de la session et changent a chaque action : aucune n'est cachable.
Le socle de l'application et les donnees statiques (GTFS, stations de repli)
restent en cache pour le hors ligne, c'est leur role. Le nom du cache passe en
`v3` pour que les installations existantes jettent le leur a l'activation.

### Tester et valider le correctif

Le scenario `bun run e2e` gagne une septieme assertion, ecrite **avant** le
correctif : apres deconnexion, `/api/state` repond 401 au navigateur et le
rechargement ramene l'ecran de connexion. Un test unitaire ne suffit pas ici,
le comportement fautif est celui du navigateur avec son service worker actif ;
le scenario tourne sur le build de production, ou le service worker est
enregistre.

**Validation** : vu **rouge** avant le correctif (`apres deconnexion,
/api/state repond encore 200 au navigateur`), **vert** apres (`7/7 assertions
passees`), sur un serveur et une base neufs. Le scenario bureau (profil,
objectifs, rechargement, deconnexion) rejoue aussi vert.

**Niveau de verrouillage** : **automatise** (scenario E2E bloquant en CI).

---

## B22 — Une erreur React apparaissait pendant la deconnexion

**Criticite** : moyenne — la session etait bien revoquee, mais la console du
navigateur signalait `Aucune session ouverte.` pendant le retour a l'ecran de
connexion.

### Identifier la source

Le scenario E2E passait ses sept assertions tout en remontant une
`PAGE ERROR` juste apres la purge du compte. `closeSession` publiait d'abord
une session nulle, puis supprimait les requetes et mutations du compte. Entre
ces notifications, un composant encore monte pouvait se rendre, appeler
`useUser` et constater que sa session avait deja disparu.

### Corriger

`closeSession` purge maintenant les mutations et les ressources du compte
avant de publier sa fermeture. Comme React Query regroupe ses notifications,
`useUser` conserve aussi dans une reference de composant sa derniere session
valide : le dernier rendu precedant le demontage reste coherent, sans faire
survivre cette valeur au composant ni a la prochaine connexion.

**Ou le voir** : `src/queries/session.ts` (`closeSession`),
`src/queries/user.ts` (`useUser`)

**Commit** : [`65d2e5b`](https://github.com/Vitrixxl/t6/commit/65d2e5b)

### Tester et valider le correctif

Le test de deconnexion observe la requete de session et verifie qu'au moment
exact ou elle devient nulle, aucune requete de l'ancien compte ne subsiste.
Le scenario `bun run e2e` doit en plus terminer ses 7/7 assertions sans
`PAGE ERROR` dans un vrai navigateur.

**Niveau de verrouillage** : **automatise** (test du cache + scenario E2E).

---

## B23 — Le point d'acces le plus proche n'etait pas toujours le plus rapide

**Criticite** : majeur — un mur, des voies ferrees ou une entree situee de
l'autre cote d'un ilot pouvaient faire choisir une station Velo'v, une
trottinette ou un arret plus long a rejoindre qu'un candidat un peu plus loin.

### Identifier la source

Le defaut a ete trouve en questionnant le choix technique pendant la revue du
moteur : la selection des stations utilisait uniquement la distance Haversine,
alors que la duree affichee ensuite venait d'OSRM. Le moteur optimisait donc une
grandeur differente de celle annoncee a l'utilisateur.

**Symptome** : deux points d'acces proches pouvaient etre classes dans le
mauvais ordre des qu'un obstacle imposait un detour pieton.

**Cause racine** : `nearestStation` et les candidats GTFS decidaient directement
sur la distance a vol d'oiseau. OSRM n'intervenait qu'apres la construction de
l'option, trop tard pour corriger le point d'acces choisi.

### Corriger

Haversine ne prend plus de decision : il borne seulement la recherche a huit
candidats. `POST /api/route-matrix` mesure ensuite, en une requete OSRM Table,
les durees reelles vers ces candidats. Le moteur retient le plus rapide dans la
limite metier, puis construit les options. La marche choisit le profil pieton ;
le rabattement velo et trottinette utilise le profil velo.

Les cellules de la matrice rejoignent le cache SQLite partage de B13 sous des
cles distinctes des geometries. Une geometrie deja connue peut fournir sa
mesure ; une entree expiree peut encore servir si OSRM tombe.

**Ou le voir** : `src/lib/planner/access.ts`,
`server/src/services/routing/index.ts`, `server/src/routes/routing.ts`

**Commit** : [`4c170ad`](https://github.com/Vitrixxl/t6/commit/4c170ad)

### Tester et valider le correctif

`src/lib/planner/access.test.ts` oppose une station plus proche a vol d'oiseau
mais accessible en douze minutes a une station plus eloignee accessible en 110
secondes : la seconde doit gagner. Les tests API verifient qu'une matrice
complete ne produit qu'un appel amont, puis ressort entierement du cache.

Le test de selection a ete ajoute apres la premiere implementation : il
detectera une regression, mais n'a pas ete vu rouge avant le correctif initial.

**Niveau de verrouillage** : **faible** (regression automatisee, protocole
rouge-puis-vert initial non observe).

---

## B24 — Le temps de correspondance metro etait invisible dans les etapes

**Criticite** : moyenne — la duree totale comptait quatre minutes, mais la fiche
passait directement de la premiere ligne a la seconde. L'utilisateur ne voyait
ni qu'il devait marcher ni d'ou venait ce temps.

### Identifier la source

Le defaut a ete signale sur une capture du trajet Metro A vers Metro B a
Charpennes : les deux cartes de ligne etaient consecutives, sans etape entre
elles. La constante `TRANSFER_PENALTY_MINUTES` etait seulement ajoutee au total
du parcours dans `findTransitJourney`.

**Cause racine** : la correspondance etait une penalite de scoring, pas un
segment du domaine. La restitution ne pouvait donc pas l'afficher, et le temps
de marche maximal du profil ne pouvait pas la compter comme marche.

### Corriger

`transitLegs` insere entre deux trajets un segment `walk` intitule
« Correspondance a pied », de quatre minutes. Il reste visible meme avec une
distance nulle et participe aux agregats. Le segment porte `transfer: true` :
le routeur et la verification de geometrie savent alors que l'absence de trace
est volontaire. Le GTFS ne publiant pas les cheminements interieurs entre quais,
aucune ligne droite trompeuse n'est dessinee sur la carte.

**Ou le voir** : `src/lib/planner/transit.ts`,
`src/components/planner/RouteSteps.tsx`, `src/lib/transport/routing/legs.ts`

**Commit** : [`4c170ad`](https://github.com/Vitrixxl/t6/commit/4c170ad)

### Tester et valider le correctif

Le test construit deux lignes qui se croisent a Charpennes et exige exactement
trois segments : metro A, marche, metro B. La premiere execution a ete vue
**rouge** : la fabrique ajoutait sa minute minimale de parcours aux quatre
minutes fixes et rendait cinq minutes. Apres distinction entre distance nulle
et temps fixe, le test est vert a quatre minutes. Un second test verifie
qu'OSRM n'est pas appele et que la geometrie vide est acceptee.

**Niveau de verrouillage** : **automatise**.

---

## B25 — L'objectif mensuel de CO2 ne pouvait pas etre choisi

**Criticite** : moyenne — le planificateur affichait une progression mensuelle,
mais sa cible etait toujours l'objectif hebdomadaire multiplie par quatre. Un
utilisateur ne pouvait donc pas fixer une ambition propre au mois.

### Identifier la source

**Symptome** : modifier l'objectif hebdomadaire changeait automatiquement la
cible mensuelle, sans champ mensuel dans le profil.

**Cause racine** : `TripGoalsCard` calculait directement
`weeklySavedGoalGrams * 4`. Le contrat `MobilityProfile` ne portait aucune
valeur mensuelle a persister ; l'interface ne pouvait donc pas faire autrement.

### Corriger

Le contrat partage porte maintenant `monthlySavedGoalGrams`, avec ses bornes et
une valeur par defaut pour les comptes anterieurs. Le profil presente deux
champs explicites et independants, puis le planificateur compare chaque agregat
a la cible de sa periode. `PUT /api/me/profile` persiste le profil entier :
aucune route ou table supplementaire n'est necessaire.

**Ou le voir** : `src/contracts/profile.ts`,
`src/components/profile/ProfilePanels.tsx`,
`src/components/planner/trips/TripGoalsCard.tsx`

**Commit** : [`23c028a`](https://github.com/Vitrixxl/t6/commit/23c028a)

### Tester et valider le correctif

Le test de contrat fixe deux valeurs volontairement non proportionnelles et
verifie leurs bornes independamment. Le test d'integration API remplace ensuite
le profil avec un objectif mensuel, le relit et exige la meme valeur. Enfin, la
recette navigateur a enregistre 2 300 g par semaine et 11 500 g par mois, puis
a confirme leur conservation apres rechargement.

Le test automatise a ete ajoute avec le champ et n'a pas ete vu rouge avant sa
premiere implementation.

**Niveau de verrouillage** : **faible** (contrat et persistance automatises,
recette visuelle manuelle, protocole rouge-puis-vert initial non observe).

---

## B26 — Chaque option inventait sa propre reference voiture

**Criticite** : majeur — deux alternatives entre le meme depart et la meme
arrivee n'etaient pas comparees au meme scenario, donc l'indicateur central de
la fonctionnalite carbone pouvait favoriser artificiellement l'option la plus
longue.

### Identifier la source

Le defaut a ete trouve en expliquant la formule pendant la revue du moteur.
`summarizeLegs` calculait la reference comme `distance de l'option x 180`, puis
soustrayait l'empreinte de cette option. Une option de cinq kilometres recevait
donc une voiture fictive de cinq kilometres, meme si la route automobile entre
les extremites n'en faisait que trois.

**Symptome** : deux options allant au meme endroit affichaient des references
voiture differentes, proportionnelles a leurs propres detours. Une option plus
longue pouvait annoncer davantage de CO2 evite uniquement parce que sa voiture
de comparaison avait ete rallongee avec elle.

**Cause racine** : la comparaison contrefactuelle etait calculee dans
`summarizeLegs`, fonction qui ne connait que les segments de l'alternative.
Elle ne disposait ni des extremites globales de la recherche ni d'une mesure
automobile. Le `Math.max(..., 0)` masquait en plus tout resultat negatif.

### Corriger

La voiture reste hors de `MobilityMode` et n'apparait jamais dans les options
ou les preferences. `car` n'existe que dans `RoutableMode` et pointe vers le
profil OSRM `driving`. Au lancement d'une recherche, une matrice `1 x 1`
mesure la distance voiture en parallele du choix des acces. Apres le routage de
toutes les alternatives, `applyCarbonReference` leur applique le meme objet
`CarbonReference` : distance, empreinte et version du facteur.

Le facteur est fige a 142 gCO2e/passager-km pour une voiture thermique moyenne
diesel, une personne, modelisation ADEME 2025. Les transports publics utilisent
desormais le facteur de leur `route_type` GTFS : 3,8 pour le tramway, 4,2 pour
le metro, et le funiculaire reprend explicitement le metro par approximation.

Une economie negative est conservee et affichee en emissions supplementaires.
Si le profil voiture echoue, l'empreinte propre des options reste visible,
`carbonSavedGrams` vaut `null` dans le contrat et en base, et l'interface dit
« Comparaison voiture indisponible ».

**Ou le voir** : `src/queries/routes.ts`,
`src/lib/planner/emissions.ts`, `src/lib/planner/legs.ts`,
`server/src/services/routing/osrm.ts`, `server/drizzle/0003_reference-carbone-nullable.sql`

**Commit** : [`a25171e`](https://github.com/Vitrixxl/t6/commit/a25171e)

### Tester et valider le correctif

Les tests couvrent la cause plutot qu'un seul affichage :

1. une route voiture de 3 km produit exactement `3 x 142 = 426 gCO2e` ;
2. des options de 2 et 5 km partagent le meme objet de reference ; la seconde,
   a 500 gCO2e, conserve `426 - 500 = -74 gCO2e` ;
3. la comparaison est appliquee apres le remplacement de l'estimation de 2 km
   par une mesure OSRM de 5 km ;
4. une panne voiture rend `null`, jamais zero ;
5. le test API exige `/routed-car/table/v1/driving/`, puis verifie qu'un second
   appel ressort du cache partage sans nouvel appel amont ;
6. le contrat interdit toujours `car` dans les modes proposes et la migration
   persiste bien une comparaison absente.

La recette navigateur a affiche, pour le meme trajet, une empreinte pietonne de
`0 gCO₂e` et `564 gCO₂e evites` issus de la reference routiere. Le scenario E2E
reste vert a 8/8 et axe-core ne detecte aucune violation sur les quatre ecrans.

Ces tests ont ete ajoutes avec la correction et n'ont pas ete observes rouges
sur la version initiale.

**Niveau de verrouillage** : **faible** (regressions automatisees et recette
navigateur, protocole rouge-puis-vert initial non observe).

---

## B27 — Modifier un element reecrivait toute sa collection

**Criticite** : majeur — une vue locale perimee pouvait effacer silencieusement
des trajets crees depuis un autre appareil, et une coupure entre deux requetes
pouvait laisser un trajet termine sans son entree carbone.

### Identifier la source

Le defaut est apparu pendant la revue du depot `trip-records.ts` :
`replaceAll` supprimait toutes les lignes de l'utilisateur, puis reinserait la
liste fournie par le navigateur. La meme forme existait dans les quatre depots
de collections et remontait jusqu'a une mutation React Query generique.

**Symptome** : enregistrer, annuler ou supprimer un seul element envoyait une
liste complete. Si deux appareils partaient de vues differentes, le dernier
PUT gagnait a l'echelle de la collection et supprimait les lignes absentes de
son cache. Marquer un trajet fait envoyait en plus deux PUT independants : un
pour le trajet, un pour l'historique.

**Cause racine** : l'idempotence avait ete concue autour du remplacement de
liste plutot qu'autour de l'identite des ressources. Le client etait donc
traite comme l'autorite sur une collection qu'il ne pouvait connaitre qu'a un
instant donne.

### Corriger

Les collections restent lisibles par GET, mais chaque trajet programme,
routine et itineraire sauvegarde possede maintenant un
`PUT /api/.../:id` et un `DELETE /api/.../:id`. Les depots exposent
`findById`, `upsert` et `deleteById` sur la cle composee utilisateur/id ; aucun
d'eux ne recoit une collection complete. Les limites de conservation retirent
uniquement les lignes excedentaires.

La completion passe par
`PUT /api/trips/planned/:id/completion`. Le service termine le trajet et cree
son `TripRecord` dans une seule transaction SQLite ; le rejeu rend le meme
etat sans doublon. Chaque fichier React Query porte directement la lecture et
les commandes de sa ressource : il n'existe plus d'orchestrateur generique
capable de modifier une partie arbitraire du compte. Apres un succes, seule la
reponse du serveur est appliquee aux caches concernes ; Eden Treaty n'envoie
que la ressource ciblee. Seul
`DELETE /api/trips/history`, declenche par le bouton d'effacement explicite,
supprime volontairement tout l'historique.

**Ou le voir** : `server/src/routes/planned-trips.ts`,
`server/src/services/planned-trips.ts`,
`server/src/repositories/planned-trips.ts`, `src/queries/planned-trips.ts`,
`src/lib/api/planned-trips.ts`

**Commit** : [`e32f643`](https://github.com/Vitrixxl/t6/commit/e32f643)

**Simplification du flux client** :
[`8d2257b`](https://github.com/Vitrixxl/t6/commit/8d2257b)

### Tester et valider le correctif

Les tests d'API prouvent qu'un second PUT conserve le premier element, qu'un
DELETE conserve sa voisine et les autres collections, et reproduisent ces
garanties pour les routines et les itineraires enregistres. Ils verifient
aussi le rejeu de la completion, l'unicite de l'historique, le 404 sans trajet
source et l'impossibilite d'injecter directement un statut `done`.

Les tests du client inspectent les requetes reelles produites par Eden : corps
unitaire sans `id` ni `userId`, identifiant dans l'URL, un seul endpoint de
completion, DELETE explicites et serialisation des commandes en rafale. Un
refus invalide uniquement la vue concernee.

Ces tests ont ete ajoutes avec le refactoring et n'ont pas ete observes rouges
sur une reproduction isolee avant la correction.

**Niveau de verrouillage** : **faible** (regressions automatisees et scenario
E2E adapte, protocole rouge-puis-vert initial non observe).

---

## B28 — L'action des objectifs n'indiquait pas ce qu'elle modifiait

**Criticite** : faible — la carte Objectifs ne contenait qu'un bouton
« Modifier ». Dans un planificateur qui permet aussi de modifier le profil et
les trajets, l'objet de cette action devait etre devine.

### Identifier la source

**Symptome** : dans l'en-tete « Objectifs », l'action secondaire affichait le
seul mot « Modifier », sans nom accessible plus precis.

**Cause racine** : le libelle avait ete raccourci pour tenir dans la carte,
alors que l'espace disponible permettait de nommer directement la ressource.

### Corriger

Le bouton porte desormais le texte visible et le nom accessible « Modifier les
objectifs ». L'action, son objet et le formulaire qui s'ouvre utilisent ainsi
le meme vocabulaire.

**Ou le voir** : `src/components/planner/trips/TripGoalsCard.tsx`

**Commit** : [`8d2257b`](https://github.com/Vitrixxl/t6/commit/8d2257b)

### Tester et valider le correctif

Le scenario navigateur ouvre le planificateur apres avoir programme un trajet,
puis cherche exactement un bouton accessible nomme « Modifier les objectifs ».
Le test echoue si le libelle redevient vague ou si l'action disparait. Une
capture en vue mobile a aussi confirme que le texte tient dans l'en-tete.

Le controle a ete ajoute avec le correctif et n'a pas ete observe rouge avant
sa premiere implementation.

**Niveau de verrouillage** : **faible** (controle E2E bloquant et recette
visuelle, protocole rouge-puis-vert initial non observe).

---

## B29 — Le tutoriel mobile sautait les fonctions de l'application

**Criticite** : majeur — lors d'une premiere visite sur telephone, le guide
passait de la recherche a la fin sans montrer la carte, les couches, les
trajets, les objectifs ni le profil.

### Identifier la source

**Symptome** : apres l'ecran d'accueil et la recherche, « Suivant » arrivait
presque immediatement sur « C'est tout ! ». Les rares explications pouvaient en
plus se superposer au controle designe sur un petit ecran.

**Cause racine** : une liste unique d'etapes ciblait surtout les panneaux du
shell desktop. Le mecanisme sautait correctement une cible absente, mais sur
mobile presque toutes les cibles l'etaient. La regle de placement centrait
aussi la bulle sur toute cible large, y compris la barre de recherche mobile.

### Corriger

Le desktop conserve ses onze etapes. Le mobile possede maintenant un parcours
de neuf etapes qui cible les controles reellement rendus : recherche, carte,
position, proximite, couches, trajets/objectifs et profil. Les boutons de la
barre d'actions ainsi que leurs equivalents dans la feuille d'itineraire
portent des cibles mobiles explicites.

La bulle mobile mesure l'espace disponible et se place sous une cible haute ou
au-dessus d'une cible basse. Sa largeur est bornee par celle du viewport. La
cle de premiere visite passe en version 2 afin que les utilisateurs ayant deja
vu le parcours incomplet recoivent le parcours corrige.

**Ou le voir** : `src/components/tutorial/TutorialOverlay.tsx`,
`src/components/planner/MobileQuickPanels.tsx`,
`src/components/app/MobilityLayouts.tsx`, `scripts/e2e-planning.mjs`

**Commit** : [`d3ac1b0`](https://github.com/Vitrixxl/t6/commit/d3ac1b0)

### Tester et valider le correctif

Le scenario E2E a d'abord ete etendu avec les neuf titres et les sept cibles
attendus. Son premier passage rouge s'est arrete sur
`la cible mobile-search n'est pas visible`. Apres correction, il parcourt les
neuf etapes, verifie que chaque cible existe et calcule l'intersection entre la
bulle et chaque controle : toute superposition fait echouer le test.

La recette visuelle en 390 x 844 confirme que la carte reste lisible et que le
bouton « Trajets et objectifs » est seul dans le spotlight. Le scenario complet
termine ensuite la planification, la completion et la deconnexion en 8/8.

**Niveau de verrouillage** : **automatise** (E2E ecrit et observe rouge avant
le correctif, puis vert ; captures mobiles de controle).
