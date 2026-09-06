export const TRANSIT_TYPES = [
    { type: 3, label: 'Bus' },
    { type: 1, label: 'Métro' },
    { type: 0, label: 'Tramway' },
    { type: 7, label: 'Funiculaire' },
] as const;
export type TransitType = typeof TRANSIT_TYPES[number]['type'];
export const ALL_TRANSIT_TYPES: TransitType[] = TRANSIT_TYPES.map(option => option.type);

