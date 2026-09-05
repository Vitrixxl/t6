// Module suivi carbone : synthèse de la semaine en cours, objectif et
// historique effacable.
//
// Les chiffres de l'entête portent sur la semaine, l'historique dessous sur les
// cinquante derniers trajets : les libellés le disent, sinon le même écran
// affiche deux périodes sans le signaler (B16).
import { useState } from 'react';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { CarbonBudget } from './CarbonBudget';
import { Button } from '../ui/button';
import { useCarbonSummary, useClearTripHistory, useTripRecords } from '../../queries';
import { Metric } from '../app/shared';
import { formatCarbonComparison, formatCarbonFootprint } from '../../lib/carbon-comparison';

export function CarbonPanel() {
    const records = useTripRecords();
    const summary = useCarbonSummary();
    const clearHistory = useClearTripHistory();
    const [confirmClear, setConfirmClear] = useState(false);

    return (
        <section className="overflow-hidden rounded-xl border border-border/70 bg-muted/20">
            <div className="border-b border-border/50 px-3 py-3">
                <h2 className="text-[15px] font-semibold tracking-normal">Suivi carbone</h2>
            </div>
            <div className="grid gap-3 p-3">
                <CarbonBudget />
                <div className="grid grid-cols-2 gap-2">
                    <Metric label="Trajets cette semaine" value={String(summary.trips)} />
                    <Metric label="Comparaison voiture / semaine" value={formatCarbonComparison(summary.totalSavedGrams)} />
                </div>
                {records.length > 0 ? (
                    <ul className="grid gap-2 text-sm" aria-label="Derniers trajets enregistrés">
                        {records.slice(0, 3).map((record) => (
                            <li key={record.id} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                                <span>{record.routeTitle}</span>
                                <strong>{formatCarbonFootprint(record.carbonGrams)}</strong>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground">Marque un trajet planifié comme fait pour alimenter le suivi.</p>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirmClear(true)} disabled={records.length === 0}>
                    Effacer l'historique
                </Button>
            </div>
            <ConfirmDialog
                open={confirmClear}
                onOpenChange={setConfirmClear}
                title="Effacer l’historique carbone ?"
                description="Les enregistrements du suivi carbone seront supprimés. Les trajets planifiés et récurrents seront conservés."
                confirmLabel="Effacer l’historique"
                destructive
                onConfirm={clearHistory}
            />
        </section>
    );
}
