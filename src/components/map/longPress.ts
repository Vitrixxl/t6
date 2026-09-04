// Sélection d'un point par appui long sur la carte.
//
// Sur mobile il n'y a ni clic droit ni survol : l'appui long est le geste
// attendu pour "agir sur cet endroit précis". Deux precautions le distinguent
// d'un déplacement de carte : un seuil de durée, et l'annulation dès que le
// doigt bouge au-delà de quelques pixels.
import maplibregl, { type Map as MaplibreMap, type MapMouseEvent, type MapTouchEvent } from 'maplibre-gl';

const LONG_PRESS_MS = 500;
/** Au-dela, l'utilisateur fait glisser la carte, il ne désigné pas un point. */
const MOVE_TOLERANCE_PX = 10;

export interface PickedPoint {
    lat: number;
    lon: number;
}

export interface LongPressHandlers {
    onPick: (point: PickedPoint) => void;
}

/**
 * Branche la détection d'appui long et rend la fonction de detachement.
 * Écoute la souris autant que le tactile : le comportement est ainsi
 * vérifiable sur un poste de développement, pas seulement sur téléphone.
 */
export function bindLongPress(map: MaplibreMap, { onPick }: LongPressHandlers): () => void {
    let timer: number | null = null;
    let origin: { x: number; y: number } | null = null;

    const cancel = (): void => {
        if (timer !== null) {
            window.clearTimeout(timer);
            timer = null;
        }
        origin = null;
    };

    const start = (event: MapMouseEvent | MapTouchEvent): void => {
        cancel();
        origin = { x: event.point.x, y: event.point.y };
        const { lat, lng } = event.lngLat;
        timer = window.setTimeout(() => {
            timer = null;
            origin = null;
            onPick({ lat, lon: lng });
        }, LONG_PRESS_MS);
    };

    const move = (event: MapMouseEvent | MapTouchEvent): void => {
        if (!origin || timer === null) {
            return;
        }
        const distance = Math.hypot(event.point.x - origin.x, event.point.y - origin.y);
        if (distance > MOVE_TOLERANCE_PX) {
            cancel();
        }
    };

    map.on('touchstart', start);
    map.on('touchmove', move);
    map.on('touchend', cancel);
    map.on('touchcancel', cancel);
    map.on('mousedown', start);
    map.on('mousemove', move);
    map.on('mouseup', cancel);
    // Un déplacement programmatique (recentrage, zoom) ne doit pas être pris
    // pour un appui maintenu.
    map.on('movestart', cancel);

    return () => {
        cancel();
        map.off('touchstart', start);
        map.off('touchmove', move);
        map.off('touchend', cancel);
        map.off('touchcancel', cancel);
        map.off('mousedown', start);
        map.off('mousemove', move);
        map.off('mouseup', cancel);
        map.off('movestart', cancel);
    };
}

export interface PickerLabels {
    title: string;
    origin: string;
    destination: string;
}

/**
 * Construit le contenu du popover de sélection. Le DOM est assemble par code
 * plutôt que par une chaîne HTML : les libellés ne peuvent pas s'echapper en
 * balises, et les boutons portent de vrais ecouteurs.
 */
export function createPickerContent(
    labels: PickerLabels,
    onChoose: (role: 'origin' | 'destination') => void,
): HTMLElement {
    const container = document.createElement('div');
    container.className = 'ufm-picker';

    const kind = document.createElement('p');
    kind.className = 'ufm-popup-kind';
    kind.textContent = 'Point choisi sur la carte';
    container.append(kind);

    const title = document.createElement('strong');
    title.textContent = labels.title;
    container.append(title);

    const actions = document.createElement('div');
    actions.className = 'ufm-picker-actions';

    for (const role of ['origin', 'destination'] as const) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ufm-picker-button';
        button.textContent = role === 'origin' ? labels.origin : labels.destination;
        button.addEventListener('click', () => onChoose(role));
        actions.append(button);
    }

    container.append(actions);
    return container;
}

/** Repere visuel pose à l'endroit choisi, retire avec le popover. */
export function createPickerMarker(map: MaplibreMap, point: PickedPoint): maplibregl.Marker {
    return new maplibregl.Marker({ color: '#0e6b4e' }).setLngLat([point.lon, point.lat]).addTo(map);
}
