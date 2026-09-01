// Rendu des segments d'un itineraire sur la carte.
//
// Chaque mode a son traitement, pour qu'on lise l'enchainement d'un coup d'oeil
// sans consulter la legende : la marche en pointilles (c'est le mode d'appoint,
// il ne doit pas peser visuellement), les mobilites actives en vert, le
// covoiturage en violet, le transport public en bleu — la meme couleur que les
// arrets sur la carte.
import type { MobilityMode } from '../../types';

export const LEG_COLOR: Record<MobilityMode, string> = {
  walk: '#475569',
  bike: '#16a34a',
  scooter: '#16a34a',
  carpool: '#a855f7',
  transit: '#2563eb',
};

/**
 * Expression MapLibre donnant la couleur d'un segment depuis sa propriete
 * `mode`. Le dernier element est la couleur par defaut, obligatoire dans un
 * `match`.
 */
export const legColorExpression = [
  'match',
  ['get', 'mode'],
  'walk',
  LEG_COLOR.walk,
  'bike',
  LEG_COLOR.bike,
  'scooter',
  LEG_COLOR.scooter,
  'carpool',
  LEG_COLOR.carpool,
  'transit',
  LEG_COLOR.transit,
  LEG_COLOR.transit,
] as const;

/** Epaisseur du trait, plus marquee au zoom rue qu'en vue metropole. */
export const legWidthExpression = ['interpolate', ['linear'], ['zoom'], 11, 5, 15, 9] as const;

// `line-dasharray` n'accepte pas d'expression liee aux donnees dans MapLibre :
// impossible de pointiller uniquement la marche depuis une seule couche. D'ou
// deux couches filtrees sur le mode, l'une pointillee, l'autre pleine.
//
// Les valeurs sont des multiples de l'epaisseur du trait : un tiret un peu plus
// long que large, un vide plus court que le tiret. On lit des tirets nets,
// comme une bordure `dashed`, et non une file de points.
export const WALK_DASH_ARRAY = [1.5, 0.9];
