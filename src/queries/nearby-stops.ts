import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, treatyRequest } from '../lib/api/client';
import type { GeoPoint } from '../types';

export function useNearbyStops(point: GeoPoint, radiusKm: number, version: string) {
    const [radius, setRadius] = useState(radiusKm);
    useEffect(() => {
        const timer = setTimeout(() => setRadius(radiusKm), 250);
        return () => clearTimeout(timer);
    }, [radiusKm]);
    const query = useQuery({
        queryKey: ['nearby-stops', version, point.lat, point.lon, radius],
        queryFn: ({ signal }) => treatyRequest(api.transport['nearby-stops'].get({
            query: { lat: point.lat, lon: point.lon, radiusKm: radius }, fetch: { signal },
        })),
        staleTime: Infinity,
    });
    return { ...query, isPending: query.isPending || radius !== radiusKm };
}
