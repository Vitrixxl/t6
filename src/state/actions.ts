// Actions sur l'etat du compte, et l'etat d'interface qu'elles pilotent.
//
// Chaque action est une fonction pure sur des listes, appliquee par
// `updateAccountAtom`, donc suivie d'un envoi. Les consequences d'une action
// sont decidees ici, pas dans les composants : une pause retire les occurrences
// a venir, une reprise les rematerialise, un trajet fait alimente l'historique
// carbone, une planification ouvre l'onglet du hub qui la montre.
import { atom } from 'jotai';
import type { GeoPoint, MobilityProfile, PlannedTrip, RecurringTrip, RouteOption } from '../types';
import { sanitizeProfile } from '../lib/auth';
import { recordTrip } from '../lib/carbon';
import { addSavedRoute, createSavedRouteRecord, removeSavedRoute } from '../lib/savedRoutes';
import {
  createPlannedTrip,
  createRecurringTrip,
  materializeOccurrences,
  plannedTripToRecord,
  pruneForRecurring,
  removePlanned,
  removeRecurring,
  setPlannedStatus,
  setRecurringPaused,
  upsertPlanned,
  upsertRecurring,
  type TripSource,
} from '../lib/trips';
import { sessionAtom, updateAccountAtom } from './session';

// --- Profil et historique ---------------------------------------------------

export const setProfileAtom = atom(null, (_get, set, profile: MobilityProfile) => {
  set(updateAccountAtom, (state) => ({ ...state, profile: sanitizeProfile(profile) }));
});

export const clearTripHistoryAtom = atom(null, (_get, set) => {
  set(updateAccountAtom, (state) => ({ ...state, tripRecords: [] }));
});

// --- Trajets programmes et routines ----------------------------------------

export const markTripDoneAtom = atom(null, (_get, set, trip: PlannedTrip) => {
  set(updateAccountAtom, (state) => {
    const planned = setPlannedStatus(state.plannedTrips, trip.id, 'done');
    // Un trajet fait alimente l'historique carbone : c'est la seule
    // transition qui sort du domaine planification.
    const done = planned.find((item) => item.id === trip.id);
    return {
      ...state,
      plannedTrips: planned,
      tripRecords: done ? recordTrip(state.tripRecords, plannedTripToRecord(done)) : state.tripRecords,
    };
  });
});

export const cancelTripAtom = atom(null, (_get, set, trip: PlannedTrip) => {
  set(updateAccountAtom, (state) => ({ ...state, plannedTrips: setPlannedStatus(state.plannedTrips, trip.id, 'cancelled') }));
});

export const removeTripAtom = atom(null, (_get, set, trip: PlannedTrip) => {
  set(updateAccountAtom, (state) => ({ ...state, plannedTrips: removePlanned(state.plannedTrips, trip.id) }));
});

export const toggleRecurringPausedAtom = atom(null, (get, set, trip: RecurringTrip) => {
  const userId = get(sessionAtom)?.user.id ?? trip.userId;
  set(updateAccountAtom, (state) => {
    const recurring = setRecurringPaused(state.recurringTrips, trip.id, !trip.paused);
    // Reprise : rematerialiser les occurrences de la fenetre.
    // Pause : les occurrences encore a faire disparaissent du plan.
    const planned = trip.paused
      ? materializeOccurrences(recurring, state.plannedTrips, userId)
      : pruneForRecurring(state.plannedTrips, trip.id);
    return { ...state, recurringTrips: recurring, plannedTrips: planned };
  });
});

export const removeRecurringAtom = atom(null, (_get, set, trip: RecurringTrip) => {
  set(updateAccountAtom, (state) => ({
    ...state,
    recurringTrips: removeRecurring(state.recurringTrips, trip.id),
    plannedTrips: pruneForRecurring(state.plannedTrips, trip.id),
  }));
});

// --- Itineraires enregistres -----------------------------------------------

export const saveRouteAtom = atom(
  null,
  (get, set, input: { option: RouteOption; origin: GeoPoint; destination: GeoPoint }) => {
    const session = get(sessionAtom);
    if (!session) {
      return;
    }
    const record = createSavedRouteRecord(session.user.id, input.origin, input.destination, input.option);
    set(updateAccountAtom, (state) => ({ ...state, savedRoutes: addSavedRoute(state.savedRoutes, record) }));
  },
);

export const deleteSavedRouteAtom = atom(null, (_get, set, recordId: string) => {
  set(updateAccountAtom, (state) => ({ ...state, savedRoutes: removeSavedRoute(state.savedRoutes, recordId) }));
});

// --- Planification : formulaire et hub -------------------------------------

export type TripsHubTab = 'upcoming' | 'recurring' | 'history' | 'saved';

/** Trajet en cours de planification, ou null si le formulaire est ferme. */
export const planSourceAtom = atom<TripSource | null>(null);

export const tripsHubAtom = atom<{ open: boolean; tab: TripsHubTab }>({ open: false, tab: 'upcoming' });

export const openHubAtom = atom(null, (_get, set, tab: TripsHubTab = 'upcoming') => {
  set(tripsHubAtom, { open: true, tab });
});

export const closeHubAtom = atom(null, (get, set) => {
  set(tripsHubAtom, { ...get(tripsHubAtom), open: false });
});

/** Ce que le formulaire de planification renvoie. */
export interface PlanSubmission {
  kind: 'once' | 'recurring';
  label: string;
  scheduledFor?: Date;
  daysOfWeek?: number[];
  departureTime?: string;
  returnTime?: string | null;
}

/**
 * Enregistre la planification et ouvre l'onglet du hub qui la montre. Rend
 * l'onglet ouvert, ou null si la soumission etait incomplete.
 */
export const submitPlanAtom = atom(null, (get, set, plan: PlanSubmission): TripsHubTab | null => {
  const planSource = get(planSourceAtom);
  const session = get(sessionAtom);
  if (!planSource || !session) {
    return null;
  }
  const userId = session.user.id;
  const source = { ...planSource, label: plan.label };

  if (plan.kind === 'once' && plan.scheduledFor) {
    const trip = createPlannedTrip(userId, source, plan.scheduledFor);
    set(updateAccountAtom, (state) => ({ ...state, plannedTrips: upsertPlanned(state.plannedTrips, trip) }));
    set(planSourceAtom, null);
    set(openHubAtom, 'upcoming');
    return 'upcoming';
  }

  if (plan.kind === 'recurring' && plan.daysOfWeek && plan.departureTime) {
    const template = createRecurringTrip(userId, source, {
      daysOfWeek: plan.daysOfWeek,
      departureTime: plan.departureTime,
      returnTime: plan.returnTime ?? null,
    });
    set(updateAccountAtom, (state) => {
      const recurring = upsertRecurring(state.recurringTrips, template);
      return { ...state, recurringTrips: recurring, plannedTrips: materializeOccurrences(recurring, state.plannedTrips, userId) };
    });
    set(planSourceAtom, null);
    set(openHubAtom, 'recurring');
    return 'recurring';
  }

  return null;
});
