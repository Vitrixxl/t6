import { describe, expect, it } from '../../test/harness';
import type { PlannedTrip, RecurringTrip } from '../../types';
import {
  createPlannedTrip,
  createRecurringTrip,
  materializeOccurrences,
  occurrenceId,
  plannedTripToRecord,
  pruneForRecurring,
  removeRecurring,
  setPlannedStatus,
  setRecurringPaused,
  summarizeTripActivity,
  upcomingTrips,
  upsertPlanned,
} from './index';

const USER_ID = 'user-tests';

const SOURCE = {
  label: 'Domicile -> Travail',
  origin: { label: 'Bellecour', lat: 45.7578, lon: 4.832 },
  destination: { label: 'Part-Dieu', lat: 45.7606, lon: 4.8594 },
  modes: ['walk', 'transit'] as Array<'walk' | 'transit'>,
  distanceKm: 2.4,
  durationMinutes: 14,
  carbonGrams: 96,
  carbonSavedGrams: 336,
};

// Mercredi 15 juillet 2026, 07:00 locale.
const NOW = new Date(2026, 6, 15, 7, 0);

describe('planned trips', () => {
  it('cree un trajet et le passe a fait avec horodatage', () => {
    const trip = createPlannedTrip(USER_ID, SOURCE, new Date(2026, 6, 16, 8, 30), NOW);

    const done = setPlannedStatus(upsertPlanned([], trip), trip.id, 'done', new Date(2026, 6, 16, 9, 0));
    expect(done).toHaveLength(1);
    expect(done[0].status).toBe('done');
    expect(done[0].completedAt).toBe(new Date(2026, 6, 16, 9, 0).toISOString());

    const record = plannedTripToRecord(done[0]);
    expect(record.routeTitle).toBe(SOURCE.label);
    expect(record.carbonSavedGrams).toBe(SOURCE.carbonSavedGrams);
    // Un trajet marque fait porte forcement sa date d'achevement : l'affirmer
    // avant la comparaison evite de comparer a `null` sans s'en apercevoir.
    expect(done[0].completedAt).not.toBeNull();
    expect(record.createdAt).toBe(done[0].completedAt as string);
  });

  it('upcomingTrips ne retourne que les occurrences a faire, triees par date', () => {
    const past = { ...createPlannedTrip(USER_ID, SOURCE, new Date(2026, 6, 10, 8, 0), NOW), id: 'past' };
    const soon = { ...createPlannedTrip(USER_ID, SOURCE, new Date(2026, 6, 15, 18, 0), NOW), id: 'soon' };
    const later = { ...createPlannedTrip(USER_ID, SOURCE, new Date(2026, 6, 17, 8, 0), NOW), id: 'later' };
    const trips = upsertPlanned(upsertPlanned(upsertPlanned([], later), past), soon);

    expect(upcomingTrips(trips, NOW).map((trip) => trip.id)).toEqual(['soon', 'later']);
  });
});

describe('recurring trips', () => {
  it('genere les occurrences aller-retour des jours actifs sur la fenetre, sans doublon au resync', () => {
    const template = createRecurringTrip(
      USER_ID,
      SOURCE,
      { daysOfWeek: [1, 3, 5], departureTime: '08:30', returnTime: '18:00' },
      NOW,
    );

    const first = materializeOccurrences([template], [], USER_ID, NOW);
    // Fenetre mer 15 -> mar 21 : mercredi 15, vendredi 17, lundi 20 => 3 jours x 2 sens.
    expect(first).toHaveLength(6);
    expect(first.every((trip) => trip.recurringTripId === template.id)).toBe(true);
    expect(first.filter((trip) => trip.label.endsWith('(retour)'))).toHaveLength(3);

    const retour = first.find((trip) => trip.id === occurrenceId(template.id, new Date(2026, 6, 17), 'retour'));
    expect(retour).toBeDefined();
    expect(retour!.origin.label).toBe('Part-Dieu');
    expect(retour!.destination.label).toBe('Bellecour');
    expect(new Date(retour!.scheduledFor).getHours()).toBe(18);

    const second = materializeOccurrences([template], first, USER_ID, NOW);
    expect(second).toHaveLength(6);
    // Rien a ajouter : la liste est rendue telle quelle, sans copie inutile.
    expect(second).toBe(first);
  });

  it('ne genere rien quand le trajet recurrent est en pause', () => {
    const template = createRecurringTrip(USER_ID, SOURCE, { daysOfWeek: [1, 2, 3, 4, 5], departureTime: '08:30', returnTime: null }, NOW);
    const paused = setRecurringPaused([template], template.id, true);

    expect(materializeOccurrences(paused, [], USER_ID, NOW)).toHaveLength(0);

    const resumed = setRecurringPaused(paused, template.id, false);
    expect(materializeOccurrences(resumed, [], USER_ID, NOW).length).toBeGreaterThan(0);
  });

  it("une occurrence annulee n'est pas regeneree", () => {
    const template = createRecurringTrip(USER_ID, SOURCE, { daysOfWeek: [NOW.getDay()], departureTime: '08:30', returnTime: null }, NOW);

    const occurrences = materializeOccurrences([template], [], USER_ID, NOW);
    const todayId = occurrenceId(template.id, NOW, 'aller');
    expect(occurrences.some((trip) => trip.id === todayId)).toBe(true);

    const cancelled = setPlannedStatus(occurrences, todayId, 'cancelled', NOW);
    const after = materializeOccurrences([template], cancelled, USER_ID, NOW);
    expect(after.find((trip) => trip.id === todayId)?.status).toBe('cancelled');
    expect(after.filter((trip) => trip.id === todayId)).toHaveLength(1);
  });

  it('supprimer un recurrent retire ses occurrences a faire mais garde les faites', () => {
    const template = createRecurringTrip(USER_ID, SOURCE, { daysOfWeek: [1, 2, 3, 4, 5], departureTime: '08:30', returnTime: null }, NOW);
    const occurrences = materializeOccurrences([template], [], USER_ID, NOW);
    const doneId = occurrences[0].id;
    const withDone = setPlannedStatus(occurrences, doneId, 'done', NOW);

    const recurring = removeRecurring([template], template.id);
    const planned = pruneForRecurring(withDone, template.id);
    expect(recurring).toHaveLength(0);
    expect(planned).toHaveLength(1);
    expect(planned[0].id).toBe(doneId);
    expect(planned[0].status).toBe('done');
  });
});

