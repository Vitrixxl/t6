// Tests de la recherche d'itinéraires : les réponses MOTIS enregistrées sont
// traduites en options par famille, classées et comparées à la voiture.
import { afterEach, describe, expect, it } from 'bun:test';
import { DEFAULT_PROFILE } from '../../../src/contracts/profile.ts';
import { searchRoutes } from '../services/planning.ts';

const realFetch = globalThis.fetch;
const MOTIS = 'http://motis:8080';
const transitPlan = await Bun.file(new URL('./fixtures/motis-plan-transit.json', import.meta.url)).json();
const rentalPlan = await Bun.file(new URL('./fixtures/motis-plan-rental.json', import.meta.url)).json();

const search = {
    origin: { lat: 45.7578, lon: 4.832, label: 'Bellecour' },
    destination: { lat: 45.7606, lon: 4.8594, label: 'Part-Dieu' },
    profile: DEFAULT_PROFILE,
    transitTypes: [0, 1, 3, 7] as Array<0 | 1 | 3 | 7>,
    sharedMobilityAvailable: true,
    departureAt: '2022-04-20T08:00:00+02:00',
};

/** MOTIS enregistré : le plan à pied, le plan vélo pour tout engin, la voiture en one-to-many. */
function stubMotis(options: { car?: boolean } = {}): { urls: URL[] } {
    const urls: URL[] = [];
    globalThis.fetch = (async (input: Parameters<typeof globalThis.fetch>[0]) => {
        const url = new URL(String(input));
        urls.push(url);
        if (url.pathname === '/api/v1/one-to-many') {
            return Response.json(options.car === false ? [] : [{ duration: 469, distance: 4303.8 }]);
        }
        return Response.json(url.searchParams.get('preTransitModes') === 'RENTAL' ? rentalPlan : transitPlan);
    }) as unknown as typeof fetch;
    return { urls };
}

afterEach(() => {
    globalThis.fetch = realFetch;
});

describe('searchRoutes', () => {
    it('demande un plan par moyen d’accès et la référence voiture', async () => {
        const { urls } = stubMotis();
        await searchRoutes(search, MOTIS);
        const plans = urls.filter((url) => url.pathname === '/api/v6/plan');
        expect(plans.map((url) => url.searchParams.get('preTransitRentalFormFactors'))).toEqual([null, 'BICYCLE', 'SCOOTER_STANDING']);
        expect(plans[0].searchParams.get('transitModes')).toBe('TRAM,SUBWAY,BUS,FUNICULAR');
        expect(plans[0].searchParams.get('time')).toBe(search.departureAt);
        expect(urls.filter((url) => url.pathname === '/api/v1/one-to-many')).toHaveLength(1);
    });

    it('ne demande que l’accès à pied sans disponibilités partagées', async () => {
        const { urls } = stubMotis();
        const options = await searchRoutes({ ...search, sharedMobilityAvailable: false }, MOTIS);
        expect(urls.filter((url) => url.pathname === '/api/v6/plan')).toHaveLength(1);
        expect(options.every((option) => !option.modes.includes('bike') && !option.modes.includes('scooter'))).toBe(true);
    });

    it('garde la plus rapide de chaque famille et jusqu’à trois variantes de transport', async () => {
        stubMotis();
        const options = await searchRoutes(search, MOTIS);
        const families = options.map((option) => option.id.replace(/-\d+$/, ''));
        expect(new Set(families)).toEqual(new Set(['transit', 'bike', 'scooter-transit']));
        expect(families.filter((family) => family === 'transit').length).toBeLessThanOrEqual(3);
        // Deux variantes de transport ne partagent jamais la même suite de lignes.
        const lines = options.filter((option) => option.id.startsWith('transit-')).map((option) => option.summary);
        expect(new Set(lines).size).toBe(lines.length);
        expect(options.map((option) => option.durationMinutes)).toEqual([...options.map((option) => option.durationMinutes)].sort((a, b) => a - b));
    });

    it('traduit les segments : lignes, correspondances, tracés, engins et carbone', async () => {
        stubMotis();
        const options = await searchRoutes(search, MOTIS);
        const transit = options.find((option) => option.id === 'transit-0')!;
        expect(transit.title).toBe('Transport en commun');
        expect(transit.modes).toEqual(['walk', 'transit']);
        expect(transit.legs.map((leg) => leg.mode)).toEqual(['walk', 'transit', 'walk', 'transit', 'walk']);
        expect(transit.legs[1].mapLabel).toBe('Métro D');
        expect(transit.legs[1].mapColor).toBe('#009e3d');
        expect(transit.legs[1].detail).toContain('Métro D direction');
        expect(transit.legs[2].transfer).toBe(true);
        expect(transit.legs[0].from).toBe('Bellecour');
        expect(transit.legs[4].to).toBe('Part-Dieu');
        expect(transit.legs.every((leg) => leg.path.length >= 2)).toBe(true);
        expect(transit.path.length).toBeGreaterThan(transit.legs[0].path.length);
        // La durée d'une option comprend les attentes, absentes des segments.
        expect(transit.durationMinutes).toBe(25);
        expect(transit.summary).toBe('Métro D puis Tram T1, 1 correspondance.');

        const bike = options.find((option) => option.id === 'bike-0')!;
        expect(bike.modes).toEqual(['walk', 'bike']);
        expect(bike.legs[1].title).toBe('Vélo Vélov');
        expect(bike.legs[1].carbonGrams).toBe(Math.round(bike.legs[1].distanceKm * 4));
        expect(bike.legs[1].detail).toContain('PLACE ANTONIN PONCET');

        const feeder = options.find((option) => option.id === 'scooter-transit-0')!;
        expect(feeder.modes).toEqual(['walk', 'scooter', 'transit']);
        expect(feeder.legs[1].detail).toBe('Prise à Rue Emile Zola/Pl. Bellecour, dépose à 16 rue Mazenod/Cr de la Liberté.');
    });

    it('applique la même référence voiture à toutes les options, ou aucune', async () => {
        stubMotis();
        const compared = await searchRoutes(search, MOTIS);
        expect(compared.every((option) => option.carbonReference?.distanceKm === 4.3038)).toBe(true);
        expect(compared.every((option) => option.carbonSavedGrams === 611 - option.carbonGrams)).toBe(true);

        stubMotis({ car: false });
        const alone = await searchRoutes(search, MOTIS);
        expect(alone.every((option) => option.carbonReference === null && option.carbonSavedGrams === null)).toBe(true);
    });

    it('rend une liste vide quand MOTIS ne répond pas', async () => {
        globalThis.fetch = (async () => { throw new Error('Panne MOTIS'); }) as unknown as typeof fetch;
        expect(await searchRoutes(search, MOTIS)).toEqual([]);
    });
});
