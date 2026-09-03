// Planification : trajets programmes et routines.
//
// Regroupe toutes les transitions du domaine (programmer, marquer fait,
// annuler, mettre en pause, supprimer) sur l'etat du compte. Le composant qui
// l'utilise n'a plus qu'a cabler des poignees a des boutons : les consequences
// d'une action - une pause clot la periode d'activite d'une routine, un trajet
// fait alimente l'historique carbone - sont decidees ici, et chaque action
// part au serveur en un seul envoi.
//
// Une routine n'engendre aucun trajet : ses passages sont comptes a la
// lecture (lib/trips/routines.ts). Il n'y a donc rien a generer a l'ouverture
// ni a purger a la pause.
import { useState } from 'react';
import type { PlannedTrip, RecurringTrip } from '../../../types';
import { recordTrip } from '../../../lib/carbon';
import {
  createPlannedTrip,
  createRecurringTrip,
  isRoutinePaused,
  plannedTripToRecord,
  removePlanned,
  removeRecurring,
  setPlannedStatus,
  setRecurringPaused,
  upsertPlanned,
  upsertRecurring,
  type TripSource,
} from '../../../lib/trips';
import type { Account } from './useAccount';

/** Ce que le formulaire de planification renvoie. */
export interface PlanSubmission {
  kind: 'once' | 'recurring';
  label: string;
  scheduledFor?: Date;
  daysOfWeek?: number[];
  departureTime?: string;
  returnTime?: string | null;
}

export interface TripPlanning {
  plannedTrips: PlannedTrip[];
  recurringTrips: RecurringTrip[];
  /** Trajet en cours de planification, ou null si le formulaire est ferme. */
  planSource: TripSource | null;
  startPlanning: (source: TripSource) => void;
  cancelPlanning: () => void;
  /** Renvoie l'onglet du hub a ouvrir, ou null si la soumission etait incomplete. */
  submitPlan: (plan: PlanSubmission) => 'upcoming' | 'recurring' | null;
  markTripDone: (trip: PlannedTrip) => void;
  cancelTrip: (trip: PlannedTrip) => void;
  removeTrip: (trip: PlannedTrip) => void;
  toggleRecurringPaused: (trip: RecurringTrip) => void;
  removeRecurring: (trip: RecurringTrip) => void;
}

export function useTripPlanning(account: Account): TripPlanning {
  const { update } = account;
  const userId = account.user.id;
  const { plannedTrips, recurringTrips } = account.state;
  const [planSource, setPlanSource] = useState<TripSource | null>(null);

  return {
    plannedTrips,
    recurringTrips,
    planSource,
    startPlanning: setPlanSource,
    cancelPlanning: () => setPlanSource(null),

    submitPlan(plan) {
      if (!planSource) {
        return null;
      }
      const source = { ...planSource, label: plan.label };

      if (plan.kind === 'once' && plan.scheduledFor) {
        const trip = createPlannedTrip(userId, source, plan.scheduledFor);
        update((state) => ({ ...state, plannedTrips: upsertPlanned(state.plannedTrips, trip) }));
        setPlanSource(null);
        return 'upcoming';
      }

      if (plan.kind === 'recurring' && plan.daysOfWeek && plan.departureTime) {
        const template = createRecurringTrip(userId, source, {
          daysOfWeek: plan.daysOfWeek,
          departureTime: plan.departureTime,
          returnTime: plan.returnTime ?? null,
        });
        update((state) => ({ ...state, recurringTrips: upsertRecurring(state.recurringTrips, template) }));
        setPlanSource(null);
        return 'recurring';
      }

      return null;
    },

    markTripDone(trip) {
      update((state) => {
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
    },

    cancelTrip(trip) {
      update((state) => ({ ...state, plannedTrips: setPlannedStatus(state.plannedTrips, trip.id, 'cancelled') }));
    },

    removeTrip(trip) {
      update((state) => ({ ...state, plannedTrips: removePlanned(state.plannedTrips, trip.id) }));
    },

    toggleRecurringPaused(trip) {
      update((state) => ({
        ...state,
        recurringTrips: setRecurringPaused(state.recurringTrips, trip.id, !isRoutinePaused(trip)),
      }));
    },

    removeRecurring(trip) {
      update((state) => ({ ...state, recurringTrips: removeRecurring(state.recurringTrips, trip.id) }));
    },
  };
}
