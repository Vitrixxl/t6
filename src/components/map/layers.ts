// Définition des couches MapLibre. UrbanMap alimente les sources ; ce module
// décrit une seule fois comment chacune est affichée et rendue interactive.
import maplibregl, { type Map as MaplibreMap } from 'maplibre-gl';
import type { MutableRefObject } from 'react';
import { WALK_DASH_ARRAY, legWidthExpression } from './legStyle';
import { bindPointPopup, escapeHtml } from './popup';

function installLegLayers(map: MaplibreMap): void {
    if (!map.getLayer('legs-line')) {
        map.addLayer({
            id: 'legs-line',
            type: 'line',
            source: 'legs',
            filter: ['!=', ['get', 'mode'], 'walk'],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
                'line-color': ['get', 'color'],
                'line-width': legWidthExpression,
                'line-opacity': 0.95,
            },
        });
    }

    if (!map.getLayer('legs-walk')) {
        map.addLayer({
            id: 'legs-walk',
            type: 'line',
            source: 'legs',
            filter: ['==', ['get', 'mode'], 'walk'],
            layout: { 'line-cap': 'butt', 'line-join': 'round' },
            paint: {
                'line-color': ['get', 'color'],
                'line-width': ['interpolate', ['linear'], ['zoom'], 11, 4.5, 15, 8],
                'line-opacity': 0.95,
                'line-dasharray': WALK_DASH_ARRAY,
            },
        });
    }
}

function installPositionLayers(map: MaplibreMap): void {
    if (!map.getLayer('points-accuracy')) {
        // Halo de précision : il dit ce que le point ne dit pas, à savoir
        // l'incertitude de la mesure. Sous le point, jamais par-dessus.
        map.addLayer({
            id: 'points-accuracy',
            type: 'circle',
            source: 'points',
            filter: ['==', ['get', 'kind'], 'navigation'],
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 10, 16, 26],
                'circle-color': '#2f6cb3',
                'circle-opacity': 0.16,
                'circle-stroke-color': '#2f6cb3',
                'circle-stroke-width': 1,
                'circle-stroke-opacity': 0.3,
            },
        });
    }

    if (!map.getLayer('points-circle')) {
        map.addLayer({
            id: 'points-circle',
            type: 'circle',
            source: 'points',
            paint: {
                'circle-radius': ['case', ['==', ['get', 'kind'], 'navigation'], 8, ['==', ['get', 'kind'], 'origin'], 9, 8],
                'circle-color': ['get', 'color'],
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': ['case', ['==', ['get', 'kind'], 'navigation'], 3.5, 3],
            },
        });
        map.addLayer({
            id: 'points-label',
            type: 'symbol',
            source: 'points',
            layout: {
                'text-field': ['get', 'label'],
                'text-size': 12,
                'text-offset': [0, 1.5],
                'text-anchor': 'top',
            },
            paint: {
                'text-color': '#111827',
                'text-halo-color': '#ffffff',
                'text-halo-width': 1.5,
            },
        });
    }
}

function installTransitLayer(map: MaplibreMap, popupRef: MutableRefObject<maplibregl.Popup | null>): void {
    if (map.getLayer('stops-circle')) {
        return;
    }

    map.addLayer({
        id: 'stops-circle',
        type: 'circle',
        source: 'stops',
        paint: {
            // Taille liée au zoom pour rester lisible en vue métropole comme en vue rue.
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 12, 5.5, 15, 9],
            // Bleu vif vs vert lime des stations : contraste net entre les couches.
            'circle-color': '#2563eb',
            'circle-opacity': 0.95,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 1.75,
        },
    });
    bindPointPopup(map, 'stops-circle', popupRef, (properties) => `
        <p class="ufm-popup-kind">Arrêt transport public</p>
        <strong>${escapeHtml(properties.label)}</strong>
        <p>${properties.accessible === true || properties.accessible === 'true' ? 'Accessible PMR' : 'Accessibilité PMR non garantie'}</p>
    `);
}

function installVelovLayer(map: MaplibreMap, popupRef: MutableRefObject<maplibregl.Popup | null>): void {
    if (map.getLayer('velov-circle')) {
        return;
    }

    map.addLayer({
        id: 'velov-circle',
        type: 'circle',
        source: 'velov',
        paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 12, 5.5, 15, 9],
            'circle-color': '#84cc16',
            'circle-opacity': 0.95,
            'circle-stroke-color': '#3f6212',
            'circle-stroke-width': 1.5,
        },
    });
    bindPointPopup(map, 'velov-circle', popupRef, (properties) => `
        <p class="ufm-popup-kind">Station Vélo'v</p>
        <strong>${escapeHtml(properties.label)}</strong>
        <p>${escapeHtml(properties.bikes)} vélo(s) disponibles sur ${escapeHtml(properties.capacity)} places</p>
    `);
}

function installScooterLayer(map: MaplibreMap, popupRef: MutableRefObject<maplibregl.Popup | null>): void {
    if (map.getLayer('scooters-circle')) {
        return;
    }

    map.addLayer({
        id: 'scooters-circle',
        type: 'circle',
        source: 'scooters',
        paint: {
            // Plus petit que Vélo'v : la flotte libre est dense, des points trop
            // gros se recouvrent et masquent la carte.
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2.5, 12, 4, 15, 7],
            // Orange contre le vert lime de Vélo'v : les deux couches restent
            // distinguables même affichées ensemble.
            'circle-color': '#f97316',
            'circle-opacity': 0.9,
            'circle-stroke-color': '#7c2d12',
            'circle-stroke-width': 1.25,
        },
    });
    bindPointPopup(map, 'scooters-circle', popupRef, (properties) => `
        <p class="ufm-popup-kind">Trottinette en flotte libre</p>
        <strong>${escapeHtml(properties.label)}</strong>
        <p>${escapeHtml(properties.scooters)} disponible(s) à cet emplacement</p>
    `);
}

export function installMapLayers(
    map: MaplibreMap,
    popupRef: MutableRefObject<maplibregl.Popup | null>,
): void {
    installLegLayers(map);
    installPositionLayers(map);
    installTransitLayer(map, popupRef);
    installVelovLayer(map, popupRef);
    installScooterLayer(map, popupRef);
}
