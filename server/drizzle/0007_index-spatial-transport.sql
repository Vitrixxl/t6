-- R*Tree n'est pas représentable par sqliteTable : cette migration complémentaire
-- maintient l'index avec les quais, dans la même transaction d'import.
CREATE VIRTUAL TABLE transport_stop_index USING rtree(id, min_lon, max_lon, min_lat, max_lat);
--> statement-breakpoint
CREATE TRIGGER transport_stops_insert AFTER INSERT ON transport_stops BEGIN
    INSERT INTO transport_stop_index VALUES (new.id, new.lon, new.lon, new.lat, new.lat);
END;
--> statement-breakpoint
CREATE TRIGGER transport_stops_delete AFTER DELETE ON transport_stops BEGIN
    DELETE FROM transport_stop_index WHERE id = old.id;
END;
--> statement-breakpoint
CREATE TRIGGER transport_stops_update AFTER UPDATE ON transport_stops BEGIN
    DELETE FROM transport_stop_index WHERE id = old.id;
    INSERT INTO transport_stop_index VALUES (new.id, new.lon, new.lon, new.lat, new.lat);
END;
--> statement-breakpoint
INSERT INTO transport_stop_index SELECT id, lon, lon, lat, lat FROM transport_stops;
