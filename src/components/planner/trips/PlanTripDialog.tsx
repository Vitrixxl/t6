// Formulaire de planification : trajet date ponctuel ou routine recurrente.
import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { CalendarPlus } from 'lucide-react';
import { useAtom } from 'jotai';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { formatCarbonComparison } from '../../../lib/carbon-comparison';
import { planSourceAtom } from '../../../state';
import { OriginDestination } from './atoms';
import { toTimeInputValue } from './format';
import { PLAN_FORM_DEFAULTS, planForm, type PlanFormValues } from './planForm';
import { usePlanSubmission } from './usePlanSubmission';
import { FieldError, OnceScheduleFields, PlanningKindTabs, RecurringScheduleFields } from './PlanTripFields';

export function PlanTripDialog() {
    // Le formulaire s'ouvre des qu'un trajet est mis en planification, et se
    // ferme en rendant ce trajet a null : l'orchestrateur n'a rien a tenir.
    const [source, setSource] = useAtom(planSourceAtom);
    const submitPlan = usePlanSubmission();
    const onOpenChange = (open: boolean) => {
        if (!open) {
            setSource(null);
        }
    };
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const form = useForm<PlanFormValues>({ resolver: zodResolver(planForm), defaultValues: PLAN_FORM_DEFAULTS });
    const { errors } = form.formState;
    const kind = form.watch('kind');

    useEffect(() => {
        if (!source) {
            return;
        }
        const next = new Date(Date.now() + 45 * 60_000);
        next.setMinutes(next.getMinutes() >= 30 ? 60 : 30, 0, 0);
        form.reset({ ...PLAN_FORM_DEFAULTS, label: source.label, date: next, time: toTimeInputValue(next) });
        setDatePickerOpen(false);
    }, [form, source]);

    if (!source) {
        return null;
    }

    // Sans date, le calendrier s'ouvre a la place d'un simple message.
    const submit = form.handleSubmit(submitPlan, (fieldErrors) => {
        if (fieldErrors.date) {
            setDatePickerOpen(true);
        }
    });

    return (
        <Dialog open onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <form noValidate onSubmit={submit}>
                    <DialogHeader>
                        <DialogTitle className="font-display">Planifier ce trajet</DialogTitle>
                        <DialogDescription>Une date precise, ou une routine dont chaque passage compte tout seul.</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-3 px-5">
                        <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
                            <h3 className="truncate text-sm font-semibold">{source.label}</h3>
                            <OriginDestination origin={source.origin.label} destination={source.destination.label} />
                            <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                                {source.durationMinutes} min · {source.distanceKm.toFixed(1)} km · {formatCarbonComparison(source.carbonSavedGrams)}
                            </p>
                        </div>

                        <PlanningKindTabs kind={kind} onChange={(nextKind) => form.setValue('kind', nextKind)} />

                        <label className="grid gap-1.5 text-xs font-semibold" htmlFor="plan-label">
                            Nom du trajet
                            <Input id="plan-label" className="h-9 text-sm" {...form.register('label')} />
                            <FieldError message={errors.label?.message} />
                        </label>

                        {kind === 'once'
                            ? <OnceScheduleFields form={form} datePickerOpen={datePickerOpen} onDatePickerOpenChange={setDatePickerOpen} />
                            : <RecurringScheduleFields form={form} />}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Annuler
                        </Button>
                        <Button type="submit">
                            <CalendarPlus className="size-4" aria-hidden="true" />
                            {kind === 'once' ? 'Planifier' : 'Creer la routine'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
