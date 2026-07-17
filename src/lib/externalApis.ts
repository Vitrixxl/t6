import type { GeoPoint, MobilityMode, RouteInstruction, RouteOption } from '../types';

// Delai maximal par requete reseau: en mobilite a connectivite variable, une
// requete qui pend est pire qu'une requete qui echoue vite (le fallback prend
// le relais). On combine le timeout avec le signal d'annulation eventuel.
const NETWORK_TIMEOUT_MS = 8000;

function withTimeout(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(NETWORK_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export interface PlaceSearchResult extends GeoPoint {
  id: string;
  context: string;
  source: 'api-adresse' | 'local';
}

interface AdresseFeature {
  type: 'Feature';
  properties: {
    id?: string;
    label: string;
    context?: string;
    name?: string;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
}

interface AdresseResponse {
  features: AdresseFeature[];
}

interface OsrmRouteResponse {
  code: string;
  routes: Array<{
    distance: number;
    duration: number;
    geometry: {
      type: 'LineString';
      coordinates: [number, number][];
    };
    legs?: Array<{
      steps?: OsrmStep[];
    }>;
  }>;
}

interface OsrmStep {
  distance: number;
  duration: number;
  name: string;
  maneuver: {
    type: string;
    modifier?: string;
    exit?: number;
  };
}

const LIVE_EMISSIONS_G_PER_KM: Record<MobilityMode | 'privateCar', number> = {
  walk: 0,
  bike: 4,
  scooter: 15,
  transit: 55,
  carpool: 85,
  privateCar: 180,
};

export async function searchPlaces(query: string, origin?: GeoPoint, signal?: AbortSignal): Promise<PlaceSearchResult[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) {
    return [];
  }

  const params = new URLSearchParams({
    q: trimmedQuery,
    limit: '7',
    autocomplete: '1',
  });

  if (origin) {
    params.set('lat', String(origin.lat));
    params.set('lon', String(origin.lon));
  }

  const response = await fetch(`https://api-adresse.data.gouv.fr/search/?${params.toString()}`, {
    signal: withTimeout(signal),
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Recherche adresse indisponible (${response.status})`);
  }

  const payload = (await response.json()) as AdresseResponse;
  return payload.features.map((feature, index) => ({
    id: feature.properties.id ?? `${feature.properties.label}-${index}`,
    label: feature.properties.label,
    context: feature.properties.context ?? '',
    lon: feature.geometry.coordinates[0],
    lat: feature.geometry.coordinates[1],
    source: 'api-adresse',
  }));
}

export async function enhanceRoutesWithLiveRouting(
  routes: RouteOption[],
  origin: GeoPoint,
  destination: GeoPoint,
  signal?: AbortSignal,
): Promise<RouteOption[]> {
  const enhancedRoutes = await Promise.all(
    routes.map(async (routeOption) => {
      const geometry = await fetchRouteGeometry(routeOption.modes[routeOption.modes.length - 1], origin, destination, signal);
      if (!geometry) {
        return routeOption;
      }
      const distanceKm = round(geometry.distanceMeters / 1000, 2);
      const durationMinutes = Math.max(Math.round(geometry.durationSeconds / 60), 1);
      const carbonGrams = estimateLiveCarbon(routeOption, distanceKm);
      const carbonSavedGrams = Math.max(Math.round(distanceKm * LIVE_EMISSIONS_G_PER_KM.privateCar - carbonGrams), 0);

      return {
        ...routeOption,
        path: geometry.path,
        distanceKm,
        durationMinutes,
        carbonGrams,
        carbonSavedGrams,
        score: scoreLiveRoute(routeOption, durationMinutes, carbonGrams),
        instructions: geometry.instructions.length > 0 ? geometry.instructions : routeOption.instructions,
      };
    }),
  );

  return enhancedRoutes;
}

// Le CO2 par leg est calcule par routePlanner selon le facteur de chaque mode.
// L'enrichissement live ne recalcule pas tout au facteur du mode dominant (ce qui
// gonflerait un trajet velo+metro comme du 100 % metro) : il conserve l'intensite
// carbone moyenne de l'option d'origine (g/km) et l'applique a la distance reelle.
function estimateLiveCarbon(routeOption: RouteOption, distanceKm: number): number {
  const baseDistanceKm = routeOption.distanceKm > 0 ? routeOption.distanceKm : distanceKm;
  const carbonIntensityPerKm = baseDistanceKm > 0 ? routeOption.carbonGrams / baseDistanceKm : 0;
  return Math.round(distanceKm * carbonIntensityPerKm);
}

function scoreLiveRoute(routeOption: RouteOption, durationMinutes: number, carbonGrams: number): number {
  const additionalTimePenalty = Math.max(durationMinutes - routeOption.durationMinutes, 0) * 0.85;
  const additionalCarbonPenalty = Math.max(carbonGrams - routeOption.carbonGrams, 0) / 55;
  return clampScore(routeOption.score - additionalTimePenalty - additionalCarbonPenalty);
}

function clampScore(value: number): number {
  return Math.min(Math.max(Math.round(value), 0), 100);
}

async function fetchRouteGeometry(
  mode: MobilityMode,
  origin: GeoPoint,
  destination: GeoPoint,
  signal?: AbortSignal,
): Promise<{ path: GeoPoint[]; distanceMeters: number; durationSeconds: number; instructions: RouteInstruction[] } | null> {
  const endpoint = getOsrmEndpoint(mode);
  const coordinates = `${origin.lon},${origin.lat};${destination.lon},${destination.lat}`;
  const url = `${endpoint}${coordinates}?overview=full&geometries=geojson&steps=true`;

  try {
    const response = await fetch(url, {
      signal: withTimeout(signal),
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as OsrmRouteResponse;
    const route = payload.routes[0];
    if (payload.code !== 'Ok' || !route) {
      return null;
    }

    return {
      path: route.geometry.coordinates.map(([lon, lat], index) => ({
        lon,
        lat,
        label: index === 0 ? origin.label : index === route.geometry.coordinates.length - 1 ? destination.label : 'Trace route',
      })),
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      instructions: buildInstructions(route.legs?.flatMap((leg) => leg.steps ?? []) ?? []),
    };
  } catch {
    return null;
  }
}

function buildInstructions(steps: OsrmStep[]): RouteInstruction[] {
  return steps
    .filter((step) => step.distance > 8)
    .slice(0, 8)
    .map((step) => ({
      text: formatManeuver(step),
      distanceMeters: Math.round(step.distance),
      detail: step.name ? `sur ${step.name}` : undefined,
      kind: instructionKind(step.maneuver.type),
    }));
}

function formatManeuver(step: OsrmStep): string {
  const { type, modifier, exit } = step.maneuver;
  const road = step.name ? ` sur ${step.name}` : '';

  if (type === 'depart') {
    return `Partir${road}`;
  }
  if (type === 'arrive') {
    return 'Arriver a destination';
  }
  if (type === 'roundabout' || type === 'rotary') {
    return `Prendre la ${formatOrdinal(exit ?? 1)} sortie${road}`;
  }
  if (type === 'new name') {
    return `Continuer${road}`;
  }
  if (type === 'merge') {
    return `S'inserer${road}`;
  }
  if (type === 'on ramp') {
    return `Prendre la bretelle${road}`;
  }
  if (type === 'off ramp') {
    return `Sortir${road}`;
  }

  const turn = formatModifier(modifier);
  return `${turn}${road}`;
}

function formatModifier(modifier?: string): string {
  switch (modifier) {
    case 'left':
      return 'Tourner a gauche';
    case 'right':
      return 'Tourner a droite';
    case 'slight left':
      return 'Legerement a gauche';
    case 'slight right':
      return 'Legerement a droite';
    case 'sharp left':
      return 'Prendre franchement a gauche';
    case 'sharp right':
      return 'Prendre franchement a droite';
    case 'uturn':
      return 'Faire demi-tour';
    case 'straight':
      return 'Continuer tout droit';
    default:
      return 'Continuer';
  }
}

function formatOrdinal(value: number): string {
  if (value === 1) return '1ere';
  return `${value}e`;
}

function instructionKind(type: string): RouteInstruction['kind'] {
  if (type === 'roundabout' || type === 'rotary') return 'roundabout';
  if (type === 'depart') return 'depart';
  if (type === 'arrive') return 'arrive';
  if (type === 'turn' || type === 'new name' || type === 'merge' || type === 'on ramp' || type === 'off ramp') return 'turn';
  return 'continue';
}

function getOsrmEndpoint(mode: MobilityMode): string {
  if (mode === 'walk') {
    return 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/';
  }
  if (mode === 'bike' || mode === 'scooter') {
    return 'https://routing.openstreetmap.de/routed-bike/route/v1/bike/';
  }
  return 'https://routing.openstreetmap.de/routed-car/route/v1/driving/';
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
