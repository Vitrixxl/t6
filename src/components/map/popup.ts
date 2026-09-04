// Popup de details au clic sur un point (arrêt, station partagée).
//
// Le contenu est injecte en HTML par MapLibre : toute valeur venant d'un flux
// externe (nom d'arrêt, nom de station) est donc échappée avant insertion.
// Un flux opérateur compromis ne peut pas exécuter de script dans la page
// (OWASP A03 - injection).
import maplibregl, { type Map as MaplibreMap } from 'maplibre-gl';
import type { MutableRefObject } from 'react';

export function escapeHtml(value: unknown): string {
    return String(value ?? '').replace(/[&<>"']/g, (char) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char
    ));
}

// Popup de details au clic sur un point (arrêt, station partagée).
export function bindPointPopup(
    map: MaplibreMap,
    layerId: string,
    popupRef: MutableRefObject<maplibregl.Popup | null>,
    buildHtml: (properties: Record<string, unknown>) => string,
) {
    map.on('click', layerId, (event) => {
        const feature = event.features?.[0];
        if (!feature) {
            return;
        }
        const coordinates =
            feature.geometry.type === 'Point'
                ? (feature.geometry.coordinates as [number, number])
                : ([event.lngLat.lng, event.lngLat.lat] as [number, number]);
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '280px', offset: 14, className: 'ufm-popup' })
            .setLngLat(coordinates)
            .setHTML(buildHtml(feature.properties ?? {}))
            .addTo(map);
    });
    map.on('mouseenter', layerId, () => {
        map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
    });
}
