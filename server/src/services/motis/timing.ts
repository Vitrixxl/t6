import { transitTypeOf, type MotisItinerary } from './client.ts';

/**
 * Attente avant chaque embarquement pour un départ dès l'heure demandée.
 * MOTIS peut décaler le départ à pied pour éviter une attente à l'arrêt : ce
 * décalage est réaffecté au premier embarquement, déjà inclus dans la durée totale.
 * Une heure absente reste inconnue, jamais remplacée par une attente nulle.
 */
export function boardingWaits(itinerary: MotisItinerary, departureAt: string): (number | undefined)[] {
    let readyAt: number | undefined = Date.parse(departureAt);
    return itinerary.legs.map(leg => {
        if (transitTypeOf(leg) === undefined) {
            readyAt = readyAt === undefined ? undefined : readyAt + leg.duration * 1000;
            return undefined;
        }
        const wait = readyAt !== undefined && leg.startTime
            ? Math.max(0, Math.round((Date.parse(leg.startTime) - readyAt) / 1000)) : undefined;
        readyAt = leg.endTime ? Date.parse(leg.endTime) : undefined;
        return wait;
    });
}
