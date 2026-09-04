import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { type Map as MaplibreMap } from 'maplibre-gl';
import type { GeoPoint, RouteOption, TransportNetwork } from '../../types';
import { getRouteColor } from '../../lib/routeColors';
import type { LayerState } from '../app/shared';
import type { FeatureCollection } from './geojson';
import { setGeoJsonSource, setLayerVisibility } from './sources';
import { bindLongPress, createPickerContent, createPickerMarker, type PickedPoint } from './longPress';
import { legColor } from './legStyle';
import { syncLegLabels } from './legLabels';
import { syncEndpointMarkers } from './endpointMarkers';
import { installMapLayers } from './layers';
import type { SharedStation } from '../../types';
import { IS_DEV } from '../../env';

/**
 * Zoom de recentrage sur un point. Assez proche pour lire les noms de rue,
 * assez large pour voir les stations et arrets alentour : demander sa position
 * sert d'abord a savoir ce qu'on a autour de soi.
 */
const FOCUS_ZOOM = 16;
const NO_LEGS: RouteOption['legs'] = [];

/**
 * Deux points sont au meme endroit en dessous du metre. Comparer les nombres
 * a l'identique serait fragile : une meme position peut transiter par un
 * arrondi et revenir differente au dernier chiffre.
 */
function samePlace(a: GeoPoint, b: GeoPoint): boolean {
    return Math.abs(a.lat - b.lat) < 1e-5 && Math.abs(a.lon - b.lon) < 1e-5;
}

/** Entites GeoJSON communes aux deux couches de mobilite partagee. */
function toStationFeatures(stations: SharedStation[]): FeatureCollection {
    return {
        type: 'FeatureCollection',
        features: stations.map((station) => ({
            type: 'Feature',
            properties: {
                kind: station.kind,
                label: station.name,
                bikes: station.bikes_available,
                scooters: station.scooters_available,
                capacity: station.capacity,
            },
            geometry: { type: 'Point', coordinates: [station.lon, station.lat] },
        })),
    };
}



