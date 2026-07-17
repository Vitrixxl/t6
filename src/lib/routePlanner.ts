import type {
  GeoPoint,
  GtfsRoute,
  GtfsStop,
  MobilityMode,
  RouteInstruction,
  RouteLeg,
  RouteOption,
  RouteRequest,
  SharedStation,
} from '../types';

const SPEED_KMH: Record<MobilityMode, number> = {
  walk: 4.6,
  bike: 15,
  scooter: 18,
  transit: 28,
  carpool: 23,
};

const EMISSIONS_G_PER_KM: Record<MobilityMode | 'privateCar', number> = {
  walk: 0,
  bike: 4,
  scooter: 15,
  transit: 55,
  carpool: 85,
  privateCar: 180,
};

const MODE_LABELS: Record<MobilityMode, string> = {
  walk: 'marche',
  bike: 'velo',
  scooter: 'trottinette',
  transit: 'transport public',
  carpool: 'covoiturage',
};

export const LANDMARKS: GeoPoint[] = [
  { label: 'Bellecour', lat: 45.7578, lon: 4.832 },
  { label: 'Part-Dieu', lat: 45.7606, lon: 4.8594 },
  { label: 'Confluence', lat: 45.7406, lon: 4.8194 },
  { label: 'Grange Blanche', lat: 45.7435, lon: 4.8797 },
  { label: 'Vaise', lat: 45.7797, lon: 4.8053 },
];

