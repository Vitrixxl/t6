import { afterEach, beforeEach, expect, it, spyOn } from 'bun:test';
import { createTestApi } from './helpers';
import { stopCollection, transportContext, nearbyStops } from '../../../src/contracts/transport';
import { createTransportRepository } from '../repositories/transport';
import { routeOptions } from '../../../src/contracts/planning';
import { DEFAULT_PROFILE } from '../../../src/contracts/profile';

let api: ReturnType<typeof createTestApi>;
let network: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;
beforeEach(() => {
    api = createTestApi();
    network = spyOn(globalThis, 'fetch');
    network.mockRejectedValue(new Error('Flux indisponible'));
});
afterEach(() => { network.mockRestore(); api.close(); });

it('sert seulement les quais de la cellule, avec moins de données que le réseau complet', async () => {
    const response = await api.call('/api/transport/stops?x=96&y=915&version=test');
    expect(response.status).toBe(200);
    const text = await response.text();
    const data = stopCollection.parse(JSON.parse(text));
    expect(data.stops.length).toBeGreaterThan(0);
    for (const stop of data.stops) {
        expect(stop.stop_lon).toBeGreaterThanOrEqual(4.8);
        expect(stop.stop_lon).toBeLessThan(4.85);
        expect(stop.stop_lat).toBeGreaterThanOrEqual(45.75);
        expect(stop.stop_lat).toBeLessThan(45.8);
    }
    expect(text.length).toBeLessThan(100_000);
    expect(text).not.toContain('shape');
    expect(network).not.toHaveBeenCalled();
});

it('refuse une cellule invalide et retourne une vraie collection vide hors réseau', async () => {
    expect((await api.call('/api/transport/stops?x=1.5&y=915&version=test')).status).toBe(422);
    const response = await api.call('/api/transport/stops?x=0&y=0&version=test');
    expect(await response.json()).toEqual({ stops: [] });
});

it('maintient les limites exactes et l’index spatial lors d’un nouvel import', async () => {
    const repository = createTransportRepository(api.db);
    const feed = repository.readNetwork();
    const first = feed.stops[0];
    api.db.transaction(tx => createTransportRepository(tx).importNetwork({ ...feed, stops: [
        { ...first, stop_id: 'west', stop_lat: 45.76, stop_lon: 4.8 },
        { ...first, stop_id: 'east', stop_lat: 45.76, stop_lon: 4.85 },
    ] }, 'test'));
    const bounds = { west: 4.8, east: 4.85, south: 45.75, north: 45.8 };
    expect(repository.stopsInBounds(bounds).map(stop => stop.stop_id)).toEqual(['west']);
    const left = stopCollection.parse(await (await api.call('/api/transport/stops?x=96&y=915&version=test')).json());
    const right = stopCollection.parse(await (await api.call('/api/transport/stops?x=97&y=915&version=test')).json());
    expect(left.stops.map(stop => stop.stop_id)).toEqual(['west']);
    expect(right.stops.map(stop => stop.stop_id)).toEqual(['east']);
    api.db.transaction(tx => createTransportRepository(tx).importNetwork({ ...feed, stops: [] }, 'empty'));
    expect(repository.stopsInBounds(bounds)).toEqual([]);
});

it('ne publie aucun réseau complet dans le contexte et mutualise les appels en panne', async () => {
    const responses = await Promise.all([api.call('/api/transport/context'), api.call('/api/transport/context')]);
    const payload = await responses[0].json();
    const context = transportContext.parse(payload);
    expect(context.stopCount).toBe(createTransportRepository(api.db).readNetwork().stops.length);
    expect(context.sharedMobility).toBeNull();
    expect(payload).not.toHaveProperty('gtfs');
    expect(payload).not.toHaveProperty('stops');
    expect(network).toHaveBeenCalledTimes(3);
    expect(transportContext.parse(await responses[1].json()).version).toBe(context.version);
});

it('renvoie le vrai nombre d’arrêts proches même si quatre seulement sont listés', async () => {
    const result = nearbyStops.parse(await (await api.call('/api/transport/nearby-stops?lat=45.7578&lon=4.832&radiusKm=2')).json());
    expect(result.count).toBeGreaterThan(4);
    expect(result.items).toHaveLength(4);
    expect(result.items.every(entry => entry.distanceKm <= 2)).toBe(true);
    expect(result.items.map(entry => entry.distanceKm)).toEqual(result.items.map(entry => entry.distanceKm).sort((a, b) => a - b));
});

