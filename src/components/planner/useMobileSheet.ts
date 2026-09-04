// Interaction de la feuille mobile : le panneau de trajets ne connait que sa
// taille courante et branche ces gestionnaires sur sa poignee.
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { MOBILE_SHEET_HEIGHT, shiftMobileSheetLevel, type MobileSheetLevel } from '../app/shared';

export function useMobileSheet() {
    const [level, setLevel] = useState<MobileSheetLevel>('mid');
    const dragStartY = useRef<number | null>(null);
    const dragMoved = useRef(false);

    const move = (direction: -1 | 1) => {
        setLevel((current) => shiftMobileSheetLevel(current, direction));
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
        if (!dragMoved.current) {
            move(level === 'expanded' ? -1 : 1);
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
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            move(level === 'expanded' ? -1 : 1);
        }
    };

    return {
        sizing: MOBILE_SHEET_HEIGHT[level],
        handle: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onKeyDown },
    };
}
