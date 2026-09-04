// Facteurs d'emission et reference contrefactuelle voiture.
//
// Une valeur carbone n'est pas une constante technique : elle depend d'un
// perimetre et d'une source. Chaque facteur porte donc son unite, sa version et
// la date a laquelle la source a ete consultee. Changer de millesime devient un
// changement metier explicite, relisible dans l'historique Git.
import type { CarbonReference, MobilityMode, RouteMeasure, RouteOption } from '../../types';

export interface EmissionFactor {
  id: string;
  gramsCo2ePerPassengerKm: number;
  unit: 'gCO2e/passager-km';
  scope: string;
  source: string;
  sourceUrl: string;
  modelYear: number;
  consultedOn: string;
  approximation?: string;
}

const ADEME_IMPACT_CO2_TRANSPORT_URL = 'https://impactco2.fr/outils/transport';
const URBANFLOW_CARBON_MODEL_URL = 'https://github.com/Vitrixxl/t6/blob/main/README.md#facteurs-carbone';
const CONSULTED_ON = '2026-09-04';

/**
 * Facteur de la reference invisible : voiture thermique diesel, une personne.
 * La valeur est figee pour le concours afin que deux calculs faits avec des
 * versions differentes du modele restent explicables et comparables.
 */
export const CAR_REFERENCE_FACTOR: EmissionFactor = {
  id: 'ademe-2025-car-diesel-average-142',
  gramsCo2ePerPassengerKm: 142,
  unit: 'gCO2e/passager-km',
  scope: 'Voiture thermique moyenne diesel, une personne',
  source: 'ADEME Base Empreinte, modelisation transport 2025',
  sourceUrl: ADEME_IMPACT_CO2_TRANSPORT_URL,
  modelYear: 2025,
  consultedOn: CONSULTED_ON,
};

/** Facteurs historiques des modes de voirie deja proposes par UrbanFlow. */
export const ROAD_EMISSION_FACTORS: Record<Exclude<MobilityMode, 'transit'>, EmissionFactor> = {
  walk: {
    id: 'urbanflow-2025-walk',
    gramsCo2ePerPassengerKm: 0,
    unit: 'gCO2e/passager-km',
    scope: 'Emissions directes de la marche',
    source: 'Hypothese de modelisation UrbanFlow 2025',
    sourceUrl: URBANFLOW_CARBON_MODEL_URL,
    modelYear: 2025,
    consultedOn: CONSULTED_ON,
  },
  bike: {
    id: 'urbanflow-2025-shared-bike',
    gramsCo2ePerPassengerKm: 4,
    unit: 'gCO2e/passager-km',
    scope: 'Velo partage, exploitation et cycle de vie simplifies',
    source: 'Hypothese de modelisation UrbanFlow 2025',
    sourceUrl: URBANFLOW_CARBON_MODEL_URL,
    modelYear: 2025,
    consultedOn: CONSULTED_ON,
  },
  scooter: {
    id: 'urbanflow-2025-shared-scooter',
    gramsCo2ePerPassengerKm: 15,
    unit: 'gCO2e/passager-km',
    scope: 'Trottinette partagee, exploitation et cycle de vie simplifies',
    source: 'Hypothese de modelisation UrbanFlow 2025',
    sourceUrl: URBANFLOW_CARBON_MODEL_URL,
    modelYear: 2025,
    consultedOn: CONSULTED_ON,
  },
};

const TRANSIT_EMISSION_FACTORS: Record<0 | 1 | 7, EmissionFactor> = {
  0: {
    id: 'ademe-impactco2-2025-tramway',
    gramsCo2ePerPassengerKm: 3.8,
    unit: 'gCO2e/passager-km',
    scope: 'Tramway, par passager-kilometre',
    source: 'ADEME Impact CO2, transport',
    sourceUrl: ADEME_IMPACT_CO2_TRANSPORT_URL,
    modelYear: 2025,
    consultedOn: CONSULTED_ON,
  },
  1: {
    id: 'ademe-impactco2-2025-metro',
    gramsCo2ePerPassengerKm: 4.2,
    unit: 'gCO2e/passager-km',
    scope: 'Metro, par passager-kilometre',
    source: 'ADEME Impact CO2, transport',
    sourceUrl: ADEME_IMPACT_CO2_TRANSPORT_URL,
    modelYear: 2025,
    consultedOn: CONSULTED_ON,
  },
  7: {
    id: 'ademe-impactco2-2025-funicular-as-metro',
    gramsCo2ePerPassengerKm: 4.2,
    unit: 'gCO2e/passager-km',
    scope: 'Funiculaire urbain, par passager-kilometre',
    source: 'ADEME Impact CO2, facteur metro retenu par approximation',
    sourceUrl: ADEME_IMPACT_CO2_TRANSPORT_URL,
    modelYear: 2025,
    consultedOn: CONSULTED_ON,
    approximation: 'Aucun facteur funiculaire specifique disponible dans la source consultee.',
  },
};

/** Le feed ne conserve que les route_type GTFS 0, 1 et 7. */
export function transitEmissionFactor(routeType: number): EmissionFactor {
  if (routeType === 0 || routeType === 1 || routeType === 7) {
    return TRANSIT_EMISSION_FACTORS[routeType];
  }
  // Garde-fou pour un feed futur : une ligne inconnue reprend le facteur metro
  // et reste ainsi explicite, au lieu de retomber sur l'ancien 55 g generique.
  return {
    ...TRANSIT_EMISSION_FACTORS[1],
    id: 'ademe-impactco2-2025-unknown-transit-as-metro',
    scope: `Transport GTFS route_type ${routeType}, par passager-kilometre`,
    approximation: 'Type GTFS non documente dans le perimetre UrbanFlow, facteur metro retenu.',
  };
}

/** Transforme la cellule 1 x 1 du profil voiture en reference auditable. */
export function createCarbonReference(measure: RouteMeasure | null): CarbonReference | null {
  if (!measure) {
    return null;
  }
  const distanceKm = measure.distanceMeters / 1000;
  return {
    distanceKm,
    carbonGrams: Math.round(distanceKm * CAR_REFERENCE_FACTOR.gramsCo2ePerPassengerKm),
    factorVersion: CAR_REFERENCE_FACTOR.id,
  };
}

/**
 * Applique une reference unique a toutes les options deja mesurees.
 * Une valeur negative est conservee : elle signifie que l'option emet plus que
 * le scenario voiture, information que l'interface doit assumer.
 */
export function applyCarbonReference(
  routes: RouteOption[],
  reference: CarbonReference | null,
): RouteOption[] {
  return routes.map((option) => ({
    ...option,
    carbonReference: reference,
    carbonSavedGrams: reference ? reference.carbonGrams - option.carbonGrams : null,
  }));
}
