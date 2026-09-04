import { describe, expect, it } from '../../test/harness';
import { DEFAULT_PROFILE } from '../../contracts';
import { haversineDistanceKm, measureRoutes, LANDMARKS, planRoutes, preselectRoute, SCORING_WEIGHTS, totalWalkMinutes } from './index';
import type { TransportNetwork } from '../../types';

const network: TransportNetwork = {
  gtfs: {
    agency: {
      agency_id: 'test',
      agency_name: 'Test',
      agency_url: 'https://example.test',
      agency_timezone: 'Europe/Paris',
    },
    stops: [
      { stop_id: 'A', stop_name: 'Alpha', stop_lat: 45.7578, stop_lon: 4.832, wheelchair_boarding: 1, routes: ['tram'] },
      { stop_id: 'B', stop_name: 'Beta', stop_lat: 45.7605, stop_lon: 4.8595, wheelchair_boarding: 1, routes: ['tram'] },
      // Arret de bus : aucune ligne structurante ne le dessert, le moteur ne
      // doit jamais y faire monter le voyageur meme s'il est le plus proche.
      { stop_id: 'C', stop_name: 'Gamma', stop_lat: 45.7579, stop_lon: 4.8321, wheelchair_boarding: 1, routes: [] },
    ],
    routes: [
      {
        route_id: 'tram',
        route_short_name: 'T',
        route_long_name: 'Tram test',
        route_type: 0,
        route_color: '000000',
        route_text_color: 'ffffff',
        shape: [
          [4.832, 45.7578],
          [4.8455, 45.759],
          [4.8595, 45.7605],
        ],
      },
    ],
    trips: [
      {
        trip_id: 'tram-1',
        route_id: 'tram',
        service_id: 'weekday',
        headway_minutes: 5,
        realtime_delay_minutes: 0,
        occupancy: 'low',
      },
    ],
    weather: {
      condition: 'clear',
      temperature_celsius: 20,
      wind_kmh: 8,
      updated_at: '2026-09-14T08:00:00+02:00',
    },
  },
  sharedMobility: {
    last_updated: 1789365900,
    ttl: 60,
    version: '3.0',
    data: {
      stations: [
        {
          // A ~40 m de Bellecour (LANDMARKS[0]) : dans le rayon de marche RG3 (400 m).
          station_id: 's1',
          kind: 'velov' as const,
          name: 'Station 1',
          lat: 45.758,
          lon: 4.8325,
          capacity: 20,
          bikes_available: 8,
          scooters_available: 4,
          is_installed: true,
          is_renting: true,
          is_returning: true,
          last_reported: 1789365900,
        },
        {
          // A ~40 m de Part-Dieu (LANDMARKS[1]).
          station_id: 's2',
          kind: 'velov' as const,
          name: 'Station 2',
          lat: 45.7605,
          lon: 4.859,
          capacity: 20,
          bikes_available: 3,
          scooters_available: 2,
          is_installed: true,
          is_renting: true,
          is_returning: true,
          last_reported: 1789365900,
        },
      ],
    },
  },
};

