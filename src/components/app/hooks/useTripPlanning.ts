// Planification : trajets programmes et routines.
//
// Regroupe toutes les transitions du domaine (programmer, marquer fait,
// annuler, mettre en pause, supprimer) sur l'etat du compte. Le composant qui
// l'utilise n'a plus qu'a cabler des poignees a des boutons : les consequences
// d'une action - une pause retire les occurrences a venir, une reprise les
// rematerialise, un trajet fait alimente l'historique carbone - sont decidees
// ici, et chaque action part au serveur en un seul envoi.
import { useEffect, useState } from 'react';
import type { PlannedTrip, RecurringTrip } from '../../../types';
import { recordTrip } from '../../../lib/carbon';
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

  // Les occurrences des routines sont rematerialisees a l'ouverture :
  // l'utilisateur retrouve sa semaine planifiee sans action de sa part.
  useEffect(() => {
    update((state) => {
      const planned = materializeOccurrences(state.recurringTrips, state.plannedTrips, userId);
      return planned === state.plannedTrips ? state : { ...state, plannedTrips: planned };
    });
    // Une seule fois par montage : la fenetre glissante ne bouge pas en cours de session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        update((state) => {
          const recurring = upsertRecurring(state.recurringTrips, template);
          return { ...state, recurringTrips: recurring, plannedTrips: materializeOccurrences(recurring, state.plannedTrips, userId) };
        });
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
      update((state) => {
        const recurring = setRecurringPaused(state.recurringTrips, trip.id, !trip.paused);
        // Reprise : rematerialiser les occurrences de la fenetre.
        // Pause : les occurrences encore a faire disparaissent du plan.
        const planned = trip.paused
          ? materializeOccurrences(recurring, state.plannedTrips, userId)
          : pruneForRecurring(state.plannedTrips, trip.id);
        return { ...state, recurringTrips: recurring, plannedTrips: planned };
      });
    },

    removeRecurring(trip) {
      update((state) => ({
        ...state,
        recurringTrips: removeRecurring(state.recurringTrips, trip.id),
        plannedTrips: pruneForRecurring(state.plannedTrips, trip.id),
      }));
    },
  };
}
