// Facteurs d'émission et référence contrefactuelle voiture.
//
// Une valeur carbone n'est pas une constante technique : elle dépend d'un
// périmètre et d'une source. Chaque facteur porte donc son unité, sa version et
// la date a laquelle la source a été consultée. Changer de millésime devient un
// changement métier explicite, relisible dans l'historique Git.
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
 * Facteur de la référence invisible : voiture thermique diesel, une personne.
 * La valeur est figée pour le concours afin que deux calculs faits avec des
 * versions différentes du modèle restent explicables et comparables.
 */
export const CAR_REFERENCE_FACTOR: EmissionFactor = {
    id: 'ademe-2025-car-diesel-average-142',
    gramsCo2ePerPassengerKm: 142,
    unit: 'gCO2e/passager-km',
    scope: 'Voiture thermique moyenne diesel, une personne',
    source: 'ADEME Base Empreinte, modélisation transport 2025',
    sourceUrl: ADEME_IMPACT_CO2_TRANSPORT_URL,
    modelYear: 2025,
    consultedOn: CONSULTED_ON,
};

/** Facteurs historiques des modes de voirie déjà proposes par UrbanFlow. */
export const ROAD_EMISSION_FACTORS: Record<Exclude<MobilityMode, 'transit'>, EmissionFactor> = {
    walk: {
        id: 'urbanflow-2025-walk',
        gramsCo2ePerPassengerKm: 0,
        unit: 'gCO2e/passager-km',
        scope: 'Émissions directes de la marche',
        source: 'Hypothèse de modélisation UrbanFlow 2025',
        sourceUrl: URBANFLOW_CARBON_MODEL_URL,
        modelYear: 2025,
        consultedOn: CONSULTED_ON,
    },
    bike: {
        id: 'urbanflow-2025-shared-bike',
        gramsCo2ePerPassengerKm: 4,
        unit: 'gCO2e/passager-km',
        scope: 'Vélo partagé, exploitation et cycle de vie simplifiés',
        source: 'Hypothèse de modélisation UrbanFlow 2025',
        sourceUrl: URBANFLOW_CARBON_MODEL_URL,
        modelYear: 2025,
        consultedOn: CONSULTED_ON,
    },
    scooter: {
        id: 'urbanflow-2025-shared-scooter',
        gramsCo2ePerPassengerKm: 15,
        unit: 'gCO2e/passager-km',
        scope: 'Trottinette partagée, exploitation et cycle de vie simplifiés',
        source: 'Hypothèse de modélisation UrbanFlow 2025',
        sourceUrl: URBANFLOW_CARBON_MODEL_URL,
        modelYear: 2025,
        consultedOn: CONSULTED_ON,
    },
};

const TRANSIT_EMISSION_FACTORS: Record<0 | 1 | 3 | 7, EmissionFactor> = {
    0: {
        id: 'ademe-impactco2-2025-tramway',
        gramsCo2ePerPassengerKm: 3.8,
        unit: 'gCO2e/passager-km',
        scope: 'Tramway, par passager-kilomètre',
        source: 'ADEME Impact CO2, transport',
        sourceUrl: ADEME_IMPACT_CO2_TRANSPORT_URL,
        modelYear: 2025,
        consultedOn: CONSULTED_ON,
    },
    1: {
        id: 'ademe-impactco2-2025-metro',
        gramsCo2ePerPassengerKm: 4.2,
        unit: 'gCO2e/passager-km',
        scope: 'Métro, par passager-kilomètre',
        source: 'ADEME Impact CO2, transport',
        sourceUrl: ADEME_IMPACT_CO2_TRANSPORT_URL,
        modelYear: 2025,
        consultedOn: CONSULTED_ON,
    },
    3: {
        id: 'ademe-impactco2-2026-bus-thermique-122',
        gramsCo2ePerPassengerKm: 122,
        unit: 'gCO2e/passager-km',
        scope: 'Bus thermique, construction et usage, par passager-kilomètre',
        source: 'ADEME Base Empreinte, Impact CO₂',
        sourceUrl: 'https://impactco2.fr/outils/transport/busthermique',
        modelYear: 2026,
        consultedOn: '2026-09-05',
        approximation: 'Motorisation non fournie par le WFS : référence bus thermique appliquée, y compris aux trolleybus.',
    },
    7: {
        id: 'ademe-impactco2-2025-funicular-as-metro',
        gramsCo2ePerPassengerKm: 4.2,
        unit: 'gCO2e/passager-km',
        scope: 'Funiculaire urbain, par passager-kilomètre',
        source: 'ADEME Impact CO2, facteur métro retenu par approximation',
        sourceUrl: ADEME_IMPACT_CO2_TRANSPORT_URL,
        modelYear: 2025,
        consultedOn: CONSULTED_ON,
        approximation: 'Aucun facteur funiculaire spécifique disponible dans la source consultée.',
    },
};

/** Types GTFS importés : tram, métro, bus et funiculaire. */
export function transitEmissionFactor(routeType: number): EmissionFactor {
    if (routeType === 0 || routeType === 1 || routeType === 3 || routeType === 7) {
        return TRANSIT_EMISSION_FACTORS[routeType];
    }
    // Garde-fou pour un feed futur : une ligne inconnue reprend le facteur métro
    // et reste ainsi explicite, au lieu de retomber sur l'ancien 55 g générique.
    return {
        ...TRANSIT_EMISSION_FACTORS[1],
        id: 'ademe-impactco2-2025-unknown-transit-as-metro',
        scope: `Transport GTFS route_type ${routeType}, par passager-kilomètre`,
        approximation: 'Type GTFS non documenté dans le périmètre UrbanFlow, facteur métro retenu.',
    };
}

/** Transforme la cellule 1 x 1 du profil voiture en référence auditable. */
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
 * Applique une référence unique à toutes les options déjà mesurées.
 * Une valeur négative est conservée : elle signifie que l'option émet plus que
 * le scénario voiture, information que l'interface doit assumer.
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
