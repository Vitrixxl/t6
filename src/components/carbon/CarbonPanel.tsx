// Module suivi carbone : synthese de la semaine en cours, objectif et
// historique effacable.
//
// Les chiffres de l'entete portent sur la semaine, l'historique dessous sur les
// cinquante derniers trajets : les libelles le disent, sinon le meme ecran
// affiche deux periodes sans le signaler (B16).
import { Button } from '../ui/button';
import { useCarbonSummary, useClearTripHistory, useProfile, useTripRecords } from '../../queries';
import { Metric } from '../app/shared';

export function CarbonPanel() {
  const profile = useProfile();
  const records = useTripRecords();
  const summary = useCarbonSummary();
  const clearHistory = useClearTripHistory();

  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-muted/20">
      <div className="border-b border-border/50 px-3 py-3">
        <h2 className="text-[15px] font-semibold tracking-normal">Suivi carbone</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {summary.goalUsagePercent}% de l'objectif hebdomadaire de {profile.carbonGoalGramsPerWeek} g.
        </p>
      </div>
      <div className="grid gap-3 p-3">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <span className="block h-full bg-primary" style={{ width: `${Math.min(summary.goalUsagePercent, 100)}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Trajets cette semaine" value={String(summary.trips)} />
          <Metric label="CO2 evite cette semaine" value={`${summary.totalSavedGrams} g`} />
        </div>
        {records.length > 0 ? (
          <ul className="grid gap-2 text-sm" aria-label="Derniers trajets enregistres">
            {records.slice(0, 3).map((record) => (
              <li key={record.id} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                <span>{record.routeTitle}</span>
                <strong>{record.carbonGrams} g</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Marque un trajet planifie comme fait pour alimenter le suivi.</p>
        )}
        <Button type="button" variant="outline" size="sm" onClick={clearHistory} disabled={records.length === 0}>
          Effacer l'historique
        </Button>
      </div>
    </section>
  );
}
