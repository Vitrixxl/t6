// Un repère commun au profil et au suivi évite deux chiffres ou sources divergents.
const SOURCE_URL = 'https://www.statistiques.developpement-durable.gouv.fr/le-quart-des-menages-les-plus-aises-lorigine-de-35-des-emissions-de-gaz-effet-de-serre-des';
const WEEKLY_MOBILITY_GRAMS = Math.round(1_450_000 / 52);

export function CarbonReference() {
    return (
        <aside aria-label="Repère carbone national" className="grid gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-5">
            <h3 className="font-semibold">Pour situer ton budget : la mobilité en France</h3>
            <p className="text-base font-semibold text-primary">
                ≈ {WEEKLY_MOBILITY_GRAMS.toLocaleString('fr-FR')} gCO₂e par personne et par semaine
            </p>
            <p>Moyenne de 2019 pour les déplacements locaux et longue distance. Ton maximum est un choix personnel ; cette moyenne n’est pas un plafond recommandé.</p>
            <p>UrbanFlow compte seulement tes trajets suivis, avec des facteurs différents de ceux de cette étude. Ce repère ne permet donc pas d’affirmer que ton empreinte totale est inférieure ou supérieure à la moyenne.</p>
            <a className="font-semibold text-primary underline underline-offset-2" href={SOURCE_URL} target="_blank" rel="noreferrer">
                Source : SDES-Insee, enquête mobilité 2019 (publication 2023)
            </a>
            <details>
                <summary className="cursor-pointer font-medium">Périmètre et calcul du repère</summary>
                <p className="mt-2">France métropolitaine, personnes de 6 ans et plus. Le SDES publie 1,45 tCO₂e par personne et par an : 1 450 000 gCO₂e ÷ 52 ≈ 27 885 gCO₂e par semaine. C’est une moyenne annuelle ramenée à la semaine, pas une mesure de chaque semaine.</p>
                <p className="mt-1">L’étude couvre les émissions pendant les déplacements, hors fabrication des véhicules. Les objectifs d’économies UrbanFlow comparent tes trajets à une référence voiture ; ils ne sont pas comparables à cette moyenne d’émissions.</p>
            </details>
        </aside>
    );
}
