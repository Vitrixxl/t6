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
| `POST /api/transport/journeys` | `src/queries/routes.ts` : un objet trajet, le plus rapide avec les moyens et types publics demandés, attentes comprises ; un plan MOTIS et sa référence voiture ; reprise conditionnelle en deux plans supplémentaires pour une arrivée piétonne inaccessible au profil location. |

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
