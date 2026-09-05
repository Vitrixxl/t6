# Rapport de bogues — trois exemples pour la revue C3.3

Cette sélection illustre les trois pratiques du dossier : **identifier la source,
corriger, tester et valider** (sections 10.1 et 10.2). Les trois PR sont
fusionnées ; elles décrivent les échecs observés avant correction et les tests
passés après. Les identifiants historiques sont conservés pour retrouver les preuves.

| Exemple | Intérêt pour le dossier | PR du correctif |
| --- | --- | --- |
| B16 — Calcul hebdomadaire du carbone | F4 : fiabilité du suivi personnel ; tests de dates et cohérence entre écrans | [PR #1](https://github.com/Vitrixxl/t6/pull/1) |
| B17 — Trottinette proposée jusqu’à Paris | C6 et RG3 : cohérence géographique ; tests aux limites et contre-exemple valide | [PR #4](https://github.com/Vitrixxl/t6/pull/4) |
| B20 — Mesures variables selon la sélection | Planification multimodale : comparaison sur des mesures homogènes ; non-régression du moteur | [PR #7](https://github.com/Vitrixxl/t6/pull/7) |

**Lien avec le dossier.** Ces exemples complètent sa démarche de qualité ; ils
ne sont pas les cas énumérés en section 10.3. Le rapprochement a été fait avec
le texte source du dossier, sans ouvrir, contrôler ni régénérer le PDF gelé.
Les évolutions du code depuis les PR sont précisées ci-dessous.

Le [journal complet](BUGS-ARCHIVE.md) conserve la traçabilité des autres bogues,
y compris les ouverts. Le [chantier GTFS](PLAN-ATTENTE-GTFS.md) reste ouvert :
les horaires réels ne sont pas encore branchés au client.

## B16 — Le suivi hebdomadaire cumulait tout l’historique

**PR : [#1 — correctif fusionné](https://github.com/Vitrixxl/t6/pull/1)** · [Commit 48e4dcd](https://github.com/Vitrixxl/t6/commit/48e4dcd29404324739ad322f09265f30c172b15a)

### Identifier la source

**Symptôme — majeur.** La progression hebdomadaire ne redescendait pas le lundi ; deux écrans annonçaient des économies différentes pour la même semaine.

**Identification.** Relecture des bornes de dates dans les agrégats, puis comparaison du résultat de `summarizeCarbon` avec le libellé hebdomadaire et avec `summarizeTripActivity`.

**Cause racine.** Un cumul de tous les enregistrements était comparé à un objectif hebdomadaire, sans filtre temporel. Le défaut venait du décalage entre la période annoncée et les données additionnées.

### Corriger

Filtrer les enregistrements à partir du lundi dans `summarizeCarbon`, avec une définition commune de la semaine dans `startOfWeek`. La borne est appliquée au calcul partagé afin que chaque écran n’ait pas à la réimplémenter.

**Où le montrer :** `src/lib/carbon.ts` → `summarizeCarbon` ; `src/lib/week.ts` → `startOfWeek` ; `src/lib/carbon.test.ts`.

### Tester et valider

Avec une horloge fixée, vérifier qu’un trajet de la semaine précédente est exclu, que le compteur repart au lundi et que lundi à minuit est inclus. Un quatrième test compare les économies hebdomadaires des deux agrégats sur les mêmes données.

**Preuve historique dans la PR :** échecs `expected 2 to be 1` et `expected 1 to be +0`, puis tests verts.

**Niveau de verrouillage : automatisé** pour les propriétés testées.

**État actuel et limite à annoncer :** Aujourd’hui, le maximum carbone hebdomadaire porte sur les **émissions** ; les objectifs d’**économies** restent distincts. Le principe conservé est la fenêtre hebdomadaire. Le test de cohérence emploie des fixtures : il ne prouve pas la transaction serveur de comptabilisation automatique des ponctuels.

## B17 — Une trottinette était proposée sur 416 kilomètres

**PR : [#4 — correctif fusionné](https://github.com/Vitrixxl/t6/pull/4)** · [Commit 962432e](https://github.com/Vitrixxl/t6/commit/962432eae4ccb2100ffe46a5021a99b0cdc55cbb)

### Identifier la source

**Symptôme — majeur.** Une recherche Bellecour → Paris proposait une trottinette sur 416 km et 23 h, alors que la bannière annonçait les véhicules partagés indisponibles hors métropole. Ce sont les valeurs du moteur défectueux, pas un trajet réellement effectué.

**Identification.** Sonde du moteur avec des destinations aux limites, puis comparaison vélo/trottinette : seule la trottinette survivait à une destination hors périmètre.

**Cause racine.** Le générateur vérifiait la disponibilité au départ, sans contraindre la destination. Le vélo échappait au défaut grâce à l’obligation de trouver une station de restitution.

### Corriger

Refuser l’option trottinette quand la destination échoue à `withinServiceArea`. Une flotte libre exige une destination dans le périmètre retenu, pas la présence d’une autre trottinette à l’arrivée : copier la règle des bornes Vélo’v aurait été inadapté.

**Où le montrer :** `src/lib/planner/options/scooter.ts` → `createScooterOption` ; `src/lib/planner/geo.ts` → `withinServiceArea` ; `src/lib/planner/planner.test.ts` → suite « portée des modes partagés (RG3) ».

### Tester et valider

Trois cas : Paris ne propose aucune trottinette ; une destination locale conserve cette option ; les deux modes partagés et leurs rabattements sont exclus hors zone dans le scénario testé. Le cas local empêche un faux correctif qui supprimerait systématiquement le mode.

**Preuve historique dans la PR :** les tests hors zone échouaient avec une option `scooter`, puis passaient après ajout du contrôle.

**Niveau de verrouillage : automatisé** pour les propriétés testées.

**État actuel et limite à annoncer :** Le périmètre actuel repose sur une distance au centre et un rayon métropolitain ; ce n’est pas un polygone réglementaire Dott actualisé. Le correctif verrouille ce filtre géographique. Les disponibilités exigent désormais les flux en direct ; le covoiturage mentionné dans la PR historique a été retiré.

## B20 — Les chiffres changeaient quand on sélectionnait une option

**PR : [#7 — correctif fusionné](https://github.com/Vitrixxl/t6/pull/7)** · [Commit d3b68dc](https://github.com/Vitrixxl/t6/commit/d3b68dce867466a020f3714cd7c42a6dd1d5d92c)

### Identifier la source

**Symptôme — majeur.** Sur les captures du signalement, le vélo affichait 32 min / 5,0 km lorsqu’il était sélectionné et 26 min / 4,5 km lorsqu’une autre option était choisie.

**Identification.** Comparaison de captures pour la même recherche en changeant uniquement la sélection, puis remontée aux objets qui alimentaient la liste et le détail.

**Cause racine.** Seule l’option sélectionnée recevait les mesures routées ; les autres conservaient leurs estimations à vol d’oiseau. La liste mélangeait donc deux méthodes de mesure. Une première correction d’affichage avait déplacé le problème sans supprimer cette coexistence.

### Corriger

Mesurer toutes les options dans `measureRoutes`, écarter celles dont la géométrie est incomplète, puis recalculer leur classement. Liste et détail utilisent les mêmes options mesurées.

**Où le montrer :** `src/queries/routes.ts` → `POST /api/transport/journeys` → `server/src/services/planning.ts` → appel de `measureRoutes` ; `src/lib/planner/index.ts` → `measureRoutes`, puis `rankRoutes` ; `src/lib/planner/legs.ts` → `applyRoutedLegs`, `hasCompleteGeometry` ; `src/lib/planner/planner.test.ts` → suite « measureRoutes ».

### Tester et valider

Un routeur de test double les mesures et fournit une géométrie. Vérifier que toutes les options sont mesurées, qu’un segment sans géométrie exclut son option et que le classement est refait après mesure. Le test actuel inverse les durées initiales et vérifie l’ordre croissant des durées réelles, indépendamment du score.

**Preuve historique dans la PR :** distance non doublée (`expected 2.67 to be close to 5.34`), options incomplètes conservées et scores inchangés produisaient trois échecs, puis les tests passaient.

**Niveau de verrouillage : automatisé** pour les propriétés testées.

**État actuel et limite à annoncer :** Le tri actuel se fait par durée réelle croissante ; la PR initiale décrivait un classement par score. Les moteurs OSRM sont désormais locaux. Les temps de transport public restent heuristiques, sans graphe horaire GTFS branché au client : ce correctif ne garantit pas un prochain départ réel.

## Préparer la démonstration

Ouvrir la PR, présenter le symptôme, montrer la cause dans le code, puis le test.
Rejouer les deux suites avec :

```bash
bun test src/lib/carbon.test.ts src/lib/planner/planner.test.ts
```

Vérification du 5 septembre 2026 : **35 tests réussis, 0 échec, 100 assertions**.
Ce rejeu confirme les tests actuels ; les observations rouge/vert historiques
sont celles consignées dans les PR, pas une nouvelle exécution des anciennes versions.
