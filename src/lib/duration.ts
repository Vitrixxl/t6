/** Les durées restent en minutes dans les contrats ; seule leur lecture change. */
export function formatDuration(minutes: number): string {
    const rounded = Math.round(minutes);
    if (rounded < 60) {
        return `${rounded} min`;
    }
    return `${Math.floor(rounded / 60)}h${String(rounded % 60).padStart(2, '0')}`;
}

/** Heure locale d'un instant ISO, « 08:12 » : ce que l'utilisateur lit sur un horaire. */
export function formatClockTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
