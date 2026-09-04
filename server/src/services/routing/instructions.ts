// Traduction des manoeuvres OSRM en instructions lisibles en francais.
//
// Cote serveur : c'est l'API qui rend un contrat fini (trace, distance, duree,
// instructions), et non le navigateur qui reconstitue le sens d'une reponse
// tierce. Le client n'a donc jamais a connaitre le protocole OSRM.
import type { RouteInstruction } from '../../../../src/types.ts';
import type { OsrmStep } from './osrm.ts';

const MANEUVER_LABEL: Partial<Record<string, string>> = {
    depart: 'Partir',
    'new name': 'Continuer',
    merge: "S'inserer",
    'on ramp': 'Prendre la bretelle',
    'off ramp': 'Sortir',
};

const INSTRUCTION_KIND: Partial<Record<string, RouteInstruction['kind']>> = {
    roundabout: 'roundabout',
    rotary: 'roundabout',
    depart: 'depart',
    arrive: 'arrive',
    turn: 'turn',
    'new name': 'turn',
    merge: 'turn',
    'on ramp': 'turn',
    'off ramp': 'turn',
};

export function buildInstructions(steps: OsrmStep[]): RouteInstruction[] {
    return steps
        .filter((step) => step.distance > 8)
        .slice(0, 8)
        .map((step) => ({
            text: formatManeuver(step),
            distanceMeters: Math.round(step.distance),
            detail: step.name ? `sur ${step.name}` : undefined,
            kind: instructionKind(step.maneuver.type),
        }));
}

export function formatManeuver(step: OsrmStep): string {
    const { type, modifier, exit } = step.maneuver;
    const road = step.name ? ` sur ${step.name}` : '';

    if (type === 'arrive') {
        return 'Arriver a destination';
    }
    if (type === 'roundabout' || type === 'rotary') {
        return `Prendre la ${formatOrdinal(exit ?? 1)} sortie${road}`;
    }
    return `${MANEUVER_LABEL[type] ?? formatModifier(modifier)}${road}`;
}

export function formatModifier(modifier?: string): string {
    switch (modifier) {
        case 'left':
            return 'Tourner a gauche';
        case 'right':
            return 'Tourner a droite';
        case 'slight left':
            return 'Legerement a gauche';
        case 'slight right':
            return 'Legerement a droite';
        case 'sharp left':
            return 'Prendre franchement a gauche';
        case 'sharp right':
            return 'Prendre franchement a droite';
        case 'uturn':
            return 'Faire demi-tour';
        case 'straight':
            return 'Continuer tout droit';
        default:
            return 'Continuer';
    }
}

export function formatOrdinal(value: number): string {
    if (value === 1) return '1ere';
    return `${value}e`;
}

export function instructionKind(type: string): RouteInstruction['kind'] {
    return INSTRUCTION_KIND[type] ?? 'continue';
}
