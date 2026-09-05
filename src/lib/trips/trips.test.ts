import { describe, expect, it } from 'bun:test';
import type { PlannedTrip } from '../../types';
import {
    countOccurrences,
    createPlannedTrip,
    createRecurringTrip,
    isRoutinePaused,
    nextOccurrence,
    occurrencesBetween,
    removeRecurring,
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
// Mardi 21 juillet 2026, 12:00 locale : six jours plus tard.
const LATER = new Date(2026, 6, 21, 12, 0);

describe('planned trips', () => {
    it('crée un trajet à faire avec sa date et ses mesures', () => {
        const trip = createPlannedTrip(USER_ID, SOURCE, new Date(2026, 6, 16, 8, 30), NOW);

        expect(trip.status).toBe('planned');
        expect(trip.completedAt).toBeNull();
        expect(trip.scheduledFor).toBe(new Date(2026, 6, 16, 8, 30).toISOString());
        expect(trip.label).toBe(SOURCE.label);
        expect(trip.carbonSavedGrams).toBe(SOURCE.carbonSavedGrams);
    });

    it('upcomingTrips ne retourne que les trajets à faire, tries par date', () => {
        const past = { ...createPlannedTrip(USER_ID, SOURCE, new Date(2026, 6, 10, 8, 0), NOW), id: 'past' };
        const soon = { ...createPlannedTrip(USER_ID, SOURCE, new Date(2026, 6, 15, 18, 0), NOW), id: 'soon' };
        const later = { ...createPlannedTrip(USER_ID, SOURCE, new Date(2026, 6, 17, 8, 0), NOW), id: 'later' };
        const trips = upsertPlanned(upsertPlanned(upsertPlanned([], later), past), soon);

        expect(upcomingTrips(trips, NOW).map((trip) => trip.id)).toEqual(['soon', 'later']);
    });
});

// Une routine n'engendre aucun trajet : ses passages sont comptes à la
// lecture, entre sa création et maintenant, sur ses périodes d'activite.
describe('routines — passages comptes à la lecture', () => {
    const routine = (returnTime: string | null = '18:00') =>
        createRecurringTrip(USER_ID, SOURCE, { daysOfWeek: [1, 3, 5], departureTime: '08:30', returnTime }, NOW);

    it('compte les passages aller-retour des jours actifs entre la création et maintenant', () => {
        // Créée mercredi 15 a 07:00, lue mardi 21 a midi : mer 15, ven 17, lun 20,
        // deux sens à chaque fois. Rien le mardi 21, qui n'est pas un jour actif.
        expect(countOccurrences(routine(), new Date(0), LATER)).toBe(6);
        expect(countOccurrences(routine(null), new Date(0), LATER)).toBe(3);
    });

    it('liste les heures de passage dans l’ordre, aller puis retour', () => {
        const passages = occurrencesBetween(routine(), NOW, new Date(2026, 6, 16));
        expect(passages.map((at) => at.getHours())).toEqual([8, 18]);
        expect(passages[0].getMinutes()).toBe(30);
    });

    // Descendant de B18 : un passage dont l'heure n'est pas encore venue n'est
    // pas fait. Consultée a midi, la routine du jour ne compte que le matin.
    it('ne compte pas un passage dont l’heure n’est pas encore passée', () => {
        const midi = new Date(2026, 6, 15, 12, 0);
        expect(countOccurrences(routine(), new Date(0), midi)).toBe(1);
        // Et rien avant la création : la routine créée a 07:00 ne compte pas un
        // passage de 06:00 le même jour.
        const tot = createRecurringTrip(USER_ID, SOURCE, { daysOfWeek: [3], departureTime: '06:00', returnTime: null }, NOW);
        expect(countOccurrences(tot, new Date(0), midi)).toBe(0);
    });

    it('respecte le plancher : seuls les passages depuis le plancher comptent', () => {
        // Plancher lundi 20 : seuls les deux passages du lundi restent.
        expect(countOccurrences(routine(), new Date(2026, 6, 20), LATER)).toBe(2);
    });

    it('la pause clôt la période, la reprise en ouvre une nouvelle', () => {
        const created = routine();
        expect(isRoutinePaused(created)).toBe(false);

        // Pause jeudi 16 : seuls les passages du mercredi 15 restent comptes.
        const paused = setRecurringPaused(created, true, new Date(2026, 6, 16, 9, 0));
        expect(isRoutinePaused(paused)).toBe(true);
        expect(countOccurrences(paused, new Date(0), LATER)).toBe(2);
        expect(nextOccurrence(paused, LATER)).toBeNull();

        // Reprise lundi 20 a 07:00 : le vendredi 17 reste hors compte, le lundi
        // compte à nouveau.
        const resumed = setRecurringPaused(paused, false, new Date(2026, 6, 20, 7, 0));
        expect(isRoutinePaused(resumed)).toBe(false);
        expect(resumed.periods).toHaveLength(2);
        expect(countOccurrences(resumed, new Date(0), LATER)).toBe(4);

        // Demander l'état déjà en place ne change rien.
        expect(setRecurringPaused(resumed, false)).toBe(resumed);
    });

    it('annonce le prochain passage d’une routine active', () => {
        // Mercredi 07:00 : le prochain passage est l'aller de 08:30 du jour.
        expect(nextOccurrence(routine(), NOW)?.getTime()).toBe(new Date(2026, 6, 15, 8, 30).getTime());
        // Mardi midi : le prochain jour actif est le mercredi 22, aller a 08:30.
        expect(nextOccurrence(routine(), LATER)?.getTime()).toBe(new Date(2026, 6, 22, 8, 30).getTime());
        const sansJour = createRecurringTrip(USER_ID, SOURCE, { daysOfWeek: [], departureTime: '08:30', returnTime: null }, NOW);
        expect(nextOccurrence(sansJour, NOW)).toBeNull();
    });

    it('supprimer une routine retire ses passages des compteurs', () => {
        const created = routine();
        expect(summarizeTripActivity([], [created], LATER).doneTotal).toBe(6);
        expect(summarizeTripActivity([], removeRecurring([created], created.id), LATER).doneTotal).toBe(0);
    });
});

describe('summarizeTripActivity', () => {
    it('agrege les trajets faits et les passages de routine, semaine et mois', () => {
        const routine = createRecurringTrip(USER_ID, SOURCE, { daysOfWeek: [1, 3, 5], departureTime: '08:30', returnTime: '18:00' }, NOW);

        const oldDone: PlannedTrip = {
            ...createPlannedTrip(USER_ID, SOURCE, new Date(2026, 5, 1, 8, 0), NOW),
            id: 'old-done',
            status: 'done',
            completedAt: new Date(2026, 5, 1, 9, 0).toISOString(),
        };
        const recentDone: PlannedTrip = {
            ...createPlannedTrip(USER_ID, SOURCE, new Date(2026, 6, 20, 8, 0), NOW),
            id: 'recent-done',
            status: 'done',
            completedAt: new Date(2026, 6, 20, 9, 0).toISOString(),
        };
        const ahead = { ...createPlannedTrip(USER_ID, SOURCE, new Date(2026, 6, 23, 8, 0), NOW), id: 'ahead' };
        const trips = upsertPlanned(upsertPlanned(upsertPlanned([], oldDone), recentDone), ahead);

        const summary = summarizeTripActivity(trips, [routine], LATER);
        // Depuis toujours : 2 trajets dates faits + 6 passages de routine.
        expect(summary.doneTotal).toBe(8);
        expect(summary.savedTotalGrams).toBe(SOURCE.carbonSavedGrams * 8);
        // Semaine calendaire (lundi 20 juillet) : le trajet du 20 + les 2 passages du lundi.
        expect(summary.doneThisWeek).toBe(3);
        expect(summary.savedThisWeekGrams).toBe(SOURCE.carbonSavedGrams * 3);
        expect(summary.distanceThisWeekKm).toBe(7.2);
        // Mois calendaire (juillet) : le trajet du 1er juin est exclu.
        expect(summary.doneThisMonth).toBe(7);
        expect(summary.savedThisMonthGrams).toBe(SOURCE.carbonSavedGrams * 7);
        // À venir : seuls les trajets dates ; une routine n'est pas « à venir ».
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
