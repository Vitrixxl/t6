// Contrats de lecture des collections du compte. Les ecritures ne prennent
// jamais une liste : chaque ressource possède son PUT/DELETE dans trips.ts.
import { z } from 'zod';
import { plannedTrip, recurringTrip, savedRoute, tripRecord } from './trips';

// Collections telles que le serveur les rend, proprietaire compris.
export const tripRecords = z.array(tripRecord);
export const plannedTrips = z.array(plannedTrip);
export const recurringTrips = z.array(recurringTrip);
export const savedRoutes = z.array(savedRoute);