export function UrbanMap({
    origin,
    destination,
    routes,
    selectedRoute,
    network,
    layers,
    navigationPoint,
    focus,
    onPickPoint,
}: {
    origin: GeoPoint | null;
    destination: GeoPoint | null;
    routes: RouteOption[];
    selectedRoute: RouteOption | null;
    network: TransportNetwork;
    layers: LayerState;
    /** Position GPS de l'utilisateur ("Ma position"), affichee comme repere. */
    navigationPoint?: GeoPoint | null;
    /**
     * Point sur lequel recentrer la carte. `at` porte l'instant de la demande :
     * sans lui, redemander sa position deux fois de suite ne produirait aucun
     * mouvement, la valeur du point etant inchangee.
     */
    focus?: { point: GeoPoint; at: number } | null;
    /**
     * Appele quand l'utilisateur designe un point par appui long et choisit
     * d'en faire son depart ou son arrivee. Absent, l'appui long est inactif.
     */
    onPickPoint?: (point: PickedPoint, role: 'origin' | 'destination') => void;
}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const pickerRef = useRef<{ popup: maplibregl.Popup; marker: maplibregl.Marker } | null>(null);
    const legLabelsRef = useRef<maplibregl.Marker[]>([]);
    const endpointsRef = useRef<maplibregl.Marker[]>([]);
    const mapRef = useRef<MaplibreMap | null>(null);
    const popupRef = useRef<maplibregl.Popup | null>(null);
    // Centre initial: le depart s'il existe deja, sinon le centre de la metropole.
    const initialCenterRef = useRef<Pick<GeoPoint, 'lat' | 'lon'>>(origin ?? { lat: 45.758, lon: 4.845 });
    const [loaded, setLoaded] = useState(false);
    const selectedLegs = selectedRoute?.legs ?? NO_LEGS;

    // Le trajet selectionne est dessine par ses segments (couches `legs`), avec
    // une geometrie routee mode par mode. L'inclure ici aussi superposerait deux
    // traces differents du meme trajet : la couche ne porte donc que les
    // alternatives, en retrait.
    const routeData = useMemo<FeatureCollection>(
        () => ({
            type: 'FeatureCollection',
            features: routes
                // Le trajet selectionne est rendu par ses segments (couches `legs`) ;
                // une option sans geometrie n'est pas dessinee du tout.
                .filter((route) => route.id !== selectedRoute?.id && route.path.length >= 2)
                .map((route) => ({
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

    const legData = useMemo<FeatureCollection>(
        () => ({
            type: 'FeatureCollection',
            // Un segment sans geometrie ne produit aucune entite : la carte reste
            // vide pour lui plutot que d'afficher une ligne inventee (B14).
            features: selectedLegs.filter((leg) => leg.path.length >= 2).map((leg) => ({
                type: 'Feature' as const,
                properties: { mode: leg.mode, label: leg.mapLabel ?? '', color: legColor(leg) },
                geometry: {
                    type: 'LineString' as const,
                    coordinates: leg.path.map((point) => [point.lon, point.lat]),
                },
            })),
        }),
        [selectedLegs],
    );

    const pointData = useMemo<FeatureCollection>(
        () => ({
            type: 'FeatureCollection',
            features: [
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
        [navigationPoint],
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

    // Velo'v et trottinettes sont deux couches distinctes : services differents,
    // densites differentes, et l'utilisateur veut souvent n'en voir qu'une.
    const velovData = useMemo<FeatureCollection>(
        () => toStationFeatures(network.sharedMobility.data.stations.filter((station) => station.kind === 'velov')),
        [network],
    );

    const scooterData = useMemo<FeatureCollection>(
        () => toStationFeatures(network.sharedMobility.data.stations.filter((station) => station.kind === 'scooter')),
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

        if (IS_DEV) {
            // Poignee de debogage : MapLibre n'expose pas son instance, et sans elle
            // on ne peut verifier ni les couches ni les sources depuis le navigateur.
            // Une seule carte est montee a la fois ; retiree du build de production.
            (window as unknown as { __ufmMap?: MaplibreMap }).__ufmMap = map;
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
        setGeoJsonSource(map, 'legs', legData);
        setGeoJsonSource(map, 'points', pointData);
        setGeoJsonSource(map, 'stops', stopData);
        setGeoJsonSource(map, 'velov', velovData);
        setGeoJsonSource(map, 'scooters', scooterData);

        installMapLayers(map, popupRef);

        setLayerVisibility(map, 'stops-circle', layers.transitStops);
        setLayerVisibility(map, 'velov-circle', layers.velov);
        setLayerVisibility(map, 'scooters-circle', layers.scooters);
    }, [layers, legData, loaded, pointData, routeData, scooterData, stopData, velovData]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !loaded || !selectedRoute) {
            return;
        }

        // Le cadrage ne depend pas du trace : tant que le routage n'a pas repondu,
        // il se fait sur les extremites, connues des la selection.
        const bounds = new maplibregl.LngLatBounds();
        selectedRoute.path.forEach((point) => bounds.extend([point.lon, point.lat]));
        if (origin) {
            bounds.extend([origin.lon, origin.lat]);
        }
        if (destination) {
            bounds.extend([destination.lon, destination.lat]);
        }
        if (bounds.isEmpty()) {
            return;
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

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !loaded) {
            return;
        }
        legLabelsRef.current = syncLegLabels(map, legLabelsRef.current, selectedLegs);
    }, [loaded, selectedLegs]);

    // Recentrage sur demande explicite. Declare apres le cadrage d'itineraire :
    // a rendu egal, l'effet le plus bas s'execute en dernier et l'emporte, ce qui
    // est le bon arbitrage — l'utilisateur vient de demander a voir ou il est.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !loaded || !focus) {
            return;
        }
        map.flyTo({ center: [focus.point.lon, focus.point.lat], zoom: FOCUS_ZOOM, duration: 700 });
    }, [focus, loaded]);

    // Les reperes apparaissent des la selection d'un depart ou d'une arrivee,
    // sans attendre qu'un itineraire soit calcule.
    //
    // Le repere de depart est omis quand il tombe sur la position courante : le
    // point de position marque deja l'endroit, et empiler une epingle par-dessus
    // n'ajoute rien qu'un chevauchement d'etiquettes.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !loaded) {
            return;
        }
        const originMarker = origin && navigationPoint && samePlace(origin, navigationPoint) ? null : origin;
        endpointsRef.current = syncEndpointMarkers(map, endpointsRef.current, originMarker, destination);
    }, [destination, loaded, navigationPoint, origin]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !loaded || !onPickPoint) {
            return;
        }

        const closePicker = (): void => {
            pickerRef.current?.popup.remove();
            pickerRef.current?.marker.remove();
            pickerRef.current = null;
        };

        const detach = bindLongPress(map, {
            onPick: (point) => {
                closePicker();

                const content = createPickerContent(
                    {
                        title: `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`,
                        origin: 'Definir comme depart',
                        destination: 'Definir comme arrivee',
                    },
                    (role) => {
                        onPickPoint(point, role);
                        closePicker();
                    },
                );

                const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '260px', offset: 28, className: 'ufm-popup' })
                    .setLngLat([point.lon, point.lat])
                    .setDOMContent(content)
                    .addTo(map);
                popup.on('close', () => {
                    pickerRef.current?.marker.remove();
                    pickerRef.current = null;
                });

                pickerRef.current = { popup, marker: createPickerMarker(map, point) };
            },
        });

        return () => {
            detach();
            closePicker();
        };
    }, [loaded, onPickPoint]);

    return <div ref={containerRef} className="absolute inset-0 h-full w-full" aria-label="Carte des trajets UrbanFlow" />;
}
