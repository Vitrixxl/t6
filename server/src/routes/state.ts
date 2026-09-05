// Vue complète du compte, utilisée uniquement pour amorcer la session. Les
// commandes des ressources vivent dans leurs modules de routes respectifs.
import { completeDueTrips } from '../services/planned-trips.ts';
import { Elysia } from 'elysia';
import { authGuard } from '../plugins/auth.ts';
import type { AppContext } from '../plugins/context.ts';
import { accountState, errorResponse } from '../../../src/contracts/index.ts';

export function stateRoutes(ctx: AppContext) {
    return new Elysia({ tags: ['État du compte'] }).use(authGuard(ctx)).get(
        '/state',
        ({ userId, repositories, status, db }) => {
            const row = repositories.users.findById(userId);
            if (!row) {
                return status(401, { error: 'Session expirée.' });
            }
            completeDueTrips(db, userId);
            return repositories.state.fullState(userId, row.profile);
        },
        {
            response: { 200: accountState, 401: errorResponse },
            detail: { summary: 'Lire l’état complet du compte' },
        },
    );
}
