// Les contrats sont partages par le formulaire et par l'API : ces tests
// verrouillent les bornes qu'un relecteur s'attend a retrouver des deux cotes.
import { describe, expect, it } from 'bun:test';
import {
    DEFAULT_PROFILE,
    credentials,
    mobilityMode,
    mobilityProfile,
    plannedTripInput,
    recurringTrip,
    registration,
    routableMode,
} from './index';

const TRIP = {
    id: 'trip-1',
    label: 'Domicile - travail',
    origin: { lat: 45.76, lon: 4.85, label: 'Part-Dieu' },
    destination: { lat: 45.75, lon: 4.83, label: 'Bellecour' },
    modes: ['transit'],
    distanceKm: 3,
    durationMinutes: 12,
    carbonGrams: 90,
    carbonSavedGrams: 400,
    scheduledFor: '2026-09-02T06:15:00.000Z',
    status: 'planned',
    createdAt: '2026-09-01T08:00:00.000Z',
    completedAt: null,
};

describe('profil de mobilite', () => {
    it('accepte le profil par defaut', () => {
        expect(mobilityProfile.safeParse(DEFAULT_PROFILE).success).toBe(true);
    });

    it('borne la marche maximale (5-45 min) et l objectif carbone (250-20000 g)', () => {
        expect(mobilityProfile.safeParse({ ...DEFAULT_PROFILE, maxWalkMinutes: 999 }).success).toBe(false);
        expect(mobilityProfile.safeParse({ ...DEFAULT_PROFILE, carbonGoalGramsPerWeek: 10 }).success).toBe(false);
    });

    it('valide des objectifs d economie de CO2 hebdomadaire et mensuel independants', () => {
        expect(
            mobilityProfile.safeParse({
                ...DEFAULT_PROFILE,
                weeklySavedGoalGrams: 1500,
                monthlySavedGoalGrams: 9500,
            }).success,
        ).toBe(true);
        expect(mobilityProfile.safeParse({ ...DEFAULT_PROFILE, weeklySavedGoalGrams: 50 }).success).toBe(false);
        expect(mobilityProfile.safeParse({ ...DEFAULT_PROFILE, monthlySavedGoalGrams: 250_000 }).success).toBe(false);
    });

    it('exige au moins un mode', () => {
        expect(mobilityProfile.safeParse({ ...DEFAULT_PROFILE, preferredModes: [] }).success).toBe(false);
    });

    it('refuse les chevrons dans le nom affiche, avec un message en francais', () => {
        const result = mobilityProfile.safeParse({ ...DEFAULT_PROFILE, displayName: '<script>Nadia</script>' });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toContain('chevrons');
    });
});

describe('authentification', () => {
    it('l inscription exige douze caracteres et un chiffre', () => {
        expect(registration.safeParse({ email: 'a@b.fr', password: 'UrbanFlow2026!', displayName: 'Nadia' }).success).toBe(true);
        expect(registration.safeParse({ email: 'a@b.fr', password: 'UrbanFlowUrban!', displayName: 'Nadia' }).success).toBe(false);
        expect(registration.safeParse({ email: 'a@b.fr', password: 'Court1!', displayName: 'Nadia' }).success).toBe(false);
    });

    it('la connexion ne rejoue pas la politique de robustesse', () => {
        expect(credentials.safeParse({ email: 'a@b.fr', password: 'ancien' }).success).toBe(true);
        expect(credentials.safeParse({ email: 'pas-un-email', password: 'ancien' }).success).toBe(false);
    });
});

describe('trajets', () => {
    it("garde la voiture hors des modes proposes tout en l'acceptant pour le routage", () => {
        expect(mobilityMode.safeParse('car').success).toBe(false);
        expect(routableMode.safeParse('car').success).toBe(true);
    });

    it('un trajet envoye ne porte ni identifiant ni proprietaire : ils viennent de l URL et de la session', () => {
        const parsed = plannedTripInput.parse({ ...TRIP, userId: 'intrus' });

        expect(parsed).not.toHaveProperty('userId');
        expect(parsed).not.toHaveProperty('id');
        expect(parsed.status).toBe('planned');
    });

    it('conserve une comparaison voiture absente au lieu de la transformer en zero', () => {
        const parsed = plannedTripInput.parse({ ...TRIP, carbonSavedGrams: null });

        expect(parsed.carbonSavedGrams).toBeNull();
    });

    it('refuse une date qui n est pas ISO et un statut inconnu', () => {
        expect(plannedTripInput.safeParse({ ...TRIP, scheduledFor: 'demain' }).success).toBe(false);
        expect(plannedTripInput.safeParse({ ...TRIP, status: 'perdu' }).success).toBe(false);
    });

    it('reserve le statut fait a la commande de completion', () => {
        expect(plannedTripInput.safeParse({ ...TRIP, status: 'done', completedAt: '2026-09-02T07:00:00.000Z' }).success).toBe(false);
    });

    it('une routine a au moins un jour, une periode, et des heures HH:MM', () => {
        const routine = {
            ...TRIP,
            userId: 'user-1',
            daysOfWeek: [1, 2, 3],
            departureTime: '08:15',
            returnTime: null,
            periods: [{ from: '2026-08-31T06:00:00.000Z', to: null }],
        };

        expect(recurringTrip.safeParse(routine).success).toBe(true);
        expect(recurringTrip.safeParse({ ...routine, daysOfWeek: [] }).success).toBe(false);
        expect(recurringTrip.safeParse({ ...routine, periods: [] }).success).toBe(false);
        expect(recurringTrip.safeParse({ ...routine, departureTime: '8h15' }).success).toBe(false);
    });
});
