// Libelles poses sur les segments de transport public.
//
// Une couche `symbol` de MapLibre serait le choix naturel, mais elle exige une
// source `glyphs` dans le style : le fond raster OpenStreetMap n'en a pas, et
// le texte ne s'affiche alors pas du tout, sans erreur. Plutot que d'ajouter
// une dependance a un serveur de polices tiers, on pose des marqueurs HTML :
// pas de requete supplementaire, et la typographie de l'application.
import maplibregl, { type Map as MaplibreMap } from 'maplibre-gl';
import type { RouteLeg } from '../../types';
import { legColor } from './legStyle';
import { midpointOfPath } from '../../lib/planner';

function createLabel(text: string, color: string): HTMLElement {
    const element = document.createElement('span');
    element.className = 'ufm-leg-label';
    // textContent, jamais innerHTML : le libelle vient du jeu de donnees reseau.
    element.textContent = text;
    // La pastille reprend la couleur officielle de la ligne, comme le trace.
    element.style.background = color;
    return element;
}

/**
 * Aligne les marqueurs affiches sur les segments donnes et rend la nouvelle
 * liste. Les anciens sont retires : sans cela, changer d'itineraire empilerait
 * les libelles du precedent.
 */
export function syncLegLabels(map: MaplibreMap, current: maplibregl.Marker[], legs: RouteLeg[]): maplibregl.Marker[] {
    current.forEach((marker) => marker.remove());

    return legs
        .filter((leg) => leg.mode === 'transit' && leg.mapLabel && leg.path.length >= 2)
        .flatMap((leg) => {
            const point = midpointOfPath(leg.path);
            if (!point) {
                return [];
            }
            return [
                new maplibregl.Marker({ element: createLabel(leg.mapLabel as string, legColor(leg)) })
                    .setLngLat([point.lon, point.lat])
                    .addTo(map),
            ];
        });
}
