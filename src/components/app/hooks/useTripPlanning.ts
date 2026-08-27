// Planification : trajets programmes et routines.
//
// Regroupe l'etat et toutes les transitions du domaine (programmer, marquer
// fait, annuler, mettre en pause, supprimer). Le composant qui l'utilise
// n'a plus qu'a cabler des poignees a des boutons : les consequences d'une
// action - notamment le fait qu'une pause retire les occurrences a venir, et
// qu'une reprise les rematerialise - sont decidees ici.
import { useState } from 'react';
import type { PlannedTrip, RecurringTrip, TripRecord } from '../../../types';
import {
  createPlannedTrip,
  createRecurringTrip,
  deletePlannedTrip,
  deleteRecurringTrip,
  loadRecurringTrips,
  plannedTripToRecord,
  prunePlannedForRecurring,
  savePlannedTrip,
  saveRecurringTrip,
  setPlannedTripStatus,
  setRecurringTripPaused,
  syncRecurringOccurrences,
  type TripSource,
} from '../../../lib/trips';

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

export function useTripPlanning(userId: string, onTripCompleted: (record: TripRecord) => void): TripPlanning {
  // Les occurrences des routines sont rematerialisees au montage : l'utilisateur
  // retrouve sa semaine planifiee sans action de sa part.
  const [plannedTrips, setPlannedTrips] = useState<PlannedTrip[]>(() => syncRecurringOccurrences(userId));
  const [recurringTrips, setRecurringTrips] = useState<RecurringTrip[]>(() => loadRecurringTrips(userId));
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
        setPlannedTrips(savePlannedTrip(createPlannedTrip(userId, source, plan.scheduledFor)));
        setPlanSource(null);
        return 'upcoming';
      }

      if (plan.kind === 'recurring' && plan.daysOfWeek && plan.departureTime) {
        setRecurringTrips(
          saveRecurringTrip(
            createRecurringTrip(userId, source, {
              daysOfWeek: plan.daysOfWeek,
              departureTime: plan.departureTime,
              returnTime: plan.returnTime ?? null,
            }),
          ),
        );
        setPlannedTrips(syncRecurringOccurrences(userId));
        setPlanSource(null);
        return 'recurring';
      }

      return null;
    },

    markTripDone(trip) {
      const updated = setPlannedTripStatus(userId, trip.id, 'done');
      setPlannedTrips(updated);
      // Un trajet fait alimente l'historique carbone : c'est la seule
      // transition qui sort du domaine planification.
      const done = updated.find((item) => item.id === trip.id);
      if (done) {
        onTripCompleted(plannedTripToRecord(done));
      }
    },

    cancelTrip(trip) {
      setPlannedTrips(setPlannedTripStatus(userId, trip.id, 'cancelled'));
    },

    removeTrip(trip) {
      setPlannedTrips(deletePlannedTrip(userId, trip.id));
    },

    toggleRecurringPaused(trip) {
      setRecurringTrips(setRecurringTripPaused(userId, trip.id, !trip.paused));
      if (trip.paused) {
        // Reprise : rematerialiser les occurrences de la fenetre.
        setPlannedTrips(syncRecurringOccurrences(userId));
      } else {
        // Pause : les occurrences encore a faire disparaissent du plan.
        setPlannedTrips(prunePlannedForRecurring(userId, trip.id));
      }
    },

    removeRecurring(trip) {
      const { recurring, planned } = deleteRecurringTrip(userId, trip.id);
      setRecurringTrips(recurring);
      setPlannedTrips(planned);
    },
  };
}
