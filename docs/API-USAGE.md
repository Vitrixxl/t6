# Endpoints conservés et leurs appelants

Audit du 5 septembre 2026 : 30 couples méthode/chemin, dont les deux ressources
HTML/JSON de documentation. Une route appelée seulement par ses propres tests
n’est pas considérée comme utilisée par l’application.

| Méthode et chemin | Appelant et rôle |
| --- | --- |
| `GET /api/doc`, `GET /api/doc/json` | Documentation consultable et schéma chargé par Scalar ; `scripts/e2e-api-doc.mjs` vérifie le rendu. |
| `GET /api/health` | Sonde du conteneur dans `infra/api.Dockerfile` et attente du serveur dans `scripts/ci.ts`. |
| `POST /api/auth/register`, `POST /api/auth/login` | `src/lib/api/auth.ts`, appelé par les formulaires et les mutations de session. L’inscription exige `termsAccepted: true` (422 sinon) et enregistre la date et la version des conditions acceptées. La réponse contient l’état initial du compte. |
| `POST /api/auth/logout`, `GET /api/auth/session` | `src/lib/api/auth.ts` : fermeture et reprise de la session, avec état du compte. |
| `GET /api/me/profile`, `PUT /api/me/profile` | `src/lib/api/profile.ts` et `src/queries/profile.ts` : lecture, onboarding (moyens, PMR, date de validation), modification et relecture après un échec. |
| `GET /api/me/export` | `src/lib/api/account-export.ts`, appelé par le bouton d’export du profil. |
| `DELETE /api/me/` | `deleteAccount` dans `src/lib/api/auth.ts`, appelé depuis les actions du compte. |
| `GET /api/trips/planned`, `PUT /api/trips/planned/:id`, `DELETE /api/trips/planned/:id` | `src/lib/api/planned-trips.ts` et `src/queries/planned-trips.ts` : suivi, planification et suppression des ponctuels. |
| `PUT /api/trips/planned/:id/cancellation`, `DELETE /api/trips/planned/:id/cancellation` | Même client : annulation et rétablissement. |
| `GET /api/trips/recurring`, `PUT /api/trips/recurring/:id`, `DELETE /api/trips/recurring/:id` | `src/lib/api/recurring-trips.ts` et sa requête : lecture, création, pause/reprise et suppression des routines. |
| `PUT /api/trips/recurring/:id/cancellations/:date`, `DELETE /api/trips/recurring/:id/cancellations/:date/:direction` | Même client : exceptions d’annulation et rétablissement d’un sens. |
| `GET /api/trips/history`, `DELETE /api/trips/history` | `src/lib/api/trip-history.ts` et `src/queries/trip-records.ts` : lecture et effacement explicite de l’historique carbone. |
| `GET /api/saved-routes`, `PUT /api/saved-routes/:id`, `DELETE /api/saved-routes/:id` | `src/lib/api/saved-routes.ts` et sa requête : itinéraires enregistrés. |
| `GET /api/transport/context` | `src/queries/transport.ts` : métadonnées et disponibilités GBFS, sans réseau TCL complet. |
| `GET /api/transport/stops` | `src/queries/map-stops.ts` : tous les quais des cellules visibles de la carte, en cache par version. |
| `GET /api/transport/nearby-stops` | `src/queries/nearby-stops.ts` : compte réel et quatre quais les plus proches dans le rayon choisi. |
| `POST /api/transport/journeys` | `src/queries/routes.ts` : un tableau non vide de tous les trajets autorisés et exploitables, triés par arrivée, attentes comprises ; `RouteChoices` affiche chaque variante et sélectionne la première par défaut ; un plan MOTIS et sa référence voiture ; reprise conditionnelle en deux plans supplémentaires pour une arrivée piétonne inaccessible au profil location. |

Supprimés :

- `GET /api/route` et `POST /api/route-matrix` : les mesures sont appelées directement
  par `server/src/services/planning.ts` ; aucun navigateur ne consomme plus ces routes.
  Les tests du client MOTIS et de la traduction des options portent sur les services serveur.

- `GET /api/state` : aucun appel du client ; la connexion et la reprise de session
  rendent déjà cet état. Les tests lisent désormais la session ou les ressources
  utiles, comme le client. `repositories/state.ts` reste nécessaire à la session
  et à l’export ; ce n’est pas une route.
- `GET /api/transit/network` et `GET /api/transit/journeys` : retirées avec le
  pipeline horaire maison ; le calcul horaire MOTIS reste désactivé par défaut dans cette version.

`server/src/__tests__/platform.test.ts` vérifie que les cinq anciennes URL
répondent 404 et sont absentes du schéma OpenAPI généré. Il n’y a aucun alias
conservé pour les anciens tests.

Le montage de production est aussi vérifié par `server/src/__tests__/static-site.test.ts` :
le repli vers `index.html` refuse tous les chemins `/api` inconnus avec une erreur
JSON 404. La route `/*` sert le client et reste masquée dans OpenAPI.

Le contexte transport expose `transitRoutingAvailable` : faux par défaut dans cette version sans horaires TCL. Le client et le serveur excluent alors le mode public de la recherche ; les quais restent consultables.


**Transfert mobile (B78).** Les GET publics `/api/transport/context`, `/api/transport/stops` et `/api/transport/nearby-stops` négocient gzip via `Accept-Encoding` et `Vary`, après validation du JSON. `transportCompression` utilise `Bun.gzipSync` sans dépendance supplémentaire, à partir de 1 024 octets. Les refus `gzip;q=0`, petits corps, erreurs et réponses du compte restent non compressés. Un instantané des disponibilités passe de 1 063 426 à 138 168 octets sans retirer aucun véhicule. Avant correction, le transfert public de cet instantané prenait 14–20 s et approchait le délai de 20 s du contexte transport. Les tests de `transport-compression.test.ts` vérifient identité du JSON, négociation et en-têtes ; `e2e-arrival.mjs` exige la compression des disponibilités, et `e2e-transport-map.mjs` distingue octets transférés et JSON décompressé. Aucun gain énergétique n’est déduit de cette mesure.


**Lecture du trajet (B79–B80).** Les terminus de bus sont comparés après normalisation des espaces et de la ponctuation ; les noms affichés, quais physiques et sens restent ceux de la source. TB12 est ainsi importé et raccordé au tracé officiel. Le réseau actualisé compte 98 lignes de bus, 203 tracés bus par sens et 3 135 quais bus (5 570 entrées et 216 tracés avec le rail). `boardingWaits` calcule chaque attente avant embarquement depuis le départ demandé, puis depuis l’arrivée du précédent transport et la durée des accès. Un départ à pied différé par MOTIS devient une attente au premier arrêt pour un départ immédiat ; la durée totale reste inchangée. Une heure manquante donne une attente indisponible, jamais zéro. Les détails montrent attente et départ théoriques de chaque transport. `RouteSequence` affiche les pictogrammes, flèches et lettres/numéros, avec libellés accessibles mais aucun texte « marche » visible. Vérifications : `boarding-waits.test.ts`, `scripts/bus-import.test.ts` et `scripts/e2e-tcl.mjs` (le cas officiel TB12 se rejoue avec `E2E_TCL_CASE=tb12`).
