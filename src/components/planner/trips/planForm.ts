// Le formulaire de planification : un trajet date, ou une routine.
//
// Les deux formes partagent un seul schema plat, plus simple a tenir dans un
// formulaire que deux variantes ; ce qui ne vaut que pour l'une se verifie
// selon le type choisi. Les heures et les jours reprennent les contrats de la
// routine : ce qui passe ici passe a l'API.
import { z } from 'zod';
import { dayOfWeek, timeOfDay } from '../../../contracts';

export const planForm = z
  .object({
    kind: z.enum(['once', 'recurring']),
    /** Vide, le nom du trajet source s'applique. */
    label: z.string().max(200, '200 caracteres au plus.'),
    date: z.date().nullable(),
    time: timeOfDay,
    daysOfWeek: z.array(dayOfWeek).max(7),
    departureTime: timeOfDay,
    roundTrip: z.boolean(),
    returnTime: timeOfDay,
  })
  .superRefine((values, ctx) => {
    if (values.kind === 'once' && !values.date) {
      ctx.addIssue({ code: 'custom', path: ['date'], message: 'Choisis une date.' });
    }
    if (values.kind === 'recurring' && values.daysOfWeek.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['daysOfWeek'], message: 'Choisis au moins un jour.' });
    }
  });

export type PlanFormValues = z.infer<typeof planForm>;

export const PLAN_FORM_DEFAULTS: PlanFormValues = {
  kind: 'once',
  label: '',
  date: null,
  time: '08:30',
  daysOfWeek: [1, 2, 3, 4, 5],
  departureTime: '08:30',
  roundTrip: true,
  returnTime: '18:00',
};
