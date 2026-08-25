// Depot des comptes.
import type { Database } from '../db/index.ts';
import type { MobilityProfile } from '../../../src/types.ts';
import type { UserRow } from './mappers.ts';

export function createUserRepository(db: Database) {
  return {
    findByEmail(email: string): UserRow | null {
      return db.query('SELECT * FROM users WHERE email = ?').get(email) as UserRow | null;
    },

    findById(id: string): UserRow | null {
      return db.query('SELECT * FROM users WHERE id = ?').get(id) as UserRow | null;
    },

    insert(row: UserRow): void {
      db.query(
        `INSERT INTO users (id, email, display_name, password_hash, created_at, profile_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(row.id, row.email, row.display_name, row.password_hash, row.created_at, row.profile_json);
    },

    updateProfile(userId: string, profile: MobilityProfile): void {
      db.query('UPDATE users SET display_name = ?, profile_json = ? WHERE id = ?').run(
        profile.displayName,
        JSON.stringify(profile),
        userId,
      );
    },

    /** Droit a l'effacement (RGPD art. 17) : la cascade emporte toutes les donnees liees. */
    delete(userId: string): void {
      db.query('DELETE FROM users WHERE id = ?').run(userId);
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
