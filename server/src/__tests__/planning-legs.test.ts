import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { hasCompleteGeometry } from '../../../src/lib/planner/legs';
import type { RouteLeg } from '../../../src/types';
import { measureLeg } from '../services/planning';
import { openDatabase } from '../db';
import { loadConfig } from '../config';
import { createRoutingService } from '../services/routing';
import { createRouteCacheRepository } from '../repositories/route-cache';
const origin = { label: 'Bellecour', lat: 45.7578, lon: 4.832 };
const destination = { label: 'Part-Dieu', lat: 45.7606, lon: 4.8594 };
let db: ReturnType<typeof openDatabase>;
let routing: ReturnType<typeof createRoutingService>;
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;
beforeEach(() => {
    db = openDatabase(':memory:');
    routing = createRoutingService(loadConfig({}), createRouteCacheRepository(db));
    fetchSpy = spyOn(globalThis, 'fetch');
    fetchSpy.mockRejectedValue(new Error('Réseau inattendu'));
});
afterEach(() => { fetchSpy.mockRestore(); db.$client.close(); });

describe('mesure des segments côté serveur', () => {
    // Un segment de voirie quelconque : ce qui est teste ici est la reprise des
    // mesures du routage, pas le mode. Les hypothèses sont volontairement toutes
    // non neutres, pour qu'une hypothèse perdue se voie.
    const roadLeg: RouteLeg = {
        id: 'scooter-core',
        mode: 'scooter',
        title: 'Trottinette partagée',
        from: origin.label,
        to: destination.label,
        fromPoint: origin,
        toPoint: destination,
        path: [],
        distanceKm: 2,
        durationMinutes: 12,
        carbonGrams: 30,
        accessible: true,
        detail: 'Test',
        // 1.2 de congestion, 6 min de temps fixe, 15 g/km.
        estimate: { travelFactor: 1.2, overheadMinutes: 6, carbonGramsPerKm: 15 },
    };

    it('reprend distance, durée et CO2 du réseau routier en gardant les hypothèses du segment', async () => {
        fetchSpy.mockResolvedValue(Response.json({ code: 'Ok', routes: [{
            distance: 3000, duration: 600,
            geometry: { type: 'LineString', coordinates: [[4.832, 45.7578], [4.8594, 45.7606]] },
            legs: [{ steps: [] }],
        }] }));

        const [enhanced] = await Promise.all([measureLeg(roadLeg, routing)]);

        expect(enhanced.distanceKm).toBe(3);
        // 10 min de parcours x 1.2 de congestion + 6 min de temps fixe.
        expect(enhanced.durationMinutes).toBe(18);
        expect(enhanced.carbonGrams).toBe(45);
        expect(enhanced.path).toHaveLength(2);
    });

    it("laisse le segment sans géométrie quand le routage echoue, sans inventer de tracé", async () => {
        fetchSpy.mockRejectedValue(new Error('réseau coupé'));

        const [enhanced] = await Promise.all([measureLeg({ ...roadLeg, path: [origin, destination] }, routing)]);

        expect(enhanced.path).toEqual([]);
    });

    it("n'envoie pas un segment de transport public au routage routier", async () => {

        const transitPath = [origin, destination];
        const [enhanced] = await Promise.all([measureLeg({ ...roadLeg, id: 'ride', mode: 'transit', path: transitPath }, routing)]);

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(enhanced.path).toBe(transitPath);
    });

    it("n'envoie pas une correspondance intérieure à OSRM et accepte son absence de tracé", async () => {
        const transfer: RouteLeg = {
            ...roadLeg,
            id: 'transfer',
            mode: 'walk',
            title: 'Correspondance à pied',
            path: [],
            distanceKm: 0,
            durationMinutes: 4,
            transfer: true,
        };

        const [enhanced] = await Promise.all([measureLeg(transfer, routing)]);

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(enhanced).toBe(transfer);
        expect(hasCompleteGeometry([transfer])).toBe(true);
    });
});
