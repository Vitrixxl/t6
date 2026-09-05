import { expect, it } from 'bun:test';
import { openDatabase } from '../db/index.ts';
import { createRepositories } from '../repositories/index.ts';
import { seedTestAccount, TEST_EMAIL } from '../seed-test.ts';
import { DEFAULT_PROFILE } from '../../../src/contracts/index.ts';
import { tripEvolution } from '../../../src/lib/trip-evolution.ts';

it('recrée seulement le compte de test et fournit huit semaines cohérentes', async () => {
    const db = openDatabase(':memory:');
    try {
        const repos = createRepositories(db);
        repos.users.insert({ id: 'neighbor', email: 'voisin@example.test', displayName: 'Voisin',
            passwordHash: 'unused', createdAt: new Date().toISOString(), profile: DEFAULT_PROFILE });
        const now = new Date('2026-09-05T12:00:00Z');
        await seedTestAccount(db, 'UrbanFlow2026!', now);
        const id = await seedTestAccount(db, 'UrbanFlow2026!', now);
        expect(repos.users.findByEmail(TEST_EMAIL)?.id).toBe(id);
        expect(repos.users.findByEmail('voisin@example.test')?.id).toBe('neighbor');
        const trips = repos.plannedTrips.list(id);
        const routines = repos.recurringTrips.list(id);
        const records = repos.tripRecords.list(id);
        expect(trips).toHaveLength(35);
        expect(records).toHaveLength(28);
        expect(routines).toHaveLength(3);
        expect(repos.savedRoutes.list(id)).toHaveLength(1);
        expect(records.every((record) => new Date(record.createdAt) < now)).toBe(true);
        expect(trips.filter((trip) => trip.status === 'cancelled')).toHaveLength(5);
        expect(routines.every((routine) => new Date(routine.createdAt) < now)).toBe(true);
        expect(tripEvolution(records, routines, now).every((week) => week.trips > 0)).toBe(true);
    } finally {
        db.$client.close();
    }
});
