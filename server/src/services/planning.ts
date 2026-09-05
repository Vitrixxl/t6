// Le réseau complet reste au serveur : le cadrage de la carte ne limite jamais
// les quais, correspondances et destinations examinés par le moteur.
import type { RouteSearchRequest } from '../../../src/contracts/planning.ts';
import type { RouteLeg } from '../../../src/types.ts';
import { applyCarbonReference, createCarbonReference, measureRoutes, planRoutes, prepareRoutedAccessPlan } from '../../../src/lib/planner/index.ts';
import { filterTransitNetwork } from '../../../src/lib/planner/transit-filter.ts';
import { legDuration } from '../../../src/lib/planner/legs.ts';
import { round } from '../../../src/lib/planner/metrics.ts';
import type { ServerConfig } from '../config/index.ts';
import { fetchOsrmMatrix, fetchOsrmRoute } from './routing/osrm.ts';
import type { TransportService } from './transport/index.ts';

type OsrmUrls = ServerConfig['osrmUrls'];

export async function measureLeg(leg: RouteLeg, osrm: OsrmUrls, signal?: AbortSignal): Promise<RouteLeg> {
    // Le rail porte son tracé publié ; une correspondance intérieure n'est pas routée sur la voirie.
    if (leg.mode === 'transit' || leg.transfer) return leg;
    const geometry = await fetchOsrmRoute(osrm, leg.mode, leg.fromPoint, leg.toPoint, signal);
    if (!geometry || geometry.path.length < 2) return { ...leg, path: [] };
    const distanceKm = round(geometry.distanceMeters / 1000, 2);
    return {
        ...leg,
        path: geometry.path.map(([lon, lat], index) => ({
            lon, lat, label: index === 0 ? leg.from : index === geometry.path.length - 1 ? leg.to : 'Tracé routier',
        })),
        distanceKm,
        durationMinutes: legDuration(geometry.durationSeconds / 60, leg.estimate),
        carbonGrams: Math.round(distanceKm * leg.estimate.carbonGramsPerKm),
    };
}

export async function searchRoutes(search: RouteSearchRequest, transport: TransportService, osrm: OsrmUrls, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const fullNetwork = await transport.network();
    signal?.throwIfAborted();
    const network = filterTransitNetwork({
        ...fullNetwork,
        sharedMobility: search.sharedMobilityAvailable ? fullNetwork.sharedMobility : null,
    }, search.transitTypes);
    const reference = fetchOsrmMatrix(osrm, 'car', [search.origin], [search.destination], signal)
        .then(matrix => createCarbonReference(matrix?.[0]?.[0] ?? null));
    const access = await prepareRoutedAccessPlan({
        origin: search.origin, destination: search.destination, network,
        requireAccessible: search.profile.accessibilityNeed,
    }, (mode, origins, destinations) => fetchOsrmMatrix(osrm, mode, origins, destinations, signal));
    signal?.throwIfAborted();
    const candidates = planRoutes({ ...search, network }, access);
    const measured = await measureRoutes(candidates, search.profile, legs => Promise.all(legs.map(leg => measureLeg(leg, osrm, signal))));
    return applyCarbonReference(measured, await reference);
}
