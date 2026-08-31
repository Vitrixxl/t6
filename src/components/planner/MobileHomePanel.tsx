// Etat de repos du panneau mobile : ce que l'application montre avant qu'un
// itineraire soit demande.
//
// Auparavant, ce panneau n'existait pas : tant que depart et arrivee n'etaient
// pas renseignes, l'ecran mobile se reduisait a une carte de points. L'appli ne
// repondait a aucune des questions qu'on se pose en sortant de chez soi.
//
// L'ordre des cartes suit celui de ces questions : qu'est-ce qui est
// disponible autour de moi, dans quelles conditions je pars, et qu'est-ce qui
// est prevu ensuite.
import { useMemo } from 'react';
import {
  AlertTriangle,
  Bike,
  CalendarClock,
  ChevronRight,
  CloudRain,
  Footprints,
  Leaf,
  TramFront,
  Wind,
  Zap,
} from 'lucide-react';
import { Button } from '../ui/button';
import type { CarbonSummary, GeoPoint, PlannedTrip, TransportNetwork, WeatherSignal } from '../../types';
import { findNearby, formatDistance, walkMinutes } from '../../lib/planner';
import { formatScheduleLabel } from './trips';

const WEATHER_LABEL: Record<WeatherSignal['condition'], string> = {
  clear: 'Degage',
  light_rain: 'Pluie legere',
  heavy_rain: 'Forte pluie',
  wind: 'Vent',
};

/** Un point de reference est toujours necessaire : GPS, depart saisi, ou le centre. */
function referencePoint(currentPosition: GeoPoint | null, origin: GeoPoint | null): GeoPoint {
  return currentPosition ?? origin ?? { lat: 45.7578, lon: 4.832, label: 'Centre de Lyon' };
}

function NearbyTile({
  icon,
  label,
  name,
  distanceKm,
  availability,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  name: string;
  distanceKm: number;
  availability: string;
  tone: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-border/70 bg-background/80 p-2.5">
      <span className={`inline-flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-[0.07em] ${tone}`}>
        {icon}
        {label}
      </span>
      <span className="truncate text-sm font-semibold leading-tight" title={name}>
        {name}
      </span>
      <span className="text-[0.7rem] font-medium text-muted-foreground">
        {formatDistance(distanceKm)} &middot; {walkMinutes(distanceKm)} min a pied
      </span>
      <span className="text-[0.7rem] font-bold text-foreground">{availability}</span>
    </div>
  );
}

