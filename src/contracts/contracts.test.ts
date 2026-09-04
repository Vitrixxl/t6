// Les contrats sont partages par le formulaire et par l'API : ces tests
// verrouillent les bornes qu'un relecteur s'attend a retrouver des deux cotes.
import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_PROFILE,
  credentials,
  mobilityProfile,
  plannedTripInput,
  plannedTripsInput,
  recurringTrip,
  registration,
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
  it('un trajet envoye ne porte pas de proprietaire : la propriete est retiree', () => {
    const parsed = plannedTripInput.parse({ ...TRIP, userId: 'intrus' });

    expect(parsed).not.toHaveProperty('userId');
    expect(parsed.status).toBe('planned');
  });

  it('refuse une date qui n est pas ISO et un statut inconnu', () => {
    expect(plannedTripInput.safeParse({ ...TRIP, scheduledFor: 'demain' }).success).toBe(false);
    expect(plannedTripInput.safeParse({ ...TRIP, status: 'perdu' }).success).toBe(false);
  });

  it('borne une collection a sa limite de conservation', () => {
    const trips = Array.from({ length: 401 }, (_, index) => ({ ...TRIP, id: `trip-${index}` }));

    expect(plannedTripsInput.safeParse(trips).success).toBe(false);
    expect(plannedTripsInput.safeParse(trips.slice(0, 400)).success).toBe(true);
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
