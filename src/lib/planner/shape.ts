// Decoupe du trace d'une ligne entre deux stations.
//
// Le portail publie le trace complet d'une ligne, d'un terminus a l'autre. Un
// segment d'itineraire n'en emprunte qu'une portion : il faut donc projeter la
// station de montee et celle de descente sur la polyligne, puis en extraire la
// partie comprise entre les deux. C'est ce qui permet de dessiner le metro sur
// ses rails plutot que sur la voirie.
import type { GeoPoint, GtfsStop } from '../../types';
import { haversineDistanceKm } from './geo';

/**
 * Au-dela de cette distance, la station n'est pas sur le trace retenu : c'est
 * une antenne, ou le sens inverse ne passe pas au meme endroit. On prefere
 * alors ne rien decouper plutot que de produire un trace faux.
 */
const MAX_SNAP_KM = 0.3;

/** Un point projete : ou il tombe sur la polyligne, et a quelle distance. */
interface Projection {
  /** Index du segment [i, i+1] portant la projection. */
  index: number;
  point: GeoPoint;
  distanceKm: number;
}

/**
 * Les calculs se font dans un plan local : la longitude est mise a l'echelle de
 * la latitude par son cosinus, sans quoi un degre de longitude compterait
 * autant qu'un degre de latitude et la projection deriverait vers l'est.
 */
function scaleLon(latitude: number): number {
  return Math.cos((latitude * Math.PI) / 180);
}

function projectOnShape(shape: [number, number][], target: Pick<GeoPoint, 'lat' | 'lon'>): Projection | null {
  const scale = scaleLon(target.lat);
  let best: Projection | null = null;

  for (let index = 0; index < shape.length - 1; index += 1) {
    const [aLon, aLat] = shape[index];
    const [bLon, bLat] = shape[index + 1];
    const dx = (bLon - aLon) * scale;
    const dy = bLat - aLat;
    const span = dx * dx + dy * dy;
    const px = (target.lon - aLon) * scale;
    const py = target.lat - aLat;
    const ratio = span === 0 ? 0 : Math.min(Math.max((px * dx + py * dy) / span, 0), 1);
    const point: GeoPoint = {
      label: 'Trace de ligne',
      lat: aLat + ratio * (bLat - aLat),
      lon: aLon + ratio * (bLon - aLon),
    };
    const distanceKm = haversineDistanceKm(point, target);
    if (!best || distanceKm < best.distanceKm) {
      best = { index, point, distanceKm };
    }
  }

  return best;
}

/**
 * Portion de trace reliant deux stations, extremites comprises. Renvoie `null`
 * si l'une des deux n'est pas sur ce trace : l'appelant se rabat alors sur une
 * geometrie approchee, plutot que d'afficher un detour inexistant.
 */
export function sliceShape(shape: [number, number][], from: GtfsStop, to: GtfsStop): GeoPoint[] | null {
  if (shape.length < 2) {
    return null;
  }

  const start = projectOnShape(shape, { lat: from.stop_lat, lon: from.stop_lon });
  const end = projectOnShape(shape, { lat: to.stop_lat, lon: to.stop_lon });
  if (!start || !end || start.distanceKm > MAX_SNAP_KM || end.distanceKm > MAX_SNAP_KM) {
    return null;
  }

  // Le trace est stocke dans un seul sens. Un trajet en sens inverse se lit en
  // remontant la polyligne : on decoupe dans l'ordre croissant puis on retourne.
  const reversed = end.index < start.index;
  const [first, last] = reversed ? [end, start] : [start, end];
  const between = shape
    .slice(first.index + 1, last.index + 1)
    .map(([lon, lat]) => ({ label: 'Trace de ligne', lat, lon }));

  const path = [
    { ...first.point, label: reversed ? to.stop_name : from.stop_name },
    ...between,
    { ...last.point, label: reversed ? from.stop_name : to.stop_name },
  ];

  return reversed ? path.reverse() : path;
}

/** Longueur reelle d'un trace, somme de ses segments. */
export function pathLengthKm(path: GeoPoint[]): number {
  let total = 0;
  for (let index = 0; index < path.length - 1; index += 1) {
    total += haversineDistanceKm(path[index], path[index + 1]);
  }
  return total;
}
