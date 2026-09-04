// Géolocalisation de l'utilisateur.
//
// Deux temps distincts : une demande explicite (consentement du navigateur,
// exigence C6/C8 - la position n'est jamais prise sans action de l'utilisateur),
// puis un suivi léger qui tient le repere "Ma position" à jour sur la carte.
// Il ne s'agit pas de guidage : uniquement l'affichage temps réel.
import { useEffect, useRef, useState } from 'react';
import type { GeoPoint } from '../../../types';
import { IS_DEV } from '../../../env';

const FIRST_FIX_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 };
const WATCH_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 };

/**
 * Position simulée en développement.
 *
 * Le poste de développement n'est pas a Lyon, et le navigateur d'un
 * environnement de test refuse souvent la géolocalisation : le parcours
 * "Ma position" devenait alors intestable, alors qu'il est au cœur de F2.
 * Ce point est place à la Guillotiere, dans le périmètre du réseau, pour que
 * les itinéraires calculés ressemblent a ceux d'un utilisateur réel.
 *
 * La garde `IS_DEV` est évaluée à la compilation : le bloc
 * disparaît du build de production, ou seule la géolocalisation du navigateur
 * subsiste.
 */
const DEV_POSITION: GeoPoint = {
    label: 'Ma position',
    lat: 45.75378,
    lon: 4.84685,
    accuracyMeters: 15,
};

export interface Geolocation {
    currentPosition: GeoPoint | null;
    /** Message affiche à l'utilisateur : la précision réelle est annoncée, jamais supposée. */
    status: string;
    requestCurrentPosition: () => Promise<GeoPoint | null>;
}

export function useGeolocation(): Geolocation {
    const [currentPosition, setCurrentPosition] = useState<GeoPoint | null>(null);
    const [status, setStatus] = useState('GPS non demandé');
    const watchIdRef = useRef<number | null>(null);

    // Le suivi est arrête au démontage : pas de capteur laisse actif en fond.
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
        setStatus(`GPS ok - précision ${Math.round(position.coords.accuracy)} m`);
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
            if (IS_DEV) {
                setCurrentPosition(DEV_POSITION);
                setStatus('GPS simulé (développement)');
                resolve(DEV_POSITION);
                return;
            }

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
                    setStatus(`GPS refusé: ${error.message}`);
                    resolve(null);
                },
                FIRST_FIX_OPTIONS,
            );
        });

    return { currentPosition, status, requestCurrentPosition };
}