describe('planRoutes', () => {
  it('returns multimodal options ordered by score', () => {
    const routes = planRoutes({
      origin: LANDMARKS[0],
      destination: LANDMARKS[1],
      profile: DEFAULT_PROFILE,
      network,
    });

    expect(routes.length).toBeGreaterThanOrEqual(3);
    expect(routes[0].score).toBeGreaterThanOrEqual(routes[1].score);
    expect(routes.some((route) => route.modes.includes('transit'))).toBe(true);
    expect(routes.some((route) => route.modes.includes('bike'))).toBe(true);
  });

  // Verrouille B14 : chaque generateur inserait un point intermediaire decale
  // de plusieurs centaines de metres pour "arrondir" le trace. Le detour etait
  // masque tant que le routage reel remplacait la geometrie, et reapparaissait
  // des que le service tiers ne repondait plus.
  it('ne fait sortir aucun segment du cadre de ses extremites', () => {
    const routes = planRoutes({
      origin: LANDMARKS[0],
      destination: LANDMARKS[1],
      profile: DEFAULT_PROFILE,
      network,
    });

    // Marge : le trace approche relie ses extremites en ligne droite, il ne
    // peut donc pas depasser leur cadre. 100 m absorbent les arrondis.
    const toleranceDegrees = 0.001;

    for (const route of routes) {
      // Les segments de transport public suivent le trace publie de la ligne,
      // qui peut legitimement sortir du cadre de ses deux stations quand la
      // ligne fait une courbe. L'invariant ne porte que sur les geometries
      // approchees, celles que les generateurs fabriquent eux-memes.
      for (const leg of route.legs.filter((item) => item.mode !== 'transit')) {
        const first = leg.path[0];
        const last = leg.path[leg.path.length - 1];
        for (const point of leg.path) {
          expect(point.lat).toBeGreaterThanOrEqual(Math.min(first.lat, last.lat) - toleranceDegrees);
          expect(point.lat).toBeLessThanOrEqual(Math.max(first.lat, last.lat) + toleranceDegrees);
          expect(point.lon).toBeGreaterThanOrEqual(Math.min(first.lon, last.lon) - toleranceDegrees);
          expect(point.lon).toBeLessThanOrEqual(Math.max(first.lon, last.lon) + toleranceDegrees);
        }
      }
    }
  });

  it('penalizes inaccessible options when PMR profile is enabled', () => {
    const routes = planRoutes({
      origin: LANDMARKS[0],
      destination: LANDMARKS[1],
      profile: {
        ...DEFAULT_PROFILE,
        accessibilityNeed: true,
        preferredModes: ['bike', 'scooter'],
      },
      network,
    });

    const firstInaccessible = routes.find((route) => !route.accessible);
    const firstAccessible = routes.find((route) => route.accessible);

    expect(firstAccessible).toBeDefined();
    expect(firstInaccessible).toBeDefined();
    expect(firstAccessible?.score).toBeGreaterThan(firstInaccessible?.score ?? 0);
  });

  it('applique un bonus de score aux modes preferes (poids centralises)', () => {
    const base = {
      origin: LANDMARKS[0],
      destination: LANDMARKS[1],
      network,
    };
    const neutral = planRoutes({ ...base, profile: { ...DEFAULT_PROFILE, preferredModes: [] } });
    const bikeLover = planRoutes({ ...base, profile: { ...DEFAULT_PROFILE, preferredModes: ['bike'] } });

    const bikeNeutral = neutral.find((route) => route.modes.includes('bike'));
    const bikePreferred = bikeLover.find((route) => route.modes.includes('bike'));

    expect(bikeNeutral).toBeDefined();
    expect(bikePreferred).toBeDefined();
    // Le bonus par mode prefere est le coefficient centralise, pas une constante magique.
    expect(bikePreferred!.score).toBeGreaterThanOrEqual(bikeNeutral!.score + SCORING_WEIGHTS.preferenceBonusPerMode - 1);
  });

  it("RG5 : penalise et signale une option qui depasse la marche maximale du profil", () => {
    const routes = planRoutes({
      origin: LANDMARKS[0],
      destination: LANDMARKS[1],
      profile: { ...DEFAULT_PROFILE, maxWalkMinutes: 1 },
      network,
    });

    const overWalking = routes.find((route) => totalWalkMinutes(route) > 1);
    expect(overWalking).toBeDefined();
    expect(overWalking!.warnings.some((warning) => /marche/i.test(warning))).toBe(true);
  });

  it('RG3 : aucune option velo/trottinette si aucune station n\'est a portee de marche', () => {
    const farStations: TransportNetwork = {
      ...network,
      sharedMobility: {
        ...network.sharedMobility,
        data: {
          stations: network.sharedMobility.data.stations.map((station) => ({
            ...station,
            lat: station.lat + 0.05, // ~5,5 km : hors du rayon RG3 de 400 m
          })),
        },
      },
    };

    const routes = planRoutes({
      origin: LANDMARKS[0],
      destination: LANDMARKS[1],
      profile: DEFAULT_PROFILE,
      network: farStations,
    });

    expect(routes.some((route) => route.modes.includes('bike') || route.modes.includes('scooter'))).toBe(false);
    // Le transport public reste disponible.
    expect(routes.some((route) => route.modes.includes('transit'))).toBe(true);
  });

  it("RG2 : aucune option transport public si aucun arret n'est accessible en profil PMR", () => {
    const inaccessibleNetwork: TransportNetwork = {
      ...network,
      gtfs: {
        ...network.gtfs,
        stops: network.gtfs.stops.map((stop) => ({ ...stop, wheelchair_boarding: 2 as const })),
      },
    };

    const pmrRoutes = planRoutes({
      origin: LANDMARKS[0],
      destination: LANDMARKS[1],
      profile: { ...DEFAULT_PROFILE, accessibilityNeed: true },
      network: inaccessibleNetwork,
    });
    // On n'invente pas une correspondance non conforme: pas d'option transit.
    expect(pmrRoutes.some((route) => route.modes.includes('transit'))).toBe(false);

    // Sans besoin PMR, les memes arrets produisent bien une option transit.
    const standardRoutes = planRoutes({
      origin: LANDMARKS[0],
      destination: LANDMARKS[1],
      profile: DEFAULT_PROFILE,
      network: inaccessibleNetwork,
    });
    expect(standardRoutes.some((route) => route.modes.includes('transit'))).toBe(true);
  });

  it('RG4 : la pluie ajoute un avertissement et penalise le score si la sensibilite est activee', () => {
    const rainyNetwork: TransportNetwork = {
      ...network,
      gtfs: {
        ...network.gtfs,
        weather: { ...network.gtfs.weather, condition: 'light_rain' },
      },
    };
    const base = { origin: LANDMARKS[0], destination: LANDMARKS[1], network: rainyNetwork };

    const sensitive = planRoutes({ ...base, profile: { ...DEFAULT_PROFILE, avoidRain: true } });
    const indifferent = planRoutes({ ...base, profile: { ...DEFAULT_PROFILE, avoidRain: false } });

    const bikeSensitive = sensitive.find((route) => route.id === 'bike');
    const bikeIndifferent = indifferent.find((route) => route.id === 'bike');

    expect(bikeSensitive?.warnings.some((warning) => /pluie/i.test(warning))).toBe(true);
    expect(bikeIndifferent?.warnings.some((warning) => /pluie/i.test(warning))).toBe(false);
    expect(bikeSensitive!.score).toBeLessThan(bikeIndifferent!.score);
  });

  it('borne chaque score sur l\'intervalle 0-100', () => {
    const routes = planRoutes({
      origin: LANDMARKS[0],
      destination: LANDMARKS[4], // Bellecour -> Vaise: option longue, penalites fortes
      profile: { ...DEFAULT_PROFILE, maxWalkMinutes: 5, accessibilityNeed: true },
      network,
    });

    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(route.score).toBeGreaterThanOrEqual(0);
      expect(route.score).toBeLessThanOrEqual(100);
    }
  });

  it('ventile le CO2 par segment: le velo est plus sobre que le transport public sur la meme origine-destination', () => {
    const routes = planRoutes({
      origin: LANDMARKS[0],
      destination: LANDMARKS[1],
      profile: DEFAULT_PROFILE,
      network,
    });

    const bike = routes.find((route) => route.id === 'bike');
    const transit = routes.find((route) => route.id === 'transit');

    expect(bike).toBeDefined();
    expect(transit).toBeDefined();
    expect(bike!.carbonGrams).toBeLessThan(transit!.carbonGrams);
    // Le CO2 evite est toujours positif ou nul face a la reference voiture individuelle.
    for (const route of routes) {
      expect(route.carbonSavedGrams).toBeGreaterThanOrEqual(0);
      expect(route.carbonGrams).toBe(route.legs.reduce((sum, leg) => sum + leg.carbonGrams, 0));
    }
  });
});

