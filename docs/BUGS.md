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

**Ou le voir** : `src/lib/trips/recurrence.ts`

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

**Commit** : renseigne apres creation du commit de migration React Query.

### Tester et valider le correctif

Le test de deconnexion observe la requete de session et verifie qu'au moment
exact ou elle devient nulle, aucune requete de l'ancien compte ne subsiste.
Le scenario `bun run e2e` doit en plus terminer ses 7/7 assertions sans
`PAGE ERROR` dans un vrai navigateur.

**Niveau de verrouillage** : **automatise** (test du cache + scenario E2E).
