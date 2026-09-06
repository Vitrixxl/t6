// Une seule recherche, des modes explicitement autorisés et l’attente initiale incluse.
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import type { RouteSearchRequest } from '../../../src/contracts/planning.ts';
import { loadConfig } from '../config/index.ts';
import { searchRouteOptions } from '../services/planning.ts';
import { recoverRentalArrival } from '../services/motis/arrival.ts';
import { fetchPlan } from '../services/motis/client.ts';
import { fastestItinerary, toRouteOption } from '../services/motis/options.ts';

let network: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;
beforeEach(() => { network = spyOn(globalThis, 'fetch'); });
const MOTIS = 'http://motis:8080';
const transitPlan = await Bun.file(new URL('./fixtures/motis-plan-transit.json', import.meta.url)).json();
const rentalPlan = await Bun.file(new URL('./fixtures/motis-plan-rental.json', import.meta.url)).json();
const search: RouteSearchRequest = {
    origin: { lat: 45.7578, lon: 4.832, label: 'Bellecour' },
    destination: { lat: 45.7606, lon: 4.8594, label: 'Part-Dieu' },
    modes: ['bike', 'scooter', 'transit'], accessibilityNeed: false,
    transitTypes: [0, 1, 3, 7], departureAt: '2022-04-20T08:00:00+02:00',
};
function stubMotis(plan: unknown = transitPlan, car = true) {
    const urls: URL[] = [];
    network.mockImplementation(Object.assign(async (input: Parameters<typeof fetch>[0]) => {
        const url = new URL(String(input));
        urls.push(url);
        return Response.json(url.pathname === '/api/v1/one-to-many'
            ? car ? [{ duration: 469, distance: 4303.8 }] : [] : plan);
    }, { preconnect: fetch.preconnect }));
    return urls;
}
afterEach(() => network.mockRestore());

async function itineraries(plan: unknown) {
    stubMotis(plan);
    const result = await fetchPlan(MOTIS, {
        from: search.origin, to: search.destination, departureAt: '2022-04-20T08:00:00+02:00',
        transitModes: ['SUBWAY', 'TRAM'], rentalFormFactors: ['BICYCLE'], wheelchair: false,
    });
    if (!result) throw new Error('Fixture MOTIS invalide');
    return result;
}

