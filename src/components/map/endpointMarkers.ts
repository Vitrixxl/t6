// Reperes de depart et d'arrivee.
//
// Un simple cercle colore ne se distinguait pas des centaines d'arrets et de
// stations affiches sur la carte. Or ce sont les deux points que l'utilisateur
// vient de choisir : ils doivent se lire immediatement, des la selection, sans
// attendre qu'un itineraire soit calcule.
//
// D'ou une epingle dessinee en SVG, ancree par sa pointe sur la coordonnee, et
// accompagnee du nom du lieu. Marqueur HTML plutot que couche `symbol` : le
// style raster n'embarque pas de source `glyphs` (cf. B10 du journal).
import maplibregl, { type Map as MaplibreMap } from 'maplibre-gl';
import type { GeoPoint } from '../../types';

export type EndpointRole = 'origin' | 'destination';

const ROLE_LABEL: Record<EndpointRole, string> = {
  origin: 'Depart',
  destination: 'Arrivee',
};

/** Epingle en goutte : la pointe marque la coordonnee exacte. */
function pinSvg(role: EndpointRole): string {
  const fill = role === 'origin' ? '#0e6b4e' : '#dc2626';
  return `
    <svg width="30" height="40" viewBox="0 0 30 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M15 39C15 39 28 24.5 28 14.5C28 7.04 22.18 1 15 1C7.82 1 2 7.04 2 14.5C2 24.5 15 39 15 39Z"
            fill="${fill}" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="15" cy="14.5" r="5" fill="#ffffff"/>
    </svg>
  `;
}

function createEndpoint(role: EndpointRole, point: GeoPoint): HTMLElement {
  const container = document.createElement('div');
  container.className = `ufm-endpoint ufm-endpoint-${role}`;

  const pin = document.createElement('span');
  pin.className = 'ufm-endpoint-pin';
  pin.innerHTML = pinSvg(role);

  const label = document.createElement('span');
  label.className = 'ufm-endpoint-label';
  // textContent, jamais innerHTML : le libelle vient d'un geocodeur tiers.
  label.textContent = `${ROLE_LABEL[role]} · ${point.label}`;

  container.append(label, pin);
  return container;
}

/**
 * Aligne les reperes affiches sur les points fournis et rend la nouvelle liste.
 * Les anciens sont retires : sans cela, changer de depart empilerait les
 * epingles precedentes.
 */
export function syncEndpointMarkers(
  map: MaplibreMap,
  current: maplibregl.Marker[],
  origin: GeoPoint | null,
  destination: GeoPoint | null,
): maplibregl.Marker[] {
  current.forEach((marker) => marker.remove());

  const entries: [EndpointRole, GeoPoint][] = [];
  if (origin) {
    entries.push(['origin', origin]);
  }
  if (destination) {
    entries.push(['destination', destination]);
  }

  return entries.map(([role, point]) =>
    new maplibregl.Marker({ element: createEndpoint(role, point), anchor: 'bottom' })
      .setLngLat([point.lon, point.lat])
      .addTo(map),
  );
}
