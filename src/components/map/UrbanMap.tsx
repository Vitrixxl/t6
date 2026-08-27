import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { type Map as MaplibreMap } from 'maplibre-gl';
import type { GeoPoint, RouteOption, TransportNetwork } from '../../types';
import { getRouteColor } from '../../lib/routeColors';
import type { LayerState } from '../app/shared';
import type { FeatureCollection } from './geojson';
import { bindPointPopup, escapeHtml } from './popup';
import { setGeoJsonSource, setLayerVisibility } from './sources';



export function UrbanMap({
  origin,
  destination,
  routes,
  selectedRoute,
  network,
  layers,
  navigationPoint,
}: {
  origin: GeoPoint | null;
  destination: GeoPoint | null;
  routes: RouteOption[];
  selectedRoute: RouteOption | null;
  network: TransportNetwork;
  layers: LayerState;
  /** Position GPS de l'utilisateur ("Ma position"), affichee comme repere. */
  navigationPoint?: GeoPoint | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  // Centre initial: le depart s'il existe deja, sinon le centre de la metropole.
  const initialCenterRef = useRef<Pick<GeoPoint, 'lat' | 'lon'>>(origin ?? { lat: 45.758, lon: 4.845 });
  const [loaded, setLoaded] = useState(false);

  const routeData = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: routes.map((route) => ({
        type: 'Feature',
        properties: {
          id: route.id,
          title: route.title,
          color: getRouteColor(route),
          selected: route.id === selectedRoute?.id,
        },
        geometry: {
          type: 'LineString',
          coordinates: route.path.map((point) => [point.lon, point.lat]),
        },
      })),
    }),
    [routes, selectedRoute],
  );

  const pointData = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: [
        ...(origin
          ? [
              {
                type: 'Feature' as const,
                properties: { kind: 'origin', label: origin.label, color: '#111827' },
                geometry: { type: 'Point' as const, coordinates: [origin.lon, origin.lat] },
              },
            ]
          : []),
        ...(destination
          ? [
              {
                type: 'Feature' as const,
                properties: { kind: 'destination', label: destination.label, color: '#ef4444' },
                geometry: { type: 'Point' as const, coordinates: [destination.lon, destination.lat] },
              },
            ]
          : []),
        ...(navigationPoint
          ? [
              {
                type: 'Feature' as const,
                properties: { kind: 'navigation', label: navigationPoint.label, color: '#2f6cb3' },
                geometry: { type: 'Point' as const, coordinates: [navigationPoint.lon, navigationPoint.lat] },
              },
            ]
          : []),
      ],
    }),
    [destination, navigationPoint, origin],
  );

  const stopData = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: network.gtfs.stops.map((stop) => ({
        type: 'Feature',
        properties: {
          kind: 'stop',
          label: stop.stop_name,
          accessible: stop.wheelchair_boarding === 1,
        },
        geometry: { type: 'Point', coordinates: [stop.stop_lon, stop.stop_lat] },
      })),
    }),
    [network],
  );

  const stationData = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: network.sharedMobility.data.stations.map((station) => ({
        type: 'Feature',
        properties: {
          kind: 'station',
          label: station.name,
          bikes: station.bikes_available,
          scooters: station.scooters_available,
        },
        geometry: { type: 'Point', coordinates: [station.lon, station.lat] },
      })),
    }),
    [network],
  );

  const incidentData = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: network.gtfs.incidents.map((incident, index) => {
        // Les alertes TCL n'ont pas de coordonnees (portee ligne/reseau) : on
        // les ancre sur des arrets repartis dans tout le reseau (pas d'amas).
        const stride = Math.max(1, Math.floor(network.gtfs.stops.length / Math.max(network.gtfs.incidents.length, 1)));
        const anchor = network.gtfs.stops[(index * stride) % network.gtfs.stops.length];
        return {
          type: 'Feature',
          properties: {
            kind: 'incident',
            label: incident.title,
            severity: incident.severity,
            message: incident.message,
          },
          geometry: { type: 'Point', coordinates: [anchor.stop_lon + 0.003, anchor.stop_lat + 0.003] },
        };
      }),
    }),
    [network],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [initialCenterRef.current.lon, initialCenterRef.current.lat],
      zoom: 12.2,
      minZoom: 2,
      maxZoom: 19,
      pitch: 0,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: 'OpenStreetMap',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'bottom-right');
    map.on('load', () => setLoaded(true));
    mapRef.current = map;
    if (import.meta.env.DEV) {
      // Poignees de debug pour les tests manuels/E2E (dev uniquement).
      // Deux instances co-existent (layouts desktop et mobile).
      const debugWindow = window as { __ufmMaps?: MaplibreMap[] };
      debugWindow.__ufmMaps = [...(debugWindow.__ufmMaps ?? []), map];
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) {
      return;
    }

    setGeoJsonSource(map, 'routes', routeData);
    setGeoJsonSource(map, 'points', pointData);
    setGeoJsonSource(map, 'stops', stopData);
    setGeoJsonSource(map, 'stations', stationData);
    setGeoJsonSource(map, 'incidents', incidentData);

    if (!map.getLayer('routes-casing')) {
      // Lisere blanc sous le trace : le rend lisible sur tous les fonds de rue.
      map.addLayer({
        id: 'routes-casing',
        type: 'line',
        source: 'routes',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#ffffff',
          // Le zoom doit etre dans un interpolate de premier niveau (contrainte
          // des expressions camera MapLibre), le case porte sur les sorties.
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            11,
            ['case', ['==', ['get', 'selected'], true], 9, 5],
            15,
            ['case', ['==', ['get', 'selected'], true], 16, 8],
          ],
          'line-opacity': ['case', ['==', ['get', 'selected'], true], 0.9, 0.35],
        },
      });
    }

    if (!map.getLayer('routes-line')) {
      map.addLayer({
        id: 'routes-line',
        type: 'line',
        source: 'routes',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            11,
            ['case', ['==', ['get', 'selected'], true], 6, 3],
            15,
            ['case', ['==', ['get', 'selected'], true], 11, 5],
          ],
          'line-opacity': ['case', ['==', ['get', 'selected'], true], 0.98, 0.45],
        },
      });
    }

    if (!map.getLayer('points-circle')) {
      map.addLayer({
        id: 'points-circle',
        type: 'circle',
        source: 'points',
        paint: {
          'circle-radius': ['case', ['==', ['get', 'kind'], 'navigation'], 11, ['==', ['get', 'kind'], 'origin'], 9, 8],
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['case', ['==', ['get', 'kind'], 'navigation'], 4, 3],
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

    if (!map.getLayer('stops-circle')) {
      map.addLayer({
        id: 'stops-circle',
        type: 'circle',
        source: 'stops',
        paint: {
          // Taille liee au zoom pour rester lisible en vue metropole comme en vue rue.
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 12, 5.5, 15, 9],
          // Bleu vif vs vert lime des stations : contraste net entre les couches.
          'circle-color': '#2563eb',
          'circle-opacity': 0.95,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.75,
        },
      });
      bindPointPopup(map, 'stops-circle', popupRef, (properties) => `
        <p class="ufm-popup-kind">Arret transport public</p>
        <strong>${escapeHtml(properties.label)}</strong>
        <p>${properties.accessible === true || properties.accessible === 'true' ? 'Accessible PMR' : 'Accessibilite PMR non garantie'}</p>
      `);
    }

    if (!map.getLayer('stations-circle')) {
      map.addLayer({
        id: 'stations-circle',
        type: 'circle',
        source: 'stations',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 12, 5.5, 15, 9],
          'circle-color': '#84cc16',
          'circle-opacity': 0.95,
          'circle-stroke-color': '#3f6212',
          'circle-stroke-width': 1.5,
        },
      });
      bindPointPopup(map, 'stations-circle', popupRef, (properties) => `
        <p class="ufm-popup-kind">Station partagee</p>
        <strong>${escapeHtml(properties.label)}</strong>
        <p>${escapeHtml(properties.bikes)} velo(s) &middot; ${escapeHtml(properties.scooters)} trottinette(s) disponibles</p>
      `);
    }

    if (!map.getLayer('incidents-circle')) {
      map.addLayer({
        id: 'incidents-circle',
        type: 'circle',
        source: 'incidents',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 7, 14, 11],
          'circle-color': '#ef4444',
          'circle-opacity': 0.92,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2.5,
        },
      });
      bindPointPopup(map, 'incidents-circle', popupRef, (properties) => `
        <p class="ufm-popup-kind ufm-popup-kind-alert">Incident ${escapeHtml(properties.severity)}</p>
        <strong>${escapeHtml(properties.label)}</strong>
        <p>${escapeHtml(properties.message)}</p>
      `);
    }

    setLayerVisibility(map, 'stops-circle', layers.transitStops);
    setLayerVisibility(map, 'stations-circle', layers.sharedMobility);
    setLayerVisibility(map, 'incidents-circle', layers.incidents);
  }, [incidentData, layers, loaded, pointData, routeData, stationData, stopData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !selectedRoute || selectedRoute.path.length === 0) {
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    selectedRoute.path.forEach((point) => bounds.extend([point.lon, point.lat]));
    if (origin) {
      bounds.extend([origin.lon, origin.lat]);
    }
    if (destination) {
      bounds.extend([destination.lon, destination.lat]);
    }

    // Cadre le trajet selectionne pour qu'il remplisse la zone visible de la
    // carte (le conteneur exclut deja les rails lateraux) en evitant seulement
    // la barre de recherche en haut et le bandeau d'options en bas.
    map.fitBounds(bounds, {
      padding: {
        top: window.innerWidth >= 1024 ? 96 : 140,
        right: 48,
        bottom: window.innerWidth >= 1024 ? 88 : 300,
        left: 48,
      },
      maxZoom: 16.2,
      duration: 650,
    });
  }, [destination, loaded, origin, selectedRoute]);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" aria-label="Carte des trajets UrbanFlow" />;
}