describe('searchRouteOptions', () => {
    it('rend toutes les variantes autorisées par arrivée, avec des identifiants distincts et une référence commune', async () => {
        const [transit] = await itineraries(transitPlan);
        const early = { ...transit, endTime: '2022-04-20T06:20:00Z', duration: 1200 };
        const late = { ...transit, endTime: '2022-04-20T06:22:00Z', duration: 600 };
        const walk = { ...transit, endTime: '2022-04-20T06:30:00Z', duration: 1800, legs: [{ ...transit.legs[0], mode: 'WALK' }] };
        const cancelled = { ...early, legs: [{ ...early.legs[0], cancelled: true }] };
        const denied = { ...early, legs: [{ ...early.legs[0], mode: 'CAR' }] };
        const urls = stubMotis({ direct: [walk], itineraries: [late, cancelled, early, denied, early] });
        const options = await searchRouteOptions({ ...search, modes: ['transit'] }, MOTIS, { sharedMobility: true, transit: true });
        expect(options.map(option => option.arrivalAt)).toEqual([early.endTime, late.endTime, walk.endTime]);
        expect(options.map(option => option.durationMinutes)).toEqual([20, 22, 30]);
        expect(new Set(options.map(option => option.id)).size).toBe(3);
        expect(options[0].title).toBe(options[1].title);
        expect(options.every(option => option.carbonReference?.distanceKm === 4.3038)).toBe(true);
        expect(options.every(option => option.carbonSavedGrams === 611 - option.carbonGrams)).toBe(true);
        expect(urls.filter(url => url.pathname === '/api/v1/one-to-many')).toHaveLength(1);
        stubMotis({ direct: [walk], itineraries: [early, late] });
        const reordered = await searchRouteOptions({ ...search, modes: ['transit'] }, MOTIS, { sharedMobility: true, transit: true });
        expect(reordered.map(option => option.id)).toEqual(options.map(option => option.id));
    });

    it('demande un seul plan avec tous les moyens et une référence voiture', async () => {
        const urls = stubMotis();
        const [route] = await searchRouteOptions(search, MOTIS, { sharedMobility: true, transit: true });
        const plans = urls.filter(url => url.pathname === '/api/v6/plan');
        expect(plans).toHaveLength(1);
        expect(plans[0].searchParams.get('preTransitModes')).toBe('WALK,RENTAL');
        expect(plans[0].searchParams.get('preTransitRentalFormFactors')).toBe('BICYCLE,SCOOTER_STANDING');
        expect(plans[0].searchParams.get('postTransitRentalFormFactors')).toBe('BICYCLE,SCOOTER_STANDING');
        expect(plans[0].searchParams.get('transitModes')).toBe('TRAM,SUBWAY,BUS,FUNICULAR');
        expect(urls.filter(url => url.pathname === '/api/v1/one-to-many')).toHaveLength(1);
        expect(route?.carbonReference?.distanceKm).toBe(4.3038);
        expect(route?.carbonSavedGrams).toBe(611 - (route?.carbonGrams ?? 0));
    });

    it('respecte la marche seule, les types demandés et le profil fauteuil', async () => {
        let urls = stubMotis();
        expect(await searchRouteOptions({ ...search, modes: [] }, MOTIS, { sharedMobility: true, transit: true })).toEqual([]);
        expect(urls[1].searchParams.get('directModes')).toBe('WALK');
        urls = stubMotis();
        await searchRouteOptions({ ...search, accessibilityNeed: true, transitTypes: [1] }, MOTIS, { sharedMobility: true, transit: true });
        expect(urls[1].searchParams.get('pedestrianProfile')).toBe('WHEELCHAIR');
        expect(urls[1].searchParams.get('directModes')).toBe('WALK');
        expect(urls[1].searchParams.get('transitModes')).toBe('SUBWAY');
    });

    it('exclut les engins quand le flux GBFS est indisponible', async () => {
        const urls = stubMotis(rentalPlan);
        const [route] = await searchRouteOptions(search, MOTIS, { sharedMobility: false, transit: true });
        expect(urls[1].searchParams.get('directModes')).toBe('WALK');
        expect(urls[1].searchParams.has('directRentalFormFactors')).toBe(false);
        expect(route?.modes.includes('bike') ?? false).toBe(false);
        expect(route?.modes.includes('scooter') ?? false).toBe(false);
    });

    it('désactive les horaires par défaut et exclut les transports sans archive', async () => {
        expect(loadConfig({}).motisTransitEnabled).toBe(false);
        expect(loadConfig({ MOTIS_TRANSIT_ENABLED: 'true' }).motisTransitEnabled).toBe(true);
        const urls = stubMotis(transitPlan);
        expect(await searchRouteOptions(search, MOTIS, { sharedMobility: true, transit: false })).toEqual([]);
        expect(urls[1].searchParams.get('transitModes')).toBe('');
        expect(urls[1].searchParams.get('directModes')).toBe('WALK,RENTAL');
        expect(urls[1].searchParams.has('maxTravelTime')).toBe(false);
    });

    it('ne propose aucun segment public sans accessibilité déclarée au profil PMR', async () => {
        const plans = await itineraries(transitPlan);
        const denied = plans.map(plan => ({ ...plan, legs: plan.legs.map(leg => ({ ...leg, wheelchairAccessible: 'NOT_ACCESSIBLE' })) }));
        stubMotis({ direct: [], itineraries: denied });
        expect(await searchRouteOptions({ ...search, accessibilityNeed: true }, MOTIS, { sharedMobility: true, transit: true })).toEqual([]);
    });

    it('garde la comparaison indisponible si la mesure voiture échoue', async () => {
        stubMotis(transitPlan, false);
        const [route] = await searchRouteOptions(search, MOTIS, { sharedMobility: true, transit: true });
        expect(route?.carbonReference).toBeNull();
        expect(route?.carbonSavedGrams).toBeNull();
    });

    it('ne fabrique aucun trajet quand le moteur tombe', async () => {
        network.mockRejectedValue(new Error('Panne MOTIS'));
        expect(await searchRouteOptions(search, MOTIS, { sharedMobility: true, transit: true })).toEqual([]);
    });
});