function osrmResponse(input: Parameters<typeof fetch>[0]) {
    const url = new URL(String(input));
    if (!url.hostname.startsWith('osrm-')) return Response.json({}, { status: 503 });
    if (url.pathname.includes('/table/')) {
        const count = url.searchParams.get('sources')!.split(';').length;
        const targets = url.searchParams.get('destinations')!.split(';').length;
        return Response.json({ code: 'Ok', distances: Array.from({ length: count }, () => Array(targets).fill(100)), durations: Array.from({ length: count }, () => Array(targets).fill(60)) });
    }
    const coordinates = url.pathname.split('/').at(-1)!.split(';').map(pair => pair.split(',').map(Number));
    return Response.json({ code: 'Ok', routes: [{ distance: 1000, duration: 600, geometry: { type: 'LineString', coordinates }, legs: [{ steps: [] }] }] });
}

it('calcule le bus hors du cadrage sans télécharger le réseau et garde la même référence voiture', async () => {
    network.mockImplementation(Object.assign(async (input: Parameters<typeof fetch>[0]) => osrmResponse(input), { preconnect: globalThis.fetch.preconnect }));
    const feed = createTransportRepository(api.db).readNetwork();
    const bus = feed.routes.find(route => route.route_short_name === 'TB11' && route.route_long_name.startsWith('Gare Saint-Paul'))!;
    const from = feed.stops.find(stop => stop.stop_id === bus.stopSequence?.[0])!;
    const to = feed.stops.find(stop => stop.stop_id === bus.stopSequence?.at(-1))!;
    const response = await api.call('/api/transport/journeys', { body: {
        origin: { lat: from.stop_lat, lon: from.stop_lon, label: from.stop_name },
        destination: { lat: to.stop_lat, lon: to.stop_lon, label: to.stop_name },
        profile: DEFAULT_PROFILE, transitTypes: [3], sharedMobilityAvailable: false,
    } });
    expect(response.status).toBe(200);
    const options = routeOptions.parse(await response.json());
    expect(options.some(option => option.legs.some(leg => leg.mapLabel?.includes('TB11')))).toBe(true);
    expect(options.every(option => !option.modes.includes('bike') && !option.modes.includes('scooter'))).toBe(true);
    expect(options.map(option => option.durationMinutes)).toEqual(options.map(option => option.durationMinutes).sort((a, b) => a - b));
    expect(options.every(option => option.carbonReference?.distanceKm === options[0].carbonReference?.distanceKm)).toBe(true);
});

it('refuse les recherches invalides et annonce l’absence de mesures OSRM', async () => {
    const search = { origin: { lat: 45.7524835251712, lon: 4.8687553636982, label: 'Départ précis' }, destination: { lat: 45.7548502313005, lon: 4.85748756866509, label: 'Arrivée précise' }, profile: DEFAULT_PROFILE, transitTypes: [0, 1, 3, 7], sharedMobilityAvailable: false };
    expect((await api.call('/api/transport/journeys', { body: { ...search, transitTypes: [99] } })).status).toBe(422);
    expect(network).not.toHaveBeenCalled();
    expect((await api.call('/api/transport/journeys', { body: search })).status).toBe(503);
});

it('ne réutilise pas un ancien flux partagé après une panne à l’expiration du cache', async () => {
    let available = true;
    network.mockImplementation(Object.assign(async (input: Parameters<typeof fetch>[0]) => {
        const url = String(input);
        if (!available) return Response.json({}, { status: 503 });
        if (url.includes('station_information')) return Response.json({ data: { stations: [{ station_id: '1', name: 'Bellecour', lat: 45.7578, lon: 4.832 }] } });
        if (url.includes('station_status')) return Response.json({ data: { stations: [{ station_id: '1', num_vehicles_available: 3, is_installed: true, is_renting: true, is_returning: true, last_reported: 1 }] } });
        if (url.includes('free_bike_status')) return Response.json({ data: { bikes: [] } });
        return Response.json({}, { status: 503 });
    }, { preconnect: globalThis.fetch.preconnect }));
    const clock = spyOn(Date, 'now');
    try {
        clock.mockReturnValue(100_000);
        const first = transportContext.parse(await (await api.call('/api/transport/context')).json());
        expect(first.sharedMobility?.data.stations[0].bikes_available).toBe(3);
        available = false;
        clock.mockReturnValue(161_000);
        const second = transportContext.parse(await (await api.call('/api/transport/context')).json());
        expect(second.sharedMobility).toBeNull();
        expect(network).toHaveBeenCalledTimes(6);
    } finally { clock.mockRestore(); }
});
