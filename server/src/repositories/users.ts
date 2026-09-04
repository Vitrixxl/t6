// Depot des comptes.
import { eq } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { users } from '../db/schema.ts';
import type { MobilityProfile } from '../../../src/types.ts';
import type { NewUserRow, UserRow } from './mappers.ts';

export function createUserRepository(db: Executor) {
    return {
        findByEmail(email: string): UserRow | null {
            return db.select().from(users).where(eq(users.email, email)).get() ?? null;
        },

        findById(id: string): UserRow | null {
            return db.select().from(users).where(eq(users.id, id)).get() ?? null;
        },

        insert(row: NewUserRow): void {
            db.insert(users).values(row).run();
        },

        updateProfile(userId: string, profile: MobilityProfile): void {
            db.update(users).set({ displayName: profile.displayName, profile }).where(eq(users.id, userId)).run();
        },

        /** Droit a l'effacement (RGPD art. 17) : la cascade emporte toutes les donnees liees. */
        delete(userId: string): void {
            db.delete(users).where(eq(users.id, userId)).run();
        },
    };
}
