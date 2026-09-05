// Le budget porte sur les émissions, indépendamment des économies comparées
// à la voiture. Le même suivi est visible sur la carte et dans le hub des trajets.
import { useCarbonSummary, useProfile } from '../../queries';
import { formatCarbonFootprint } from '../../lib/carbon-comparison';

// SDES-Insee, enquête mobilité des personnes 2019, publication du 6 juillet 2023.
// Moyenne annuelle par personne, ramenée à 52 semaines pour donner un repère.
const ANNUAL_MOBILITY_GRAMS = 1_450_000;
const SOURCE_URL = 'https://www.statistiques.developpement-durable.gouv.fr/le-quart-des-menages-les-plus-aises-lorigine-de-35-des-emissions-de-gaz-effet-de-serre-des';
const weeklyReference = Math.round(ANNUAL_MOBILITY_GRAMS / 52);

export function CarbonBudget() {
    const summary = useCarbonSummary();
    const budget = useProfile().carbonGoalGramsPerWeek;
    const remaining = budget - summary.totalCarbonGrams;
    const exceeded = remaining < 0;

    return (
        <section aria-label="Budget carbone de la semaine" className="grid min-w-0 gap-3 rounded-xl border border-border/70 bg-background/75 p-3">
            <div>
                <h3 className="text-sm font-semibold">Dépense carbone · cette semaine</h3>
                <p className="mt-1 text-xs text-muted-foreground">Du lundi à maintenant · trajets faits et passages récurrents échus, hors annulations.</p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-xs">
                <div>
                    <dt className="text-muted-foreground">Émissions comptabilisées</dt>
                    <dd className="mt-1 font-semibold" data-testid="carbon-spent">{formatCarbonFootprint(summary.totalCarbonGrams)}</dd>
                </div>
                <div>
                    <dt className="text-muted-foreground">Maximum hebdomadaire</dt>
                    <dd className="mt-1 font-semibold" data-testid="carbon-limit">{formatCarbonFootprint(budget)}</dd>
                </div>
            </dl>
            <div
                role="progressbar"
                aria-label="Budget carbone utilisé"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(summary.budgetUsagePercent, 100)}
                aria-valuetext={`${summary.budgetUsagePercent} % du budget utilisé, ${formatCarbonFootprint(summary.totalCarbonGrams)} émis sur ${formatCarbonFootprint(budget)}`}
                className="h-2 overflow-hidden rounded-full bg-muted"
            >
                <div className={`h-full ${exceeded ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${Math.min(summary.budgetUsagePercent, 100)}%` }} />
            </div>
            <p className={`text-xs font-semibold ${exceeded ? 'text-destructive' : 'text-primary'}`} data-testid="carbon-remaining">
                {exceeded ? `Dépassement de ${formatCarbonFootprint(-remaining)}` : `${formatCarbonFootprint(remaining)} restants`}
                {` · ${summary.budgetUsagePercent} % du budget utilisé`}
            </p>
            <p className="text-xs text-muted-foreground">Ton plafond personnel se règle dans le profil. Seuls les trajets suivis dans UrbanFlow sont comptés.</p>
            <details className="rounded-lg bg-muted/40 p-2.5 text-xs">
                <summary className="cursor-pointer font-medium">Repère national (2019) : ≈ {weeklyReference.toLocaleString('fr-FR')} gCO₂e par semaine</summary>
                <p className="mt-2 leading-5">
                    Moyenne par personne en France métropolitaine, 6 ans et plus, en 2019.
                    Le SDES publie 1,45 tCO₂e par an pour les déplacements locaux et longue distance ;
                    divisées par 52, cela donne environ 27 885 gCO₂e par semaine.
                </p>
                <p className="mt-1 leading-5">Ce repère couvre les émissions pendant les déplacements, hors fabrication des véhicules. Son périmètre diffère des trajets et des facteurs suivis ici : ce n’est ni ton empreinte totale ni un plafond recommandé.</p>
                <a className="mt-2 inline-block font-medium text-primary underline underline-offset-2" href={SOURCE_URL} target="_blank" rel="noreferrer">
                    Source : SDES-Insee, enquête mobilité 2019 (publication 2023)
                </a>
            </details>
        </section>
    );
}