describe('haversineDistanceKm', () => {
  it('retrouve la distance de reference d\'un degre de longitude a l\'equateur', () => {
    expect(haversineDistanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(111.2, 0);
  });

  it('est symetrique et nulle sur un point identique', () => {
    expect(haversineDistanceKm(LANDMARKS[0], LANDMARKS[0])).toBe(0);
    expect(haversineDistanceKm(LANDMARKS[0], LANDMARKS[1])).toBeCloseTo(
      haversineDistanceKm(LANDMARKS[1], LANDMARKS[0]),
      10,
    );
  });
});

describe('preselectRoute', () => {
  const routes = planRoutes({
    origin: LANDMARKS[0],
    destination: LANDMARKS[1],
    profile: DEFAULT_PROFILE,
    network,
  });

  it('retient la plus rapide par defaut, meme si elle n est pas la mieux classee', () => {
    const preselected = preselectRoute(routes);
    const shortest = Math.min(...routes.map((route) => route.durationMinutes));
    expect(preselected?.durationMinutes).toBe(shortest);
  });

  it('retient la plus rapide parmi celles qui empruntent le mode choisi', () => {
    const preselected = preselectRoute(routes, 'transit');
    expect(preselected?.modes).toContain('transit');

    const transitRoutes = routes.filter((route) => route.modes.includes('transit'));
    expect(preselected?.durationMinutes).toBe(Math.min(...transitRoutes.map((route) => route.durationMinutes)));
  });

  it('retombe sur la plus rapide quand le mode choisi n existe pas sur ce trajet', () => {
    // Aucune station de trottinette a portee dans ce reseau de test.
    const preselected = preselectRoute(routes, 'scooter');
    expect(preselected?.durationMinutes).toBe(Math.min(...routes.map((route) => route.durationMinutes)));
  });

  it('ne renvoie rien quand aucune option n existe', () => {
    expect(preselectRoute([])).toBeNull();
  });
});

// Verrouille B17. Un vehicule partage ne peut pas mener n'importe ou : la
// trottinette etait proposee sur des centaines de kilometres parce que seule
// la disponibilite au depart etait verifiee.
describe('portee des modes partages (RG3)', () => {
  const bellecour = LANDMARKS[0];
  const horsZone = { label: 'Paris', lat: 48.8566, lon: 2.3522 };

  const optionsPour = (destination: typeof bellecour) =>
    planRoutes({ origin: bellecour, destination, profile: DEFAULT_PROFILE, network }).map((route) => route.id);

  it('ne propose aucune trottinette vers une destination hors zone de service', () => {
    expect(optionsPour(horsZone)).not.toContain('scooter');
  });

  it('conserve la trottinette a l interieur de la zone', () => {
    expect(optionsPour(LANDMARKS[1])).toContain('scooter');
  });

  // Le test qui porte sur la cause racine et non sur le symptome : les deux
  // modes partages sont bornes, meme si la borne n'est pas la meme (le Velo'v
  // se rend a une station, la trottinette se laisse dans la zone de service).
  it('borne les deux modes partages, sans laisser l un survivre a l autre', () => {
    const dehors = optionsPour(horsZone);
    expect(dehors).not.toContain('bike');
    expect(dehors).not.toContain('scooter');
    expect(dehors).not.toContain('bike-transit');
  });
});

// Verrouille B19. Seul l'itineraire selectionne est route segment par segment ;
// sa liste d'options continuait d'afficher l'estimation a vol d'oiseau, si bien
// que la pastille et la fiche de detail annonçaient deux chiffres pour le meme
// trajet — 11 min sur l'une, 21 min sur l'autre.
// Verrouille B20. Seule l'option selectionnee etait mesuree par le service de
// routage ; les autres restaient sur l'estimation a vol d'oiseau. Changer de
// selection changeait donc les chiffres affiches, et comparer une duree mesuree
// a une duree estimee n'avait aucun sens.
describe('measureRoutes', () => {
  const routes = planRoutes({
    origin: LANDMARKS[0],
    destination: LANDMARKS[1],
    profile: DEFAULT_PROFILE,
    network,
  });

  /**
   * Routeur de test : double chaque distance, comme le ferait la voirie reelle,
   * et pose un trace — un vrai routeur en rend toujours un.
   */
  const doubler = async (legs: typeof routes[number]['legs']) =>
    legs.map((leg) => ({
      ...leg,
      distanceKm: leg.distanceKm * 2,
      durationMinutes: leg.durationMinutes * 2,
      path: [leg.fromPoint, leg.toPoint],
    }));

  it('mesure toutes les options, sans en laisser aucune a l estimation', async () => {
    const measured = await measureRoutes(routes, DEFAULT_PROFILE, doubler);

    expect(measured).toHaveLength(routes.length);
    for (const option of measured) {
      const avant = routes.find((item) => item.id === option.id);
      expect(option.distanceKm).toBeCloseTo((avant?.distanceKm ?? 0) * 2, 1);
    }
  });

  it('ecarte une option dont un segment n a pas pu etre mesure', async () => {
    // Un segment sans geometrie : l'option n'a pas de mesure, elle ne peut pas
    // etre comparee aux autres et n'a donc rien a faire dans la liste.
    const boiteux = async (legs: typeof routes[number]['legs']) =>
      legs.map((leg, index) => ({ ...leg, path: index === 0 ? [] : [leg.fromPoint, leg.toPoint] }));

    const measured = await measureRoutes(routes, DEFAULT_PROFILE, boiteux);

    expect(measured).toHaveLength(0);
  });

  it('reclasse sur les mesures reelles et non sur l estimation', async () => {
    const measured = await measureRoutes(routes, DEFAULT_PROFILE, doubler);
    const scores = measured.map((option) => option.score);

    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    // Les durees ont double : les scores ne peuvent pas etre restes identiques.
    expect(scores).not.toEqual(routes.map((option) => option.score));
  });
});
