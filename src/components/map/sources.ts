// Helpers d'application : mettre a jour une source ou basculer une couche sans
// recreer la carte.
import type { GeoJSONSource, Map as MaplibreMap } from 'maplibre-gl';
import type { FeatureCollection } from './geojson';

export function setGeoJsonSource(map: MaplibreMap, id: string, data: FeatureCollection) {
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

export function setLayerVisibility(map: MaplibreMap, id: string, visible: boolean) {
  if (map.getLayer(id)) {
    map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  }
}
