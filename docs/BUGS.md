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
