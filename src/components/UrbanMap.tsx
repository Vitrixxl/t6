import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { type GeoJSONSource, type Map as MaplibreMap } from 'maplibre-gl';
import type { GeoPoint, RouteOption, TransportNetwork } from '../types';

type LayerState = {
  transitStops: boolean;
  sharedMobility: boolean;
  incidents: boolean;
};

type FeatureCollection = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: Record<string, string | number | boolean | null>;
    geometry:
      | {
          type: 'LineString';
          coordinates: number[][];
        }
      | {
          type: 'Point';
          coordinates: number[];
        };
  }>;
};

const ROUTE_COLORS: Record<string, string> = {
  transit: '#2f6cb3',
  bike: '#1d6b4f',
  scooter: '#d97706',
  carpool: '#7c5cbf',
};

export function getRouteColor(route: RouteOption): string {
  if (route.modes.includes('transit')) return ROUTE_COLORS.transit;
  if (route.modes.includes('bike')) return ROUTE_COLORS.bike;
  if (route.modes.includes('scooter')) return ROUTE_COLORS.scooter;
  return ROUTE_COLORS.carpool;
}

export function UrbanMap({
  origin,
  destination,
  routes,
  selectedRoute,
  network,
  layers,
  overviewSignal,
  navigationPoint,
  navigationActive = false,
}: {
  origin: GeoPoint;
  destination: GeoPoint;
  routes: RouteOption[];
  selectedRoute: RouteOption | null;
  network: TransportNetwork;
  layers: LayerState;
  overviewSignal: number;
  navigationPoint?: GeoPoint | null;
  navigationActive?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const initialOriginRef = useRef(origin);
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
        {
          type: 'Feature',
          properties: { kind: 'origin', label: origin.label, color: '#111827' },
          geometry: { type: 'Point', coordinates: [origin.lon, origin.lat] },
        },
        {
          type: 'Feature',
          properties: { kind: 'destination', label: destination.label, color: '#ef4444' },
          geometry: { type: 'Point', coordinates: [destination.lon, destination.lat] },
        },
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
        const anchor = network.gtfs.stops[index % network.gtfs.stops.length];
        return {
          type: 'Feature',
          properties: {
            kind: 'incident',
            label: incident.title,
            severity: incident.severity,
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
      center: [initialOriginRef.current.lon, initialOriginRef.current.lat],
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
          'line-width': ['case', ['==', ['get', 'selected'], true], 8, 4],
          'line-opacity': ['case', ['==', ['get', 'selected'], true], 0.96, 0.38],
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
          'circle-radius': 3.5,
          'circle-color': '#2f6cb3',
          'circle-opacity': 0.85,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
        },
      });
    }

    if (!map.getLayer('stations-circle')) {
      map.addLayer({
        id: 'stations-circle',
        type: 'circle',
        source: 'stations',
        paint: {
          'circle-radius': 3.5,
          'circle-color': '#0f766e',
          'circle-opacity': 0.85,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
        },
      });
    }

    if (!map.getLayer('incidents-circle')) {
      map.addLayer({
        id: 'incidents-circle',
        type: 'circle',
        source: 'incidents',
        paint: {
          'circle-radius': 7,
          'circle-color': '#ef4444',
          'circle-opacity': 0.88,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });
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
    bounds.extend([origin.lon, origin.lat]);
    bounds.extend([destination.lon, destination.lat]);

    map.fitBounds(bounds, {
      padding: {
        top: 110,
        right: window.innerWidth >= 1024 ? 430 : 32,
        bottom: window.innerWidth >= 768 ? 80 : 280,
        left: window.innerWidth >= 1024 ? 380 : 32,
      },
      maxZoom: 13.2,
      duration: 650,
    });
  }, [destination, loaded, origin, selectedRoute]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || overviewSignal === 0) {
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    routes.forEach((routeOption) => {
      routeOption.path.forEach((point) => bounds.extend([point.lon, point.lat]));
    });
    network.gtfs.stops.forEach((stop) => bounds.extend([stop.stop_lon, stop.stop_lat]));
    network.sharedMobility.data.stations.forEach((station) => bounds.extend([station.lon, station.lat]));
    bounds.extend([origin.lon, origin.lat]);
    bounds.extend([destination.lon, destination.lat]);

    map.fitBounds(bounds, {
      padding: {
        top: 120,
        right: window.innerWidth >= 1024 ? 470 : 36,
        bottom: window.innerWidth >= 768 ? 120 : 320,
        left: window.innerWidth >= 1024 ? 420 : 36,
      },
      maxZoom: 11,
      duration: 700,
    });
  }, [destination, loaded, network, origin, overviewSignal, routes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !navigationActive || !navigationPoint) {
      return;
    }

    map.easeTo({
      center: [navigationPoint.lon, navigationPoint.lat],
      zoom: Math.max(map.getZoom(), 15.4),
      duration: 650,
    });
  }, [loaded, navigationActive, navigationPoint]);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" aria-label="Carte des trajets UrbanFlow" />;
}

function setGeoJsonSource(map: MaplibreMap, id: string, data: FeatureCollection) {
  const source = map.getSource(id) as GeoJSONSource | undefined;
  if (source) {
    source.setData(data);
    return;
  }

  map.addSource(id, {
    type: 'geojson',
    data,
  });
}

function setLayerVisibility(map: MaplibreMap, id: string, visible: boolean) {
  if (map.getLayer(id)) {
    map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  }
}
