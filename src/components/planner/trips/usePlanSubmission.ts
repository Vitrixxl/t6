// Ce que le formulaire de planification déclenche : l'enregistrement, la
// fermeture du formulaire, et l'ouverture de l'onglet du hub qui montre le
// résultat. Les consequences d'une action sont decidees ici, pas dans le
// composant.
import { useAtom, useSetAtom } from 'jotai';
import { openHubAtom, planSourceAtom } from '../../../state';
import { useCreateRoutine, usePlanTrip } from '../../../queries';
import type { PlanFormValues } from './planForm';

export function usePlanSubmission(): (values: PlanFormValues) => void {
    const [source, setSource] = useAtom(planSourceAtom);
    const openHub = useSetAtom(openHubAtom);
    const planTrip = usePlanTrip();
    const createRoutine = useCreateRoutine();

    return (values: PlanFormValues) => {
        if (!source) {
            return;
        }
        const trip = { ...source, label: values.label.trim() || source.label };

        if (values.kind === 'once') {
            if (!values.date) {
                return;
            }
            const [hours, minutes] = values.time.split(':').map(Number);
            const day = values.date;
            planTrip(trip, new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours ?? 8, minutes ?? 0));
            setSource(null);
            openHub('upcoming');
            return;
        }

        createRoutine(trip, {
            daysOfWeek: values.daysOfWeek,
            departureTime: values.departureTime,
            returnTime: values.roundTrip ? values.returnTime : null,
        });
        setSource(null);
        openHub('recurring');
    };
}
