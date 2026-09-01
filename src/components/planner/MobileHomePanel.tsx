// Contenu du tiroir "Autour de moi" sur mobile.
//
// L'utilisateur choisit son rayon : ce qui compte a 300 m quand on est presse
// n'est pas ce qui compte a 2 km quand on prepare un trajet. L'unite est
// selectionnable parce qu'on ne raisonne pas en kilometres pour une distance
// de quartier, ni en metres pour une distance de ville.
import { useMemo, useState } from 'react';
import { Bike, CloudRain, TramFront, Wind, Zap } from 'lucide-react';
import type { GeoPoint, TransportNetwork, WeatherSignal } from '../../types';
import { findWithinRadius, formatDistance, walkMinutes, type NearbyWithin } from '../../lib/planner';

const WEATHER_LABEL: Record<WeatherSignal['condition'], string> = {
  clear: 'Degage',
  light_rain: 'Pluie legere',
  heavy_rain: 'Forte pluie',
  wind: 'Vent',
};

type DistanceUnit = 'm' | 'km';

/** Rayon par defaut : dix minutes de marche, l'horizon spontane d'un pieton. */
const DEFAULT_RADIUS = { value: 800, unit: 'm' as DistanceUnit };

/** Un point de reference est toujours necessaire : GPS, depart saisi, ou le centre. */
function referencePoint(currentPosition: GeoPoint | null, origin: GeoPoint | null): GeoPoint {
  return currentPosition ?? origin ?? { lat: 45.7578, lon: 4.832, label: 'Centre de Lyon' };
}

function toKilometers(value: number, unit: DistanceUnit): number {
  return unit === 'km' ? value : value / 1000;
}

function Group({
  icon,
  label,
  tone,
  group,
  nameOf,
  availabilityOf,
}: {
  icon: React.ReactNode;
  label: string;
  tone: string;
  group: NearbyWithin['velov'] | NearbyWithin['stop'];
  nameOf: (item: never) => string;
  availabilityOf: (item: never) => string;
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-background/80 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.07em] ${tone}`}>
          {icon}
          {label}
        </span>
        {/* Le compte est le nombre reel dans le rayon, pas la longueur de la
            liste affichee : un plafond de rendu n'est pas une mesure (B9). */}
        <span className="text-sm font-bold tabular-nums">{group.count}</span>
      </div>

      {group.count === 0 ? (
        <p className="mt-1.5 text-[0.72rem] text-muted-foreground">Rien dans ce rayon.</p>
      ) : (
        <ul className="mt-2 grid gap-1.5">
          {group.items.map((entry, index) => (
            <li key={index} className="flex min-w-0 items-baseline justify-between gap-2">
              <span className="min-w-0">
                <strong className="block truncate text-[0.78rem] font-semibold leading-4">
                  {nameOf(entry.item as never)}
                </strong>
                <span className="block text-[0.68rem] text-muted-foreground">
                  {availabilityOf(entry.item as never)}
                </span>
              </span>
              <span className="shrink-0 text-right font-mono text-[0.66rem] text-muted-foreground">
                {formatDistance(entry.distanceKm)}
                <br />
                {walkMinutes(entry.distanceKm)} min
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function MobileHomePanel({
  network,
  currentPosition,
  origin,
  onUseCurrentPosition,
}: {
  network: TransportNetwork;
  currentPosition: GeoPoint | null;
  origin: GeoPoint | null;
  onUseCurrentPosition: () => void;
}) {
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const point = useMemo(() => referencePoint(currentPosition, origin), [currentPosition, origin]);
  const radiusKm = toKilometers(radius.value, radius.unit);

  // Le balayage porte sur plusieurs milliers de points : on ne le refait que si
  // la position de reference, le reseau ou le rayon change.
  const nearby = useMemo(() => findWithinRadius(network, point, radiusKm), [network, point, radiusKm]);
  const weather = network.gtfs.weather;

  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid flex-1 gap-1 text-[0.68rem] font-bold uppercase tracking-[0.07em] text-muted-foreground">
          Rayon
          <input
            type="number"
            min={1}
            step={radius.unit === 'km' ? 1 : 50}
            value={radius.value}
            onChange={(event) => setRadius((current) => ({ ...current, value: Math.max(Number(event.target.value) || 0, 1) }))}
            // Hauteur en pixels : la racine du document est a 14 px, une valeur
            // en rem raterait la cible tactile de 44 px.
            className="h-[44px] w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground"
            aria-label="Distance de recherche"
          />
        </label>
        <label className="grid w-24 gap-1 text-[0.68rem] font-bold uppercase tracking-[0.07em] text-muted-foreground">
          Unite
          <select
            value={radius.unit}
            onChange={(event) => setRadius((current) => ({ ...current, unit: event.target.value as DistanceUnit }))}
            className="h-[44px] w-full rounded-xl border border-border bg-background px-2 text-sm font-semibold text-foreground"
            aria-label="Unite de distance"
          >
            <option value="m">m</option>
            <option value="km">km</option>
          </select>
        </label>
      </div>

      {!currentPosition ? (
        <button
          type="button"
          onClick={onUseCurrentPosition}
          className="h-[44px] rounded-xl border border-primary/30 bg-primary/5 px-3 text-[0.78rem] font-semibold text-primary"
        >
          Mesurer depuis ma position ({point.label})
        </button>
      ) : null}

      <Group
        icon={<Bike className="size-3" aria-hidden="true" />}
        label="Velo'v"
        tone="text-[#4d7c0f]"
        group={nearby.velov}
        nameOf={(station: NearbyWithin['velov']['items'][number]['item']) => station.name.replace(/^Velo'v /, '')}
        availabilityOf={(station: NearbyWithin['velov']['items'][number]['item']) =>
          `${station.bikes_available} velo${station.bikes_available > 1 ? 's' : ''} disponible${station.bikes_available > 1 ? 's' : ''}`
        }
      />
      <Group
        icon={<Zap className="size-3" aria-hidden="true" />}
        label="Trottinettes"
        tone="text-[#c2410c]"
        group={nearby.scooter}
        nameOf={() => 'Flotte libre'}
        availabilityOf={(station: NearbyWithin['scooter']['items'][number]['item']) =>
          `${station.scooters_available} disponible${station.scooters_available > 1 ? 's' : ''}`
        }
      />
      <Group
        icon={<TramFront className="size-3" aria-hidden="true" />}
        label="Arrets"
        tone="text-[#1d4ed8]"
        group={nearby.stop}
        nameOf={(stop: NearbyWithin['stop']['items'][number]['item']) => stop.stop_name}
        availabilityOf={(stop: NearbyWithin['stop']['items'][number]['item']) =>
          stop.routes.length > 0 ? `Lignes ${stop.routes.join(', ')}` : 'Arret de bus'
        }
      />

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
    </div>
  );
}
