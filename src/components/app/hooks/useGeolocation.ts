// Geolocalisation de l'utilisateur.
//
// Deux temps distincts : une demande explicite (consentement du navigateur,
// exigence C6/C8 - la position n'est jamais prise sans action de l'utilisateur),
// puis un suivi leger qui tient le repere "Ma position" a jour sur la carte.
// Il ne s'agit pas de guidage : uniquement l'affichage temps reel.
import { useEffect, useRef, useState } from 'react';
import type { GeoPoint } from '../../../types';

const FIRST_FIX_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 };
const WATCH_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 };

export interface Geolocation {
  currentPosition: GeoPoint | null;
  /** Message affiche a l'utilisateur : la precision reelle est annoncee, jamais supposee. */
  status: string;
  requestCurrentPosition: () => Promise<GeoPoint | null>;
}

export function useGeolocation(): Geolocation {
  const [currentPosition, setCurrentPosition] = useState<GeoPoint | null>(null);
  const [status, setStatus] = useState('GPS non demande');
  const watchIdRef = useRef<number | null>(null);

  // Le suivi est arrete au demontage : pas de capteur laisse actif en fond.
  useEffect(
    () => () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    },
    [],
  );

  const applyGpsPosition = (position: GeolocationPosition): GeoPoint => {
    const point = {
      label: 'Ma position',
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      accuracyMeters: position.coords.accuracy,
    };
    setCurrentPosition(point);
    setStatus(`GPS ok - precision ${Math.round(position.coords.accuracy)} m`);
    return point;
  };

  const startPositionWatch = (): void => {
    if (watchIdRef.current !== null || !navigator.geolocation) {
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(applyGpsPosition, () => undefined, WATCH_OPTIONS);
  };

  const requestCurrentPosition = (): Promise<GeoPoint | null> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) {
        setStatus('GPS indisponible');
        resolve(null);
        return;
      }

      setStatus('GPS en cours');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const point = applyGpsPosition(position);
          startPositionWatch();
          resolve(point);
        },
        (error) => {
          // Refus assume : l'utilisateur garde la saisie manuelle (C6).
          setStatus(`GPS refuse: ${error.message}`);
          resolve(null);
        },
        FIRST_FIX_OPTIONS,
      );
    });

  return { currentPosition, status, requestCurrentPosition };
}
