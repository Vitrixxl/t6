import { expect, it } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { mkdtemp, mkdir, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import journal from '../../drizzle/meta/_journal.json';
import { openDatabase } from '../db';
import { createUserRepository } from '../repositories/users';

it('migre un ancien profil sans perdre le besoin PMR ni les objectifs et ne rejoue pas l’accueil validé', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'urbanflow-onboarding-'));
    const migrations = join(directory, 'migrations');
    const databasePath = join(directory, 'account.db');
    await mkdir(join(migrations, 'meta'), { recursive: true });
    const entries = journal.entries.filter(entry => entry.idx < 12);
    await Bun.write(join(migrations, 'meta/_journal.json'), JSON.stringify({ ...journal, entries }));
    for (const entry of entries) await copyFile(join(import.meta.dir, '../../drizzle', entry.tag + '.sql'), join(migrations, entry.tag + '.sql'));
    const legacy = new Database(databasePath);
    try {
        migrate(drizzle(legacy), { migrationsFolder: migrations });
        legacy.query('INSERT INTO users (id, email, password_hash, display_name, profile_json, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
            'legacy', 'legacy@example.test', 'hash', 'Ancien compte', JSON.stringify({
                displayName: 'Ancien compte', preferredModes: ['walk'], routePreselection: 'bike',
                accessibilityNeed: true, carbonGoalGramsPerWeek: 3500,
                weeklySavedGoalGrams: 1000, monthlySavedGoalGrams: 9000,
            }), '2026-09-01T00:00:00Z',
        );
    } finally { legacy.close(); }
    const db = openDatabase(databasePath);
    try {
        const users = createUserRepository(db);
        const user = users.findById('legacy');
        expect(user?.profile.availableModes).toEqual(['bike', 'scooter', 'transit']);
        expect(user?.profile.onboardedAt).toBeNull();
        expect(user?.profile.accessibilityNeed).toBe(true);
        expect(user?.profile.monthlySavedGoalGrams).toBe(9000);
        expect(user?.profile).not.toHaveProperty('preferredModes');
        if (!user) throw new Error('Compte perdu pendant la migration');
        users.updateProfile('legacy', { ...user.profile, availableModes: [], onboardedAt: '2026-09-06T08:00:00Z' });
    } finally { db.$client.close(); }
    const reopened = openDatabase(databasePath);
    try {
        const user = createUserRepository(reopened).findById('legacy');
        expect(user?.profile.availableModes).toEqual([]);
        expect(user?.profile.onboardedAt).toBe('2026-09-06T08:00:00Z');
    } finally {
        reopened.$client.close();
        await rm(directory, { recursive: true, force: true });
    }
});
