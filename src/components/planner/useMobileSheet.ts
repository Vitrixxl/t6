// Interaction de la feuille mobile : le panneau de trajets ne connaît que sa
// taille courante et branche ces gestionnaires sur sa poignée.
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

export type MobileSheetLevel = 'collapsed' | 'mid' | 'expanded';
const LEVELS: MobileSheetLevel[] = ['collapsed', 'mid', 'expanded'];
const HEIGHT: Record<MobileSheetLevel, string> = {
    collapsed: 'h-[30dvh]',
    mid: 'h-[54dvh]',
    expanded: 'h-[82dvh]',
};

function shiftLevel(current: MobileSheetLevel, direction: -1 | 1): MobileSheetLevel {
    const index = Math.min(Math.max(LEVELS.indexOf(current) + direction, 0), LEVELS.length - 1);
    return LEVELS[index];
}

export function useMobileSheet() {
    const [level, setLevel] = useState<MobileSheetLevel>('mid');
    const dragStartY = useRef<number | null>(null);
    const dragMoved = useRef(false);

    const move = (direction: -1 | 1) => {
        setLevel((current) => shiftLevel(current, direction));
    };

    const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
        dragStartY.current = event.clientY;
        dragMoved.current = false;
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
        if (dragStartY.current !== null && Math.abs(event.clientY - dragStartY.current) > 8) {
            dragMoved.current = true;
        }
    };

    const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
        const startY = dragStartY.current;
        dragStartY.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        if (startY === null) {
            return;
        }

        const deltaY = event.clientY - startY;
        if (Math.abs(deltaY) > 36) {
            move(deltaY < 0 ? 1 : -1);
            return;
        }
    };

    const onPointerCancel = (event: PointerEvent<HTMLButtonElement>) => {
        dragStartY.current = null;
        dragMoved.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            move(event.key === 'ArrowUp' ? 1 : -1);
            return;
        }
    };

    // Le clic natif couvre aussi clavier et lecteur d’écran. Après un glissement,
    // son clic synthétique ne doit pas changer de taille une seconde fois.
    const onClick = () => {
        if (!dragMoved.current) {
            move(level === 'expanded' ? -1 : 1);
        }
        dragMoved.current = false;
    };

    return {
        level,
        setLevel,
        height: HEIGHT[level],
        handle: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onKeyDown, onClick },
    };
}
