// Conversions numeriques partagées par le moteur.

export function minutesForDistance(distanceKm: number, speedKmh: number): number {
    return Math.max(Math.ceil((distanceKm / speedKmh) * 60), 1);
}

export function round(value: number, decimals: number): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}