describe('choix et traduction', () => {
    it('compare directs et transports par arrivée, attente initiale comprise', async () => {
        const [first] = await itineraries(transitPlan);
        const late = { ...first, startTime: '2022-04-20T06:12:00Z', endTime: '2022-04-20T06:22:00Z', duration: 600 };
        const early = { ...first, startTime: '2022-04-20T06:00:00Z', endTime: '2022-04-20T06:20:00Z', duration: 1200 };
        expect(fastestItinerary([late, early])).toBe(early);
        expect(toRouteOption(late, { ...search, departureAt: '2022-04-20T06:00:00Z' }).durationMinutes).toBe(22);
        expect(fastestItinerary([])).toBeNull();
        const unsupported = { ...early, legs: [{ ...early.legs[0], mode: 'CAR' }] };
        expect(fastestItinerary([unsupported, late])).toBe(late);
    });

    it('conserve lignes, correspondances et facteurs sans dessiner les droites du GTFS sans shapes', async () => {
        const plans = await itineraries(transitPlan);
        const best = fastestItinerary(plans);
        if (!best) throw new Error('Trajet absent');
        const route = toRouteOption(best, { ...search, departureAt: '2022-04-20T06:00:00Z' });
        expect(route.legs[1].mapLabel).toBe('Métro D');
        expect(route.legs[1].mapColor).toBe('#009e3d');
        expect(route.legs[2].transfer).toBe(true);
        expect(route.legs[0].from).toBe('Bellecour');
        expect(route.legs.at(-1)?.to).toBe('Part-Dieu');
        expect(route.legs.filter(leg => leg.mode !== 'transit').every(leg => leg.path.length >= 2)).toBe(true);
        expect(route.legs.filter(leg => leg.mode === 'transit').every(leg => leg.path.length === 0)).toBe(true);
        expect(route.legs[1].detail).toContain('distance et bilan carbone estimés');
        expect(route.summary).toBe('Métro D puis Tram T1, 1 correspondance.');
        const extendedBus = toRouteOption({ ...best, legs: [{ ...best.legs[1], mode: 'BUS', routeShortName: 'TB11', routeType: 702 }] }, { ...search, departureAt: '2022-04-20T06:00:00Z' });
        expect(extendedBus.legs[0].mapLabel).toBe('Bus TB11');
        expect(extendedBus.legs[0].estimate.carbonGramsPerKm).toBe(122);
        const rentals = await itineraries(rentalPlan);
        const bike = toRouteOption(rentals[0], { ...search, departureAt: '2022-04-20T06:00:00Z' });
        expect(bike.legs[1].title).toBe('Vélo Vélov');
        expect(bike.accessible).toBe(false);
        expect(bike.legs[1].carbonGrams).toBe(Math.round(bike.legs[1].distanceKm * 4));
    });
});


describe('arrivée piétonne après une location', () => {
    it('écarte les segments annulés et les locations sans véhicule identifié', async () => {
        const [route] = await itineraries(rentalPlan);
        for (const changed of [
            { ...route.legs[1], cancelled: true },
            { ...route.legs[1], to: { ...route.legs[1].to, cancelled: true } },
            { ...route.legs[1], rental: undefined },
        ]) {
            expect(fastestItinerary([{ ...route, legs: [changed] }])).toBeNull();
        }
    });

    it('mesure la fin à pied et conserve la dépose réelle, sans changer la destination', async () => {
        const [rental] = await itineraries(rentalPlan);
        const street = { ...rental.legs[1], mode: 'WALK', rental: undefined };
        const walk = { ...rental, legs: [street], duration: 3000 };
        const finish = { ...walk, duration: 180, legs: [{ ...street, duration: 180, from: { ...street.from, name: 'START' }, to: { ...street.to, name: 'END' } }] };
        network.mockImplementation(Object.assign(async (input: Parameters<typeof fetch>[0]) => {
            const url = new URL(String(input));
            return Response.json({ direct: [url.searchParams.get('directModes') === 'WALK' ? finish : rental], itineraries: [] });
        }, { preconnect: fetch.preconnect }));
        const query = { from: search.origin, to: search.destination, departureAt: search.departureAt ?? '', transitModes: [], rentalFormFactors: ['BICYCLE' as const], wheelchair: false };
        const recovered = await recoverRentalArrival(MOTIS, query, [walk]);
        expect(recovered).toHaveLength(1);
        expect(recovered[0].duration).toBe(rental.duration + 180);
        expect(Date.parse(recovered[0].endTime)).toBe(Date.parse(rental.endTime) + 180000);
        expect(recovered[0].legs[1].rental).toEqual(rental.legs[1].rental);
        expect(recovered[0].legs.at(-1)?.to.name).toBe('END');
        expect(recovered[0].legs.at(-1)?.from.name).toBe('Accès piéton à l’arrivée');
        network.mockClear();
        expect(await recoverRentalArrival(MOTIS, query, [rental, walk])).toEqual([]);
        expect(network).not.toHaveBeenCalled();
        expect(await recoverRentalArrival(MOTIS, { ...query, rentalFormFactors: [] }, [walk])).toEqual([]);
        expect(network).not.toHaveBeenCalled();
        network.mockResolvedValue(Response.json({ direct: [] }));
        expect(await recoverRentalArrival(MOTIS, query, [walk])).toEqual([]);
    });
});
