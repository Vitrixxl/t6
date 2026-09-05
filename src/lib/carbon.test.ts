import { describe, expect, it } from 'bun:test';
import { recordTrip, summarizeCarbon } from './carbon';
import type { PlannedTrip, RecurringTrip, TripRecord } from '../types';
import { summarizeTripActivity } from './trips';

// Le serveur crée les enregistrements carbone à la complétion d’un trajet.
function makeTripRecord(userId: string, createdAt: Date = new Date()): TripRecord {
    return {
        id: crypto.randomUUID(),
        userId,
        routeTitle: 'Vélo',
        modes: ['walk', 'bike'],
        distanceKm: 5,
        durationMinutes: 22,
        carbonGrams: 20,
        carbonSavedGrams: 880,
        createdAt: createdAt.toISOString(),
    };
}

describe('carbon tracking', () => {
    it('creates and summarizes trip records', () => {
        const trip = makeTripRecord('user-1', new Date('2026-09-14T08:00:00+02:00'));
        const summary = summarizeCarbon([trip], [], 2500);

        expect(trip.userId).toBe('user-1');
        expect(summary.trips).toBe(1);
        expect(summary.totalCarbonGrams).toBe(20);
        expect(summary.totalSavedGrams).toBe(880);
        expect(summary.goalUsagePercent).toBe(1);
    });

    it('plafonne la jauge d\'objectif a 999 % et la neutralise si l\'objectif est nul', () => {
        const bigTrip = { ...makeTripRecord('user-3'), carbonGrams: 100000 };

        expect(summarizeCarbon([bigTrip], [], 2500).goalUsagePercent).toBe(999);
        expect(summarizeCarbon([bigTrip], [], 0).goalUsagePercent).toBe(0);
    });

    it('borne l\'historique aux 50 trajets les plus récents, le dernier en tete', () => {
        let records: TripRecord[] = [];
        for (let index = 0; index < 55; index += 1) {
            records = recordTrip(records, makeTripRecord('user-4'));
        }
        const latest = makeTripRecord('user-4');
        records = recordTrip(records, latest);

        expect(records).toHaveLength(50);
        expect(records[0].id).toBe(latest.id);
    });

    it('ne duplique pas un trajet enregistre deux fois sous le même identifiant', () => {
        const trip = makeTripRecord('user-5');

        expect(recordTrip(recordTrip([], trip), trip)).toHaveLength(1);
    });
});

// Verrouille B16. Le suivi affiche « X % de l'objectif hebdomadaire » : le
// total compare a cet objectif doit donc porter sur la semaine en cours, et
// non sur tout l'historique conserve.
describe('summarizeCarbon — fenêtre hebdomadaire', () => {
    const jeudi = new Date(2026, 8, 3, 12, 0);

    it('ignore les trajets des semaines précédentes', () => {
        const cetteSemaine = makeTripRecord('user-1', new Date(2026, 8, 1, 8, 0));
        const semainePassee = makeTripRecord('user-1', new Date(2026, 7, 27, 8, 0));

        const summary = summarizeCarbon([cetteSemaine, semainePassee], [], 2500, jeudi);

        expect(summary.trips).toBe(1);
        expect(summary.totalSavedGrams).toBe(880);
    });

    it('repart de zéro au passage du lundi', () => {
        const dimanche = makeTripRecord('user-1', new Date(2026, 8, 6, 20, 0));
        const lundiSuivant = new Date(2026, 8, 7, 9, 0);

        expect(summarizeCarbon([dimanche], [], 2500, new Date(2026, 8, 6, 23, 0)).trips).toBe(1);
        expect(summarizeCarbon([dimanche], [], 2500, lundiSuivant).trips).toBe(0);
    });

    it('compte un trajet fait le lundi a minuit', () => {
        const lundiMinuit = makeTripRecord('user-1', new Date(2026, 8, 7, 0, 0));
        expect(summarizeCarbon([lundiMinuit], [], 2500, new Date(2026, 8, 7, 9, 0)).trips).toBe(1);
    });
});

// Les deux écrans qui affichent le CO2 évité de la semaine s'alimentent a des
// sources différentes : le suivi carbone aux enregistrements, les objectifs aux
// trajets planifies marques faits. Marquer un trajet fait produit pourtant les
// deux. Ce test lie les deux calculs pour qu'ils ne puissent plus rediverger.
describe('cohérence entre le suivi carbone et les objectifs', () => {
    it('annonce le même CO2 évité pour la même semaine', () => {
        const jeudi = new Date(2026, 8, 3, 12, 0);
        const trajets: PlannedTrip[] = [
            makePlannedTrip('done', new Date(2026, 8, 1, 8, 0), 400),
            makePlannedTrip('done', new Date(2026, 8, 2, 8, 0), 250),
            // Semaine précédente : ni l'un ni l'autre ne doit la compter.
            makePlannedTrip('done', new Date(2026, 7, 27, 8, 0), 999),
        ];
        const records = trajets.map((trip): TripRecord => ({
            ...makeTripRecord(trip.userId, new Date(trip.completedAt ?? trip.scheduledFor)),
            carbonSavedGrams: trip.carbonSavedGrams,
        }));
        // Routine des jours ouvrés, créée le lundi 31 aout a 07:00 : lundi, mardi,
        // mercredi et jeudi matin sont déjà passes, soit 4 passages de 100 g.
        const routines = [makeRoutine(new Date(2026, 7, 31, 7, 0), 100)];

        const suivi = summarizeCarbon(records, routines, 2500, jeudi);
        const objectifs = summarizeTripActivity(trajets, routines, jeudi);

        expect(suivi.totalSavedGrams).toBe(objectifs.savedThisWeekGrams);
        expect(suivi.totalSavedGrams).toBe(650 + 400);
        expect(suivi.trips).toBe(objectifs.doneThisWeek);
        expect(suivi.trips).toBe(2 + 4);
    });
});

function makeRoutine(createdAt: Date, carbonSavedGrams: number): RecurringTrip {
    return {
        id: crypto.randomUUID(),
        userId: 'user-1',
        label: 'Domicile-travail',
        origin: { label: 'A', lat: 45.75, lon: 4.83 },
        destination: { label: 'B', lat: 45.76, lon: 4.86 },
        modes: ['bike'],
        distanceKm: 5,
        durationMinutes: 20,
        carbonGrams: 20,
        carbonSavedGrams,
        daysOfWeek: [1, 2, 3, 4, 5],
        departureTime: '08:00',
        returnTime: null,
        periods: [{ from: createdAt.toISOString(), to: null }],
        cancelledPassages: [],
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        createdAt: createdAt.toISOString(),
    };
}

function makePlannedTrip(status: 'done' | 'planned', completedAt: Date, carbonSavedGrams: number): PlannedTrip {
    return {
        id: crypto.randomUUID(),
        userId: 'user-1',
        label: 'Domicile-travail',
        origin: { label: 'A', lat: 45.75, lon: 4.83 },
        destination: { label: 'B', lat: 45.76, lon: 4.86 },
        modes: ['bike'],
        distanceKm: 5,
        durationMinutes: 20,
        carbonGrams: 20,
        carbonSavedGrams,
        scheduledFor: completedAt.toISOString(),
        status,
        createdAt: completedAt.toISOString(),
        completedAt: completedAt.toISOString(),
    };
}
