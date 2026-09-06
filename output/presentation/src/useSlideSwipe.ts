import { useRef, type TouchEvent } from 'react';

interface TouchOrigin {
    x: number;
    y: number;
}

/** Un balayage volontaire change de diapo ; zoom, liens et gestes verticaux restent au navigateur. */
export function useSlideSwipe(previous: () => void, next: () => void) {
    const origin = useRef<TouchOrigin | null>(null);

    const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
        const interactive = event.target instanceof Element && event.target.closest('a, button, input, select, textarea, [role="button"]');
        const touch = event.touches[0];
        origin.current = event.touches.length === 1 && !interactive
            ? { x: touch.clientX, y: touch.clientY }
            : null;
    };

    const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
        const start = origin.current;
        origin.current = null;
        if (!start || event.touches.length !== 0) return;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        if (dx < 0) next();
        else previous();
    };

    return { onTouchStart, onTouchEnd, onTouchCancel: () => { origin.current = null; } };
}
