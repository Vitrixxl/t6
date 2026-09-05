import { Elysia } from 'elysia';
import { timetableStatus, transitJourneyQuery, transitJourneyResult } from '../../../src/contracts';
import type { AppContext } from '../plugins/context';
import { searchTimetable } from '../services/transit/search';

export function transitRoutes(ctx: AppContext) {
    return new Elysia({ prefix: '/transit', tags: ['Transport'] })
        .use(ctx)
        .get('/network', ({ repositories, set }) => {
            set.headers['cache-control'] = 'no-store';
            const feed = repositories.transit.active();
            return { metadata: feed?.metadata ?? null, network: feed?.network ?? { stops: [], routes: [] } };
        }, {
            response: timetableStatus,
            detail: { summary: 'Réseau et période de validité des horaires importés' },
        })
        .get('/journeys', ({ query, repositories, set }) => {
            set.headers['cache-control'] = 'no-store';
            return searchTimetable(repositories.transit, query.search);
        }, {
            query: transitJourneyQuery,
            response: transitJourneyResult,
            detail: { summary: 'Meilleur trajet horaire en une correspondance au plus, pour la journée demandée et ses prolongements nocturnes' },
        });
}
