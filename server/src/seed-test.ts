// Jeu fictif de recette : les dates glissent avec le jour d’exécution.
// Seul le compte réservé test@urbanflow.local est réinitialisé.
import { loadConfig } from './config/index.ts';
import { openDatabase, type Db } from './db/index.ts';
import { createRepositories } from './repositories/index.ts';
import { hashPassword } from './security/password.ts';
import { DEFAULT_PROFILE, TERMS_VERSION, plannedTrip, recurringTrip, savedRoute, type PlannedTrip } from '../../src/contracts/index.ts';
import { atCalendarTime, calendarDate } from '../../src/lib/trips/calendar.ts';

export const TEST_EMAIL = 'test@urbanflow.local';

export async function seedTestAccount(db: Db, password: string, now = new Date()) {
    const passwordHash = await hashPassword(password);
    const today = calendarDate(now, 'Europe/Paris');
    const dateAt = (offset: number, time = '09:00') => {
        const date = new Date(`${today}T12:00:00Z`);
        date.setUTCDate(date.getUTCDate() + offset);
        return atCalendarTime(date.toISOString().slice(0, 10), time, 'Europe/Paris').toISOString();
    };
    const createdAt = dateAt(-56, '00:00');
    return db.transaction((tx) => {
        const repositories = createRepositories(tx);
        const existing = repositories.users.findByEmail(TEST_EMAIL);
        if (existing) repositories.users.delete(existing.id);
        const userId = crypto.randomUUID();
        // Un compte de recette a déjà répondu aux questions d'accueil : les scénarios partent de la carte.
        const profile = { ...DEFAULT_PROFILE, displayName: 'Test · données fictives', carbonGoalGramsPerWeek: 2500, onboardedAt: createdAt };
        repositories.users.insert({
            id: userId, email: TEST_EMAIL, displayName: profile.displayName, passwordHash, createdAt, profile,
            termsAcceptedAt: createdAt, termsVersion: TERMS_VERSION,
        });
        const journey = {
            userId,
            origin: { label: 'Test · Bellecour', lat: 45.7578, lon: 4.832 },
            destination: { label: 'Test · Part-Dieu', lat: 45.7606, lon: 4.8594 },
            modes: ['bike'], distanceKm: 4, durationMinutes: 18,
            carbonGrams: 40, carbonSavedGrams: 600, createdAt,
        };
        const addPlannedTrip = (trip: PlannedTrip) => {
            repositories.plannedTrips.upsert(trip);
            if (trip.status === 'done') repositories.tripRecords.upsert({
                ...trip, id: 'trip:' + trip.id, routeTitle: trip.label, createdAt: trip.scheduledFor,
            });
        };
        // Quatre ponctuels par semaine : variations, annulations et référence absente.
        for (let index = 0; index < 32; index += 1) {
            const scheduledFor = dateAt(-56 + Math.floor(index / 4) * 7 + index % 4);
            const cancelled = index % 7 === 0;
            const trip = plannedTrip.parse({
                ...journey, id: crypto.randomUUID(), label: `Test · sortie ${index + 1}`,
                distanceKm: 3 + index % 9, carbonGrams: 30 + (index % 6) * 90,
                carbonSavedGrams: index % 9 === 0 ? null : 200 + (index % 5) * 150,
                scheduledFor, status: cancelled ? 'cancelled' : 'done', completedAt: cancelled ? null : scheduledFor,
            });
            addPlannedTrip(trip);
        }
        for (const offset of [-1, 1, 3]) {
            const trip = plannedTrip.parse({ ...journey, id: crypto.randomUUID(),
                label: offset < 0 ? 'Test · ponctuel passé' : 'Test · à venir J+' + offset,
                scheduledFor: dateAt(offset), status: offset < 0 ? 'done' : 'planned', completedAt: offset < 0 ? dateAt(offset) : null });
            addPlannedTrip(trip);
        }
        const daily = recurringTrip.parse({ ...journey, id: crypto.randomUUID(), label: 'Test · quotidien aller-retour',
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6], timeZone: 'Europe/Paris', departureTime: '08:30', returnTime: '18:00',
            periods: [{ from: createdAt, to: null }],
            cancelledPassages: [
                { date: calendarDate(new Date(dateAt(-2)), 'Europe/Paris'), direction: 'outbound' },
                { date: calendarDate(new Date(dateAt(-3)), 'Europe/Paris'), direction: 'outbound' },
                { date: calendarDate(new Date(dateAt(-3)), 'Europe/Paris'), direction: 'return' },
            ],
        });
        repositories.recurringTrips.upsert(daily);
        repositories.recurringTrips.upsert({ ...daily, id: crypto.randomUUID(), label: 'Test · travail avec une pause',
            modes: ['transit'], carbonGrams: 150, carbonSavedGrams: 450, daysOfWeek: [1, 2, 3, 4, 5],
            periods: [{ from: createdAt, to: dateAt(-28, '00:00') }, { from: dateAt(-14, '00:00'), to: null }], cancelledPassages: [] });
        repositories.recurringTrips.upsert({ ...daily, id: crypto.randomUUID(), label: 'Test · routine en pause',
            returnTime: null, periods: [{ from: dateAt(-35, '00:00'), to: dateAt(-7, '00:00') }], cancelledPassages: [] });
        repositories.savedRoutes.upsert(savedRoute.parse({ ...journey, id: crypto.randomUUID(),
            routeId: 'bike', routeTitle: 'Test · vélo enregistré' }));
        return userId;
    });
}

if (import.meta.main) {
    const config = loadConfig();
    const password = Bun.env.TEST_PASSWORD ?? 'UrbanFlow2026!';
    if (config.isProduction && !Bun.env.TEST_PASSWORD) throw new Error('Définir TEST_PASSWORD en production.');
    const db = openDatabase(config.databasePath);
    try {
        await seedTestAccount(db, password);
        console.log(`Compte prêt : ${TEST_EMAIL} — 35 ponctuels, 3 récurrences, 1 enregistré, 8 semaines de données fictives.`);
        console.log('Seul ce compte a été réinitialisé. Mot de passe : TEST_PASSWORD ou UrbanFlow2026! par défaut hors production.');
    } finally {
        db.$client.close();
    }
}
