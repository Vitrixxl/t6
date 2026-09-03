import { describe, expect, it } from '../test/harness';
import { recordTrip, summarizeCarbon } from './carbon';
import type { PlannedTrip, TripRecord } from '../types';
import { plannedTripToRecord, summarizeTripActivity } from './trips';

// Les enregistrements sont produits en pratique par plannedTripToRecord
// quand un trajet planifie est marque fait.
function makeTripRecord(userId: string, createdAt: Date = new Date()): TripRecord {
  return {
    id: crypto.randomUUID(),
    userId,
    routeTitle: 'Velo',
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
    const summary = summarizeCarbon([trip], 2500);

    expect(trip.userId).toBe('user-1');
    expect(summary.trips).toBe(1);
    expect(summary.totalCarbonGrams).toBe(20);
    expect(summary.totalSavedGrams).toBe(880);
    expect(summary.goalUsagePercent).toBe(1);
  });

  it('plafonne la jauge d\'objectif a 999 % et la neutralise si l\'objectif est nul', () => {
    const bigTrip = { ...makeTripRecord('user-3'), carbonGrams: 100000 };

    expect(summarizeCarbon([bigTrip], 2500).goalUsagePercent).toBe(999);
    expect(summarizeCarbon([bigTrip], 0).goalUsagePercent).toBe(0);
  });

  it('borne l\'historique aux 50 trajets les plus recents, le dernier en tete', () => {
    let records: TripRecord[] = [];
    for (let index = 0; index < 55; index += 1) {
      records = recordTrip(records, makeTripRecord('user-4'));
    }
    const latest = makeTripRecord('user-4');
    records = recordTrip(records, latest);

    expect(records).toHaveLength(50);
    expect(records[0].id).toBe(latest.id);
  });

  it('ne duplique pas un trajet enregistre deux fois sous le meme identifiant', () => {
    const trip = makeTripRecord('user-5');

    expect(recordTrip(recordTrip([], trip), trip)).toHaveLength(1);
  });
});

// Verrouille B16. Le suivi affiche « X % de l'objectif hebdomadaire » : le
// total compare a cet objectif doit donc porter sur la semaine en cours, et
// non sur tout l'historique conserve.
describe('summarizeCarbon — fenetre hebdomadaire', () => {
  const jeudi = new Date(2026, 8, 3, 12, 0);

  it('ignore les trajets des semaines precedentes', () => {
    const cetteSemaine = makeTripRecord('user-1', new Date(2026, 8, 1, 8, 0));
    const semainePassee = makeTripRecord('user-1', new Date(2026, 7, 27, 8, 0));

    const summary = summarizeCarbon([cetteSemaine, semainePassee], 2500, jeudi);

    expect(summary.trips).toBe(1);
    expect(summary.totalSavedGrams).toBe(880);
  });

  it('repart de zero au passage du lundi', () => {
    const dimanche = makeTripRecord('user-1', new Date(2026, 8, 6, 20, 0));
    const lundiSuivant = new Date(2026, 8, 7, 9, 0);

    expect(summarizeCarbon([dimanche], 2500, new Date(2026, 8, 6, 23, 0)).trips).toBe(1);
    expect(summarizeCarbon([dimanche], 2500, lundiSuivant).trips).toBe(0);
  });

  it('compte un trajet fait le lundi a minuit', () => {
    const lundiMinuit = makeTripRecord('user-1', new Date(2026, 8, 7, 0, 0));
    expect(summarizeCarbon([lundiMinuit], 2500, new Date(2026, 8, 7, 9, 0)).trips).toBe(1);
  });
});

// Les deux ecrans qui affichent le CO2 evite de la semaine s'alimentent a des
// sources differentes : le suivi carbone aux enregistrements, les objectifs aux
// trajets planifies marques faits. Marquer un trajet fait produit pourtant les
// deux. Ce test lie les deux calculs pour qu'ils ne puissent plus rediverger.
describe('coherence entre le suivi carbone et les objectifs', () => {
  it('annonce le meme CO2 evite pour la meme semaine', () => {
    const jeudi = new Date(2026, 8, 3, 12, 0);
    const trajets: PlannedTrip[] = [
      makePlannedTrip('done', new Date(2026, 8, 1, 8, 0), 400),
      makePlannedTrip('done', new Date(2026, 8, 2, 8, 0), 250),
      // Semaine precedente : ni l'un ni l'autre ne doit la compter.
      makePlannedTrip('done', new Date(2026, 7, 27, 8, 0), 999),
    ];
    const records = trajets.map((trip) => plannedTripToRecord(trip, jeudi));

    const suivi = summarizeCarbon(records, 2500, jeudi);
    const objectifs = summarizeTripActivity(trajets, [], jeudi);

    expect(suivi.totalSavedGrams).toBe(objectifs.savedThisWeekGrams);
    expect(suivi.totalSavedGrams).toBe(650);
  });
});

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
    recurringTripId: null,
    createdAt: completedAt.toISOString(),
    completedAt: completedAt.toISOString(),
  };
}
