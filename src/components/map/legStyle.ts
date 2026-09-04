// Rendu des segments d'un itinéraire sur la carte.
//
// Chaque mode à son traitement, pour qu'on lise l'enchaînement d'un coup d'œil
// sans consulter la légende : la marche en pointilles (c'est le mode d'appoint,
// il ne doit pas peser visuellement), les mobilités actives en vert, le
// transport public en bleu — la même couleur que les arrêts sur la carte.
import type { MobilityMode, RouteLeg } from '../../types';
import type { PropertyValueSpecification } from 'maplibre-gl';

export const LEG_COLOR: Record<MobilityMode, string> = {
    walk: '#475569',
    bike: '#16a34a',
    scooter: '#16a34a',
    transit: '#2563eb',
};

/**
 * Couleur d'un segment. Un segment de transport public porte la couleur
 * officielle de sa ligne : le rose du métro A, le vert du D. C'est la couleur
 * que le voyageur voit sur les plans et sur les rames, la reprendre évite de
 * lui demander de traduire notre code couleur en celui du réseau.
 */
export function legColor(leg: RouteLeg): string {
    return leg.mapColor ?? LEG_COLOR[leg.mode];
}

/** Epaisseur du trait, plus marquee au zoom rue qu'en vue métropole. */
export const legWidthExpression: PropertyValueSpecification<number> = ['interpolate', ['linear'], ['zoom'], 11, 5, 15, 9];

// `line-dasharray` n'accepte pas d'expression liée aux données dans MapLibre :
// impossible de pointiller uniquement la marche depuis une seule couche. D'où
// deux couches filtrées sur le mode, l'une pointillée, l'autre pleine.
//
// Les valeurs sont des multiples de l'epaisseur du trait : un tiret un peu plus
// long que large, un vide plus court que le tiret. On lit des tirets nets,
// comme une bordure `dashed`, et non une file de points.
export const WALK_DASH_ARRAY = [1.5, 0.9];
