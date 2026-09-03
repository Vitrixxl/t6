-- Les routines ne sont plus materialisees en trajets : leurs periodes
-- d'activite remplacent le drapeau `paused`, et les occurrences generees
-- disparaissent. Genere par drizzle-kit, complete a la main pour reprendre
-- les lignes existantes (une colonne NOT NULL sans defaut ne s'ajoute pas a
-- une table remplie).
ALTER TABLE `recurring_trips` ADD `periods_json` text NOT NULL DEFAULT '[]';--> statement-breakpoint
-- Une routine active court depuis sa creation. Une routine en pause, dont la
-- date de pause n'a jamais ete conservee, est close a sa creation : aucun
-- passage ne lui est attribue plutot qu'un nombre invente.
UPDATE `recurring_trips` SET `periods_json` = json_array(json_object('from', `created_at`, 'to', CASE WHEN `paused` THEN `created_at` ELSE NULL END));--> statement-breakpoint
ALTER TABLE `recurring_trips` DROP COLUMN `paused`;--> statement-breakpoint
-- Les occurrences encore a faire n'ont plus de sens ; celles deja faites ou
-- annulees restent dans l'historique comme des trajets ordinaires.
DELETE FROM `planned_trips` WHERE `recurring_trip_id` IS NOT NULL AND `status` = 'planned';--> statement-breakpoint
ALTER TABLE `planned_trips` DROP COLUMN `recurring_trip_id`;
