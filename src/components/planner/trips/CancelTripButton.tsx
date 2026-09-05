import { useState } from 'react';
import { X } from 'lucide-react';
import type { PlannedTrip } from '../../../types';
import { useCancelTrip } from '../../../queries';
import { Button } from '../../ui/button';
import { ConfirmDialog } from '../../ui/confirm-dialog';

export function CancelTripButton({ trip }: { trip: PlannedTrip }) {
    const [open, setOpen] = useState(false);
    const cancel = useCancelTrip();
    return <>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}><X className="size-3.5" aria-hidden="true" />Annuler</Button>
        {open ? <ConfirmDialog open onOpenChange={setOpen} title="Annuler ce trajet ?"
            description={`« ${trip.label} » sera conservé dans l’historique et exclu des calculs carbone.`}
            confirmLabel="Confirmer l’annulation" destructive onConfirm={() => cancel(trip)} /> : null}
    </>;
}
