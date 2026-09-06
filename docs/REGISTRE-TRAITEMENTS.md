# Registre des activités de traitement

Registre tenu au titre de l'article 30 du RGPD pour UrbanFlow Mobility, prototype
de certification Titre 6 (session septembre 2026). Il décrit ce que le code fait
au 6 septembre 2026 ; toute évolution d'un traitement se reporte ici dans le même
travail, comme dans l'information affichée dans l'application
(`src/components/legal/LegalNotice.tsx`, version `TERMS_VERSION`).

**Responsable du traitement** : UrbanFlow Mobility, projet de certification,
représenté par son auteur. Contact : celui affiché dans l'application
(`CONTROLLER_CONTACT`). Pas de délégué à la protection des données : le
prototype n'entre dans aucun des cas de désignation obligatoire.

**Personnes concernées** : les utilisateurs inscrits, tous majeurs présumés,
résidant ou se déplaçant dans la métropole de Lyon.

**Finalité unique** : fournir le service demandé par l'utilisateur. Aucun
traitement secondaire : pas de statistiques d'usage, pas de profilage, pas de
prospection, aucune transmission à un tiers hors des sous-traitants techniques
listés ci-dessous.

## Traitements

| Traitement | Données | Base légale | Conservation | Où dans le code |
| --- | --- | --- | --- | --- |
| Compte et préférences de mobilité | email, nom affiché, empreinte argon2id du mot de passe, date de création, date et version des conditions acceptées, profil (moyens utilisables, besoin PMR, objectifs carbone, date de validation de l’accueil) | exécution du contrat (art. 6.1.b) | vie du compte ; effacement immédiat sur `DELETE /api/me` | `server/src/db/schema.ts` (`users`), `routes/auth.ts`, `routes/me.ts` |
| Calcul d'itinéraires | origine et destination de la recherche (coordonnées, libellés), dont la position GPS si l'utilisateur l'a partagée ; modes et préférences | exécution du contrat | aucune : la requête est calculée puis oubliée, jamais journalisée | `routes/transport.ts`, `services/planning.ts`, `plugins/request-log.ts` |
| Trajets planifiés | libellé, origine et destination (coordonnées), date prévue, modes, distance, durée, carbone, statut | exécution du contrat | `PAST_TRIP_RETENTION_MONTHS` (6 mois) après la date prévue pour les trajets terminés ou annulés ; `PLANNED_LIMIT` (400) lignes au plus | `repositories/planned-trips.ts` (`deletePastBefore`), `services/planned-trips.ts` (`completeDueTrips`) |
| Routines | libellé, origine et destination, jours, horaires, fuseau, périodes d'activité, annulations | exécution du contrat | jusqu'à suppression par l'utilisateur ou du compte ; `RECURRING_LIMIT` (50) | `repositories/recurring-trips.ts` |
| Itinéraires enregistrés | titre, origine et destination, modes, mesures, score | exécution du contrat | jusqu'à suppression par l'utilisateur ou du compte ; `SAVED_ROUTES_LIMIT` (50) | `repositories/saved-routes.ts` |
| Historique carbone | titre du trajet, modes, distance, durée, carbone, date ; aucune coordonnée | exécution du contrat | `TRIP_HISTORY_LIMIT` (50) dernières entrées ; effacement volontaire par `DELETE /api/trips/history` | `repositories/trip-records.ts` |
| Session | empreinte SHA-256 du jeton, identifiant du compte, dates | exécution du contrat | `SESSION_TTL_MS` (7 jours par défaut) ; purge des expirées à chaque ouverture ; révocation à la déconnexion | `services/sessions.ts`, `repositories/sessions.ts` |
| Limitation de débit | adresse IP (ou `X-Forwarded-For` derrière un proxy de confiance), compteur | intérêt légitime : sécurité du service (art. 6.1.f) | 60 secondes, en mémoire du processus, jamais en base ni en journal | `plugins/rate-limit.ts` |
| Position GPS en temps réel | coordonnées et précision | consentement recueilli par le navigateur (art. 6.1.a), retirable dans ses réglages ; refus sans perte de service | jamais persistée ; mémoire de la page, suivi arrêté au démontage | `src/components/app/hooks/useGeolocation.ts` |

## Destinataires et sous-traitants

| Destinataire | Ce qu'il reçoit | Localisation | Statut |
| --- | --- | --- | --- |
| Base Adresse Nationale (`api-adresse.data.gouv.fr`) | adresses tapées, points choisis par appui long, adresse IP du navigateur | France | service public, appelé par le navigateur |
| Photon (`photon.komoot.io`) | requêtes de recherche de lieux, adresse IP | Allemagne (UE) | service toléré pour un prototype ; à remplacer par un géocodeur auto-hébergé à l'échelle |
| Tuiles OpenStreetMap (`tile.openstreetmap.org`) | zone de carte affichée, adresse IP | Fondation OSM (Royaume-Uni, décision d'adéquation) | service toléré pour un prototype ; fournisseur sous contrat à l'échelle |
| MOTIS | origines et destinations des calculs | auto-hébergé avec l'API, même opérateur | pas un tiers |

Aucun transfert hors Union européenne autre que celui listé.

## Mesures de sécurité

Mots de passe en argon2id (paramètres OWASP), sessions opaques dont seule
l'empreinte est stockée, cookie `httpOnly` + `SameSite=Lax` + `Secure` en
production, validation zod de toute entrée, en-têtes helmet, limitation de débit
sur l'authentification, journal de requêtes sans donnée personnelle, base SQLite
hors de l'arborescence servie. Détail dans le README, section « Sécurité / RGPD ».

## Droits des personnes

| Droit | Mise en œuvre |
| --- | --- |
| Information (art. 13) | texte affiché avant l'inscription et depuis « Profil et préférences → Données personnelles » ; acceptation obligatoire, horodatée et versionnée à l'inscription |
| Accès et portabilité (art. 15, 20) | `GET /api/me/export`, bouton « Exporter mes données », JSON complet |
| Rectification (art. 16) | `PUT /api/me/profile` et modification libre des trajets |
| Effacement (art. 17) | `DELETE /api/me` en cascade ; `DELETE /api/trips/history` pour l'historique seul |
| Retrait du consentement à la géolocalisation | réglages du navigateur ; l'application fonctionne en saisie manuelle |
| Réclamation | CNIL, mentionnée dans le texte d'information |

## Avant une mise en production à l'échelle

- Analyse d'impact (AIPD) : la localisation à grande échelle figure dans la liste
  des traitements soumis à AIPD publiée par la CNIL. Le prototype n'y est pas
  soumis ; un déploiement métropolitain le serait.
- Contrats de sous-traitance (art. 28) avec le fournisseur de tuiles et le
  géocodeur retenus.
- Compteur de débit partagé (Redis) : même donnée, même durée, mais hors
  mémoire du processus ; à reporter ici.
