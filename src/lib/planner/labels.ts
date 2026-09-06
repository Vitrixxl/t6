// Libellés affichés. `lineLabel` nomme la ligne exactement ("Métro B",
// "Tram T1") à partir du route_type GTFS et de son nom court.
const ROUTE_KIND: Record<number, string> = {
    0: 'Tram',
    1: 'Métro',
    3: 'Bus',
    7: 'Funiculaire',
};

export function lineLabel(routeType: number, shortName: string): string {
    const kind = ROUTE_KIND[routeType] ?? 'Ligne';
    return shortName ? `${kind} ${shortName}` : kind;
}
