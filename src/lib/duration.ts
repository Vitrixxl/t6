/** Les durées restent en minutes dans les contrats ; seule leur lecture change. */
export function formatDuration(minutes: number): string {
    const rounded = Math.round(minutes);
    if (rounded < 60) {
        return `${rounded} min`;
    }
    return `${Math.floor(rounded / 60)}h${String(rounded % 60).padStart(2, '0')}`;
}