export function haversineDistanceKm(a: Pick<GeoPoint, 'lat' | 'lon'>, b: Pick<GeoPoint, 'lat' | 'lon'>): number {
  const radiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const value =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * radiusKm * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function planRoutes(request: RouteRequest): RouteOption[] {
  const directKm = Math.max(haversineDistanceKm(request.origin, request.destination), 0.15);
  const candidates = [
    createTransitOption(request, directKm),
    createBikeTransitOption(request, directKm),
    createBikeOption(request, directKm),
    createScooterOption(request, directKm),
    createCarpoolOption(request, directKm),
  ].filter((option): option is RouteOption => Boolean(option));

  return candidates
    .map((option) => scoreOption(option, request.profile.preferredModes, request.profile.accessibilityNeed))
    .sort((a, b) => b.score - a.score);
}

function createTransitOption({ origin, destination, profile, network }: RouteRequest, directKm: number): RouteOption {
  const fromStop = nearestStop(network.gtfs.stops, origin, profile.accessibilityNeed);
  const toStop = nearestStop(network.gtfs.stops, destination, profile.accessibilityNeed);
  const trip = network.gtfs.trips.slice().sort((a, b) => a.headway_minutes - b.headway_minutes)[0];
  const route = network.gtfs.routes.find((item) => item.route_id === trip.route_id) ?? network.gtfs.routes[0];
  const firstWalkKm = haversineDistanceKm(origin, stopToPoint(fromStop));
  const transitKm = Math.max(haversineDistanceKm(stopToPoint(fromStop), stopToPoint(toStop)) * 1.15, directKm * 0.7);
  const lastWalkKm = haversineDistanceKm(stopToPoint(toStop), destination);
  const waitMinutes = Math.ceil(trip.headway_minutes / 2 + trip.realtime_delay_minutes);
  const trafficWarning = network.gtfs.incidents.find((incident) => incident.affected_modes.includes('transit'));
  const legs: RouteLeg[] = [
    createLeg('walk-to-stop', 'walk', 'Approche pietonne', origin.label, fromStop.stop_name, firstWalkKm, true, [
      origin,
      stopToPoint(fromStop),
    ]),
    {
      ...createLeg(
        'transit-core',
        'transit',
        `${routeLabel(route)} vers ${toStop.stop_name}`,
        fromStop.stop_name,
        toStop.stop_name,
        transitKm,
        fromStop.wheelchair_boarding === 1 && toStop.wheelchair_boarding === 1,
        [stopToPoint(fromStop), midpoint(stopToPoint(fromStop), stopToPoint(toStop), 0.012), stopToPoint(toStop)],
      ),
      durationMinutes: minutesForDistance(transitKm, SPEED_KMH.transit) + waitMinutes,
      detail: `Attente estimee ${waitMinutes} min, occupation ${trip.occupancy}.`,
    },
    createLeg('walk-from-stop', 'walk', 'Derniers metres', toStop.stop_name, destination.label, lastWalkKm, true, [
      stopToPoint(toStop),
      destination,
    ]),
  ];

  return buildOption({
    id: 'transit',
    title: 'Metro/tram optimise',
    summary: 'Combine marche courte et transport public GTFS avec delais temps reel.',
    modes: ['walk', 'transit'],
    legs,
    reliabilityScore: trip.realtime_delay_minutes > 2 ? 74 : 88,
    warnings: trafficWarning ? [trafficWarning.message] : [],
  });
}

function createBikeTransitOption({ origin, destination, profile, network }: RouteRequest, directKm: number): RouteOption | null {
  const stations = network.sharedMobility.data.stations.filter(
    (station) => station.is_installed && station.is_renting && station.is_returning && station.bikes_available > 0,
  );
  const fromStation = nearestStation(stations, origin);

  if (!fromStation) {
    return null;
  }

  const boardingStop = nearestStop(network.gtfs.stops, stationToPoint(fromStation), profile.accessibilityNeed);
  const arrivalStop = nearestStop(network.gtfs.stops, destination, profile.accessibilityNeed);
  const trip = network.gtfs.trips.slice().sort((a, b) => a.headway_minutes - b.headway_minutes)[0];
  const route = network.gtfs.routes.find((item) => item.route_id === trip.route_id) ?? network.gtfs.routes[0];
  const firstWalkKm = haversineDistanceKm(origin, stationToPoint(fromStation));
  const bikeKm = Math.max(haversineDistanceKm(stationToPoint(fromStation), stopToPoint(boardingStop)) * 1.2, directKm * 0.22);
  const transitKm = Math.max(haversineDistanceKm(stopToPoint(boardingStop), stopToPoint(arrivalStop)) * 1.12, directKm * 0.5);
  const finalWalkKm = haversineDistanceKm(stopToPoint(arrivalStop), destination);
  const waitMinutes = Math.ceil(trip.headway_minutes / 2 + trip.realtime_delay_minutes);
  const trafficWarning = network.gtfs.incidents.find((incident) => incident.affected_modes.includes('transit'));
  const rainWarning = network.gtfs.weather.condition.includes('rain');
  const legs: RouteLeg[] = [
    createLeg('hybrid-walk-to-bike', 'walk', 'Approche velo', origin.label, fromStation.name, firstWalkKm, true, [
      origin,
      stationToPoint(fromStation),
    ]),
    {
      ...createLeg(
        'hybrid-bike-to-transit',
        'bike',
        'Velo vers correspondance',
        fromStation.name,
        boardingStop.stop_name,
        bikeKm,
        !profile.accessibilityNeed,
        [stationToPoint(fromStation), midpoint(stationToPoint(fromStation), stopToPoint(boardingStop), -0.006), stopToPoint(boardingStop)],
      ),
      durationMinutes: minutesForDistance(bikeKm, SPEED_KMH.bike) + 2,
      detail: `${fromStation.bikes_available} velos disponibles pour rejoindre la correspondance.`,
    },
    {
      ...createLeg(
        'hybrid-transit-core',
        'transit',
        `${routeLabel(route)} vers ${arrivalStop.stop_name}`,
        boardingStop.stop_name,
        arrivalStop.stop_name,
        transitKm,
        boardingStop.wheelchair_boarding === 1 && arrivalStop.wheelchair_boarding === 1,
        [stopToPoint(boardingStop), midpoint(stopToPoint(boardingStop), stopToPoint(arrivalStop), 0.01), stopToPoint(arrivalStop)],
      ),
      durationMinutes: minutesForDistance(transitKm, SPEED_KMH.transit) + waitMinutes,
      detail: `Correspondance estimee ${waitMinutes} min, occupation ${trip.occupancy}.`,
    },
    createLeg('hybrid-walk-from-transit', 'walk', 'Derniers metres', arrivalStop.stop_name, destination.label, finalWalkKm, true, [
      stopToPoint(arrivalStop),
      destination,
    ]),
  ];

  return buildOption({
    id: 'bike-transit',
    title: 'Velo + metro combine',
    summary: 'Combine velo partage, marche courte et transport public pour optimiser la correspondance.',
    modes: ['walk', 'bike', 'transit'],
    legs,
    reliabilityScore: trip.realtime_delay_minutes > 2 || rainWarning ? 78 : 90,
    warnings: [
      ...(trafficWarning ? [trafficWarning.message] : []),
      ...(rainWarning && profile.avoidRain ? ['Pluie legere detectee sur la portion velo.'] : []),
    ],
  });
}

function createBikeOption({ origin, destination, profile, network }: RouteRequest, directKm: number): RouteOption | null {
  const stations = network.sharedMobility.data.stations.filter(
    (station) => station.is_installed && station.is_renting && station.is_returning && station.bikes_available > 0,
  );
  const fromStation = nearestStation(stations, origin);
  const toStation = nearestStation(stations, destination);

  if (!fromStation || !toStation) {
    return null;
  }

  const rainWarning = network.gtfs.weather.condition.includes('rain');
  const firstWalkKm = haversineDistanceKm(origin, stationToPoint(fromStation));
  const bikeKm = Math.max(haversineDistanceKm(stationToPoint(fromStation), stationToPoint(toStation)) * 1.1, directKm);
  const lastWalkKm = haversineDistanceKm(stationToPoint(toStation), destination);
  const legs: RouteLeg[] = [
    createLeg('walk-to-bike', 'walk', 'Rejoindre une station velo', origin.label, fromStation.name, firstWalkKm, true, [
      origin,
      stationToPoint(fromStation),
    ]),
    {
      ...createLeg('bike-core', 'bike', 'Velo partage', fromStation.name, toStation.name, bikeKm, !profile.accessibilityNeed, [
        stationToPoint(fromStation),
        midpoint(stationToPoint(fromStation), stationToPoint(toStation), -0.008),
        stationToPoint(toStation),
      ]),
      durationMinutes: minutesForDistance(bikeKm, SPEED_KMH.bike) + 2,
      detail: `${fromStation.bikes_available} velos disponibles au depart, retour autorise a destination.`,
    },
    createLeg('walk-from-bike', 'walk', 'Fin de trajet', toStation.name, destination.label, lastWalkKm, true, [
      stationToPoint(toStation),
      destination,
    ]),
  ];

  return buildOption({
    id: 'bike',
    title: 'Velo partage bas carbone',
    summary: 'Utilise les disponibilites GBFS locales et minimise les emissions.',
    modes: ['walk', 'bike'],
    legs,
    reliabilityScore: rainWarning ? 71 : 86,
    warnings: rainWarning && profile.avoidRain ? ['Pluie legere detectee, confort degrade pour le velo.'] : [],
  });
}

function createScooterOption({ origin, destination, profile, network }: RouteRequest, directKm: number): RouteOption | null {
  const station = nearestStation(
    network.sharedMobility.data.stations.filter((item) => item.is_renting && item.scooters_available > 0),
    origin,
  );

  if (!station) {
    return null;
  }

  const legs: RouteLeg[] = [
    createLeg(
      'walk-to-scooter',
      'walk',
      'Rejoindre une trottinette',
      origin.label,
      station.name,
      haversineDistanceKm(origin, stationToPoint(station)),
      true,
      [origin, stationToPoint(station)],
    ),
    {
      ...createLeg(
        'scooter-core',
        'scooter',
        'Trottinette partagee',
        station.name,
        destination.label,
        directKm * 1.06,
        !profile.accessibilityNeed,
        [stationToPoint(station), midpoint(stationToPoint(station), destination, 0.006), destination],
      ),
      durationMinutes: minutesForDistance(directKm * 1.06, SPEED_KMH.scooter) + 1,
      detail: `${station.scooters_available} trottinettes disponibles au depart.`,
    },
  ];

  return buildOption({
    id: 'scooter',
    title: 'Trottinette rapide',
    summary: 'Solution directe pour distance courte avec disponibilite temps reel.',
    modes: ['walk', 'scooter'],
    legs,
    reliabilityScore: 80,
    warnings: [],
  });
}

function createCarpoolOption({ origin, destination, network }: RouteRequest, directKm: number): RouteOption {
  const incident = network.gtfs.incidents.find((item) => item.affected_modes.includes('carpool'));
  const trafficFactor = incident ? 1.18 : 1.08;
  const legs: RouteLeg[] = [
    {
      ...createLeg('carpool-core', 'carpool', 'Covoiturage dynamique', origin.label, destination.label, directKm * trafficFactor, true, [
        origin,
        midpoint(origin, destination, 0.018),
        destination,
      ]),
      durationMinutes: minutesForDistance(directKm * trafficFactor, SPEED_KMH.carpool) + 6,
      detail: 'Matching simule avec conducteur compatible et attente moyenne de 6 min.',
    },
  ];

  return buildOption({
    id: 'carpool',
    title: 'Covoiturage dynamique',
    summary: 'Alternative mutualisee si les modes doux sont moins adaptes.',
    modes: ['carpool'],
    legs,
    reliabilityScore: incident ? 68 : 78,
    warnings: incident ? [incident.message] : [],
  });
}

function buildOption(input: {
  id: string;
  title: string;
  summary: string;
  modes: MobilityMode[];
  legs: RouteLeg[];
  reliabilityScore: number;
  warnings: string[];
}): RouteOption {
  const distanceKm = round(input.legs.reduce((sum, leg) => sum + leg.distanceKm, 0), 2);
  const durationMinutes = Math.ceil(input.legs.reduce((sum, leg) => sum + leg.durationMinutes, 0));
  const carbonGrams = Math.round(input.legs.reduce((sum, leg) => sum + leg.carbonGrams, 0));
  const carbonSavedGrams = Math.max(Math.round(distanceKm * EMISSIONS_G_PER_KM.privateCar - carbonGrams), 0);

  return {
    ...input,
    path: mergeLegPaths(input.legs),
    distanceKm,
    durationMinutes,
    carbonGrams,
    carbonSavedGrams,
    accessible: input.legs.every((leg) => leg.accessible),
    instructions: buildFallbackInstructions(input.legs),
    score: 0,
  };
}

function buildFallbackInstructions(legs: RouteLeg[]): RouteInstruction[] {
  const firstLeg = legs.find((leg) => leg.distanceKm > 0.03) ?? legs[0];
  if (!firstLeg) {
    return [];
  }

  if (firstLeg.mode === 'transit') {
    return [
      {
        kind: 'transfer',
        text: `Prendre ${firstLeg.title}`,
        distanceMeters: Math.round(firstLeg.distanceKm * 1000),
        detail: `${firstLeg.from} -> ${firstLeg.to}`,
      },
    ];
  }

  return [
    {
      kind: 'depart',
      text: `Se diriger vers ${firstLeg.to}`,
      distanceMeters: Math.round(firstLeg.distanceKm * 1000),
      detail: firstLeg.detail,
    },
  ];
}

function scoreOption(option: RouteOption, preferredModes: MobilityMode[], accessibilityNeed: boolean): RouteOption {
  const preferenceBonus = option.modes.reduce((sum, mode) => sum + (preferredModes.includes(mode) ? 8 : 0), 0);
  const carbonPenalty = option.carbonGrams / 55;
  const timePenalty = option.durationMinutes * 0.85;
  const accessibilityPenalty = accessibilityNeed && !option.accessible ? 45 : 0;
  const warningPenalty = option.warnings.length * 6;
  const score = Math.round(option.reliabilityScore + preferenceBonus - carbonPenalty - timePenalty - accessibilityPenalty - warningPenalty);

  return {
    ...option,
    score: Math.min(Math.max(score, 0), 100),
  };
}

function createLeg(
  id: string,
  mode: MobilityMode,
  title: string,
  from: string,
  to: string,
  distanceKm: number,
  accessible: boolean,
  path: GeoPoint[],
): RouteLeg {
  const roundedDistance = round(distanceKm, 2);
  return {
    id,
    mode,
    title,
    from,
    to,
    path,
    distanceKm: roundedDistance,
    durationMinutes: minutesForDistance(roundedDistance, SPEED_KMH[mode]),
    carbonGrams: Math.round(roundedDistance * EMISSIONS_G_PER_KM[mode]),
    accessible,
    detail: `${MODE_LABELS[mode]} sur ${roundedDistance.toFixed(2)} km.`,
  };
}

function mergeLegPaths(legs: RouteLeg[]): GeoPoint[] {
  return legs.reduce<GeoPoint[]>((points, leg) => {
    const nextPoints = leg.path;
    if (points.length === 0) {
      return [...nextPoints];
    }

    const firstPoint = nextPoints[0];
    const shouldSkipFirst =
      firstPoint && points[points.length - 1].lat === firstPoint.lat && points[points.length - 1].lon === firstPoint.lon;
    return [...points, ...(shouldSkipFirst ? nextPoints.slice(1) : nextPoints)];
  }, []);
}

function midpoint(a: GeoPoint, b: GeoPoint, offset: number): GeoPoint {
  return {
    label: 'Point intermediaire',
    lat: (a.lat + b.lat) / 2 + offset,
    lon: (a.lon + b.lon) / 2 - offset,
  };
}

function nearestStop(stops: GtfsStop[], point: GeoPoint, requireAccessible: boolean): GtfsStop {
  const candidates = requireAccessible ? stops.filter((stop) => stop.wheelchair_boarding === 1) : stops;
  return candidates
    .slice()
    .sort((a, b) => haversineDistanceKm(stopToPoint(a), point) - haversineDistanceKm(stopToPoint(b), point))[0];
}

function nearestStation(stations: SharedStation[], point: GeoPoint): SharedStation | null {
  if (stations.length === 0) {
    return null;
  }

  return stations
    .slice()
    .sort((a, b) => haversineDistanceKm(stationToPoint(a), point) - haversineDistanceKm(stationToPoint(b), point))[0];
}

function stopToPoint(stop: GtfsStop): GeoPoint {
  return {
    label: stop.stop_name,
    lat: stop.stop_lat,
    lon: stop.stop_lon,
  };
}

function stationToPoint(station: SharedStation): GeoPoint {
  return {
    label: station.name,
    lat: station.lat,
    lon: station.lon,
  };
}

function routeLabel(route: GtfsRoute): string {
  return `${route.route_type === 1 ? 'Metro' : route.route_type === 0 ? 'Tram' : 'Bus'} ${route.route_short_name}`;
}

function minutesForDistance(distanceKm: number, speedKmh: number): number {
  return Math.max(Math.ceil((distanceKm / speedKmh) * 60), 1);
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