export function MobileHomePanel({
  network,
  currentPosition,
  origin,
  upcomingTrip,
  carbonSummary,
  weeklyGoalGrams,
  expanded,
  onOpenHub,
  onUseCurrentPosition,
}: {
  network: TransportNetwork;
  currentPosition: GeoPoint | null;
  origin: GeoPoint | null;
  upcomingTrip: PlannedTrip | null;
  carbonSummary: CarbonSummary;
  weeklyGoalGrams: number;
  expanded: boolean;
  onOpenHub: () => void;
  onUseCurrentPosition: () => void;
}) {
  const point = useMemo(() => referencePoint(currentPosition, origin), [currentPosition, origin]);
  // Le balayage porte sur plusieurs milliers de points : on ne le refait que
  // si la position de reference ou le reseau change.
  const nearby = useMemo(() => findNearby(network, point), [network, point]);

  const weather = network.gtfs.weather;
  const incidents = network.gtfs.incidents;
  const savedPercent = weeklyGoalGrams > 0 ? Math.min(Math.round((carbonSummary.totalSavedGrams / weeklyGoalGrams) * 100), 100) : 0;

  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <section aria-label="Autour de moi" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">Autour de moi</h2>
          {!currentPosition ? (
            <button
              type="button"
              onClick={onUseCurrentPosition}
              className="text-[0.7rem] font-semibold text-primary underline underline-offset-2"
            >
              Utiliser ma position
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {nearby.velov ? (
            <NearbyTile
              icon={<Bike className="size-3" aria-hidden="true" />}
              label="Velo'v"
              name={nearby.velov.item.name.replace(/^Velo'v /, '')}
              distanceKm={nearby.velov.distanceKm}
              availability={`${nearby.velov.item.bikes_available} velo${nearby.velov.item.bikes_available > 1 ? 's' : ''}`}
              tone="text-[#4d7c0f]"
            />
          ) : null}
          {nearby.scooter ? (
            <NearbyTile
              icon={<Zap className="size-3" aria-hidden="true" />}
              label="Trottinette"
              name="Flotte libre"
              distanceKm={nearby.scooter.distanceKm}
              availability="Disponible"
              tone="text-[#c2410c]"
            />
          ) : null}
          {nearby.stop ? (
            <NearbyTile
              icon={<TramFront className="size-3" aria-hidden="true" />}
              label="Arret"
              name={nearby.stop.item.stop_name}
              distanceKm={nearby.stop.distanceKm}
              availability={nearby.stop.item.wheelchair_boarding === 1 ? 'Accessible PMR' : 'PMR non garanti'}
              tone="text-[#1d4ed8]"
            />
          ) : null}
        </div>

        {!currentPosition ? (
          <p className="text-[0.7rem] leading-4 text-muted-foreground">
            Distances calculees depuis {point.label}. Active le GPS pour les mesurer depuis ta position.
          </p>
        ) : null}
      </section>

      <section aria-label="Conditions" className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/80 p-2.5">
          {weather.condition === 'wind' ? (
            <Wind className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <CloudRain className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              {weather.temperature_celsius}&deg;C &middot; {WEATHER_LABEL[weather.condition]}
            </p>
            <p className="text-[0.7rem] text-muted-foreground">Vent {weather.wind_kmh} km/h</p>
          </div>
        </div>

        <div
          className={`flex items-center gap-2 rounded-xl border p-2.5 ${
            incidents.length > 0 ? 'border-destructive/30 bg-destructive/5' : 'border-border/70 bg-background/80'
          }`}
        >
          <AlertTriangle
            className={`size-4 shrink-0 ${incidents.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              {incidents.length} alerte{incidents.length > 1 ? 's' : ''}
            </p>
            <p className="truncate text-[0.7rem] text-muted-foreground">
              {incidents.length > 0 ? incidents[0].title : 'Reseau nominal'}
            </p>
          </div>
        </div>
      </section>

      {upcomingTrip ? (
        <button
          type="button"
          onClick={onOpenHub}
          className="flex items-center gap-3 rounded-xl border border-primary/25 bg-accent p-3 text-left"
        >
          <CalendarClock className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-[0.65rem] font-bold uppercase tracking-[0.07em] text-primary">Prochain trajet</span>
            <span className="block truncate text-sm font-semibold">{upcomingTrip.label}</span>
            <span className="block text-[0.7rem] text-muted-foreground">{formatScheduleLabel(upcomingTrip.scheduledFor)}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      ) : null}

      <section aria-label="Objectif carbone" className="flex flex-col gap-1.5 rounded-xl border border-border/70 bg-background/80 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            <Leaf className="size-3.5" aria-hidden="true" />
            CO2 evite cette semaine
          </span>
          <span className="text-sm font-bold tabular-nums">{carbonSummary.totalSavedGrams} g</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full bg-[var(--lime)] transition-[width] duration-500" style={{ width: `${savedPercent}%` }} />
        </div>
        <p className="text-[0.7rem] text-muted-foreground">
          {carbonSummary.trips} trajet{carbonSummary.trips > 1 ? 's' : ''} enregistre{carbonSummary.trips > 1 ? 's' : ''} &middot; objectif {weeklyGoalGrams} g
        </p>
      </section>

      {expanded ? (
        <>
          {incidents.length > 0 ? (
            <section aria-label="Alertes en cours" className="flex flex-col gap-2">
              <h2 className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">Alertes en cours</h2>
              {incidents.slice(0, 5).map((incident) => (
                <div key={incident.id} className="rounded-xl border border-border/70 bg-background/80 p-2.5">
                  <p className="text-sm font-semibold leading-tight">{incident.title}</p>
                  <p className="mt-0.5 text-[0.7rem] leading-4 text-muted-foreground">{incident.message}</p>
                </div>
              ))}
            </section>
          ) : null}

          <section aria-label="Reseau" className="grid grid-cols-3 gap-2">
            <NetworkStat label="Arrets" value={String(network.gtfs.stops.length)} />
            <NetworkStat
              label="Stations Velo'v"
              value={String(network.sharedMobility.data.stations.filter((s) => s.kind === 'velov').length)}
            />
            <NetworkStat
              label="Trottinettes"
              value={String(network.sharedMobility.data.stations.filter((s) => s.kind === 'scooter').length)}
            />
          </section>
        </>
      ) : null}

      <Button type="button" variant="outline" className="w-full justify-center rounded-xl bg-white" onClick={onOpenHub}>
        <Footprints className="size-4" aria-hidden="true" />
        Mes trajets et objectifs
      </Button>
    </div>
  );
}

function NetworkStat({ label, value }: { label: string; value: string }) {
  return (
    <dl className="m-0 rounded-xl border border-border/70 bg-background/80 p-2.5">
      <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground">{label}</dt>
      <dd className="m-0 mt-0.5 text-sm font-bold tabular-nums">{value}</dd>
    </dl>
  );
}
