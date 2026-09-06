// Tests du client MOTIS : requêtes construites et lecture validée des réponses.
// Le moteur est remplacé par un `fetch` sous contrôle ; aucun appel réseau ne sort.
import { afterEach, describe, expect, it } from 'bun:test';
import { fetchCarMeasure, fetchPlan, planUrl } from '../services/motis/client.ts';
import { decodePolyline } from '../services/motis/polyline.ts';

const realFetch = globalThis.fetch;
const MOTIS = 'http://motis:8080';
const origin = { lat: 45.7578, lon: 4.832 };
const destination = { lat: 45.7606, lon: 4.8594 };
const base = { from: origin, to: destination, departureAt: '2022-04-20T08:00:00+02:00', transitModes: ['SUBWAY', 'TRAM'], wheelchair: false };

function stub(response: (url: URL) => Response | Promise<Response>): { urls: URL[] } {
    const urls: URL[] = [];
    globalThis.fetch = (async (input: Parameters<typeof globalThis.fetch>[0]) => {
        const url = new URL(String(input));
        urls.push(url);
        return response(url);
    }) as unknown as typeof fetch;
    return { urls };
}

afterEach(() => {
    globalThis.fetch = realFetch;
});

describe('planUrl', () => {
    it('demande à pied les modes de transport retenus, en profil fauteuil si besoin', () => {
        const url = new URL(planUrl(MOTIS, { ...base, access: 'WALK', wheelchair: true }));
        expect(url.pathname).toBe('/api/v6/plan');
        expect(url.searchParams.get('fromPlace')).toBe('45.7578,4.832');
        expect(url.searchParams.get('toPlace')).toBe('45.7606,4.8594');
        expect(url.searchParams.get('time')).toBe('2022-04-20T08:00:00+02:00');
        expect(url.searchParams.get('transitModes')).toBe('SUBWAY,TRAM');
        expect(url.searchParams.get('pedestrianProfile')).toBe('WHEELCHAIR');
        expect(url.searchParams.get('preTransitModes')).toBe('WALK');
        expect(url.searchParams.get('directModes')).toBe('WALK');
        // La marche reste proposée sur toute la métropole : quatre heures.
        expect(url.searchParams.get('maxDirectTime')).toBe('14400');
        expect(url.searchParams.has('maxTravelTime')).toBe(false);
    });

    it('demande un engin partagé en rabattement et en trajet direct', () => {
        const url = new URL(planUrl(MOTIS, { ...base, access: 'SCOOTER_STANDING' }));
        expect(url.searchParams.get('preTransitModes')).toBe('RENTAL');
        expect(url.searchParams.get('preTransitRentalFormFactors')).toBe('SCOOTER_STANDING');
        expect(url.searchParams.get('directModes')).toBe('RENTAL');
        expect(url.searchParams.get('directRentalFormFactors')).toBe('SCOOTER_STANDING');
        expect(url.searchParams.get('postTransitModes')).toBe('WALK');
        // Un engin partagé au-delà d'une heure et demie n'est plus une option.
        expect(url.searchParams.get('maxDirectTime')).toBe('5400');
    });

    it('sans type de transport, ne garde que les trajets directs', () => {
        const url = new URL(planUrl(MOTIS, { ...base, transitModes: [], access: 'WALK' }));
        expect(url.searchParams.has('transitModes')).toBe(false);
        expect(url.searchParams.get('maxTravelTime')).toBe('1');
    });
});

describe('fetchPlan', () => {
    it('rend les trajets directs puis les itinéraires validés', async () => {
        const fixture = await Bun.file(new URL('./fixtures/motis-plan-rental.json', import.meta.url)).json();
        stub(() => Response.json(fixture));
        const itineraries = await fetchPlan(MOTIS, { ...base, access: 'BICYCLE' });
        expect(itineraries).toHaveLength(4);
        expect(itineraries?.[0].legs.map((leg) => leg.mode)).toEqual(['WALK', 'RENTAL', 'WALK']);
        expect(itineraries?.[2].legs.some((leg) => leg.mode === 'TRAM')).toBe(true);
    });

    it('ne fabrique aucun itinéraire quand le moteur tombe ou répond hors contrat', async () => {
        stub(() => { throw new Error('Panne MOTIS'); });
        expect(await fetchPlan(MOTIS, { ...base, access: 'WALK' })).toBeNull();
        stub(() => Response.json({ itineraries: [{ legs: [] }] }));
        expect(await fetchPlan(MOTIS, { ...base, access: 'WALK' })).toBeNull();
        stub(() => Response.json({}, { status: 503 }));
        expect(await fetchPlan(MOTIS, { ...base, access: 'WALK' })).toBeNull();
    });
});

describe('fetchCarMeasure', () => {
    it('mesure la voiture en one-to-many avec la distance', async () => {
        const { urls } = stub(() => Response.json([{ duration: 469, distance: 4303.8 }]));
        expect(await fetchCarMeasure(MOTIS, origin, destination)).toEqual({ distanceMeters: 4303.8, durationSeconds: 469 });
        expect(urls[0].pathname).toBe('/api/v1/one-to-many');
        expect(urls[0].searchParams.get('mode')).toBe('CAR');
        expect(urls[0].searchParams.get('one')).toBe('45.7578;4.832');
        expect(urls[0].searchParams.get('withDistance')).toBe('true');
    });

    it('rend null pour un point inaccessible en voiture', async () => {
        stub(() => Response.json([]));
        expect(await fetchCarMeasure(MOTIS, origin, destination)).toBeNull();
    });
});

describe('decodePolyline', () => {
    it('décode un tracé Google à la précision annoncée', () => {
        // Exemple de référence de l'algorithme Google, précision 5.
        expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5)).toEqual([
            [38.5, -120.2],
            [40.7, -120.95],
            [43.252, -126.453],
        ]);
    });
});
