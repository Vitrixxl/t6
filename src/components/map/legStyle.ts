// Rendu des segments d'un itineraire sur la carte.
//
// Chaque mode a son traitement, pour qu'on lise l'enchainement d'un coup d'oeil
// sans consulter la legende : la marche en pointilles (c'est le mode d'appoint,
// il ne doit pas peser visuellement), les mobilites actives en vert, le
// covoiturage en violet, le transport public en bleu — la meme couleur que les
// arrets sur la carte.
import type { MobilityMode, RouteLeg } from '../../types';

export const LEG_COLOR: Record<MobilityMode, string> = {
  walk: '#475569',
  bike: '#16a34a',
  scooter: '#16a34a',
  carpool: '#a855f7',
  transit: '#2563eb',
};

/**
 * Couleur d'un segment. Un segment de transport public porte la couleur
 * officielle de sa ligne : le rose du metro A, le vert du D. C'est la couleur
 * que le voyageur voit sur les plans et sur les rames, la reprendre evite de
 * lui demander de traduire notre code couleur en celui du reseau.
 */
export function legColor(leg: RouteLeg): string {
  return leg.mapColor ?? LEG_COLOR[leg.mode];
}

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
