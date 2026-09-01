// Etapes d'un itineraire : un segment par ligne.
//
// Les etapes affichees sont les segments du trajet, pas les manoeuvres du
// calculateur d'itineraires. Ce que l'utilisateur a besoin de savoir avant de
// partir, c'est l'enchainement — marcher jusqu'a la station, prendre le velo,
// marcher jusqu'a l'arret, prendre le metro — et non « tourner a droite dans
// 80 m », qui releve du guidage pas-a-pas et n'a de sens qu'en chemin.
//
// La liste n'est jamais repliee : c'est l'information principale d'une option
// d'itineraire, la demander d'un geste supplementaire revient a la cacher.
import type { RouteLeg, RouteOption } from '../../types';
import { formatDistance, visibleLegs } from '../../lib/planner';
import { legColor } from '../map/legStyle';
import { MODE_ICON } from '../app/shared';

function StepRow({ leg, last }: { leg: RouteLeg; last: boolean }) {
  const Icon = MODE_ICON[leg.mode];
  const color = legColor(leg);
  // Le nom de ligne est deja porte par la pastille : le repeter dans le titre
  // donnerait "Metro D Metro D vers Venissieux".
  const title = leg.mapLabel && leg.title.startsWith(leg.mapLabel) ? leg.title.slice(leg.mapLabel.length).trim() : leg.title;

  return (
    <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3">
      <div className="flex flex-col items-center">
        <span
          className="grid size-7 shrink-0 place-items-center rounded-lg text-white"
          style={{ background: color }}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        {/* Le filet relie visuellement les etapes : on lit une suite, pas une
            liste de cartes independantes. */}
        {last ? null : <span className="mt-1 w-px flex-1 bg-border" aria-hidden="true" />}
      </div>

      <div className={`min-w-0 ${last ? '' : 'pb-3'}`}>
        <div className="flex min-w-0 items-baseline justify-between gap-2">
          <strong className="truncate text-[0.82rem] font-semibold leading-5">
            {leg.mapLabel ? (
              <span
                className="mr-1.5 inline-block rounded px-1.5 py-0.5 align-middle text-[0.62rem] font-bold uppercase tracking-wide text-white"
                style={{ background: color }}
              >
                {leg.mapLabel}
              </span>
            ) : null}
            {title}
          </strong>
          {/* Distance et duree ensemble : quand les deux extremites portent le
              meme nom — sortie de station et adresse voisine — la duree seule
              ne dit pas de quoi il s'agit. */}
          <span className="shrink-0 font-mono text-[0.68rem] text-muted-foreground">
            {formatDistance(leg.distanceKm)} &middot; {leg.durationMinutes} min
          </span>
        </div>
        <p className="mt-0.5 truncate text-[0.72rem] leading-4 text-muted-foreground">
          {leg.from} <span aria-hidden="true">&rarr;</span> {leg.to}
        </p>
      </div>
    </li>
  );
}

export function RouteSteps({ routeOption }: { routeOption: RouteOption }) {
  const legs = visibleLegs(routeOption);
  if (legs.length === 0) {
    return null;
  }

  return (
    <section aria-label="Etapes de l'itineraire">
      <h3 className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Etapes
      </h3>
      <ol className="m-0 list-none p-0">
        {legs.map((leg, index) => (
          <StepRow key={leg.id} leg={leg} last={index === legs.length - 1} />
        ))}
      </ol>
    </section>
  );
}