describe('summarizeTripActivity', () => {
  it('agrege les trajets faits de la semaine et les compteurs', () => {
    const template: RecurringTrip = createRecurringTrip(USER_ID, SOURCE, { daysOfWeek: [NOW.getDay()], departureTime: '08:30', returnTime: null }, NOW);
    let trips = materializeOccurrences([template], [], USER_ID, NOW);

    const oldDone: PlannedTrip = {
      ...createPlannedTrip(USER_ID, SOURCE, new Date(2026, 5, 1, 8, 0), NOW),
      id: 'old-done',
      status: 'done',
      completedAt: new Date(2026, 5, 1, 9, 0).toISOString(),
    };
    const recentDone: PlannedTrip = {
      ...createPlannedTrip(USER_ID, SOURCE, new Date(2026, 6, 14, 8, 0), NOW),
      id: 'recent-done',
      status: 'done',
      completedAt: new Date(2026, 6, 14, 9, 0).toISOString(),
    };
    trips = upsertPlanned(upsertPlanned(trips, oldDone), recentDone);

    const summary = summarizeTripActivity(trips, [template], NOW);
    expect(summary.doneTotal).toBe(2);
    // Semaine calendaire (lundi 13 juillet) : seul le trajet du 14 compte.
    expect(summary.doneThisWeek).toBe(1);
    expect(summary.savedThisWeekGrams).toBe(SOURCE.carbonSavedGrams);
    // Mois calendaire (juillet) : le trajet du 1er juin est exclu.
    expect(summary.doneThisMonth).toBe(1);
    expect(summary.savedThisMonthGrams).toBe(SOURCE.carbonSavedGrams);
    expect(summary.savedTotalGrams).toBe(SOURCE.carbonSavedGrams * 2);
    expect(summary.upcomingCount).toBe(1);
    expect(summary.recurringActiveCount).toBe(1);
  });

  it('borne la semaine au lundi calendaire, pas a 7 jours glissants', () => {
    // NOW = mercredi 15 juillet ; un trajet fait le dimanche 12 est dans les
    // 7 jours glissants mais PAS dans la semaine calendaire.
    const sundayDone: PlannedTrip = {
      ...createPlannedTrip(USER_ID, SOURCE, new Date(2026, 6, 12, 9, 0), NOW),
      id: 'sunday-done',
      status: 'done',
      completedAt: new Date(2026, 6, 12, 10, 0).toISOString(),
    };

    const summary = summarizeTripActivity([sundayDone], [], NOW);
    expect(summary.doneThisWeek).toBe(0);
    expect(summary.doneThisMonth).toBe(1);
  });
});

// Verrouille B18. Une routine consultee le soir materialisait les occurrences
// du jour deja passees, que la tolerance de 24 h de `upcomingTrips` comptait
// ensuite comme « a venir ».
describe('recurrence — occurrences deja passees', () => {
  const MERCREDI_SOIR = new Date(2026, 6, 15, 22, 0);
  const MERCREDI_MATIN = new Date(2026, 6, 15, 7, 0);
  const jourMeme = (trips: PlannedTrip[]) => trips.filter((trip) => trip.scheduledFor.startsWith('2026-07-15'));
  const template = (now: Date, returnTime: string | null = '18:00') =>
    createRecurringTrip(USER_ID, SOURCE, { daysOfWeek: [1, 2, 3, 4, 5], departureTime: '08:30', returnTime }, now);

  it('ne materialise pas les occurrences du jour dont l heure est passee', () => {
    const occurrences = materializeOccurrences([template(MERCREDI_SOIR)], [], USER_ID, MERCREDI_SOIR);

    expect(jourMeme(occurrences)).toHaveLength(0);
    expect(upcomingTrips(occurrences, MERCREDI_SOIR)).toHaveLength(
      occurrences.filter((trip) => !trip.scheduledFor.startsWith('2026-07-15')).length,
    );
  });

  it('materialise bien les occurrences du jour encore a venir', () => {
    expect(jourMeme(materializeOccurrences([template(MERCREDI_MATIN)], [], USER_ID, MERCREDI_MATIN))).toHaveLength(2);
  });

  // Non-regression de la tolerance : elle sert a marquer « fait » un trajet du
  // matin en fin de journee. Corriger la generation ne doit pas la supprimer.
  it('laisse visible une occurrence deja existante et passee', () => {
    const routine = template(MERCREDI_MATIN, null);
    const duMatinListe = materializeOccurrences([routine], [], USER_ID, MERCREDI_MATIN);

    const leSoir = materializeOccurrences([routine], duMatinListe, USER_ID, MERCREDI_SOIR);
    const duMatin = jourMeme(leSoir);

    expect(duMatin).toHaveLength(1);
    expect(upcomingTrips(leSoir, MERCREDI_SOIR).map((trip) => trip.id)).toContain(duMatin[0].id);
  });
});
