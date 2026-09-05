import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { slides } from './slides.tsx';

// Le plateau a une taille fixe et il est mis à l'échelle pour tenir dans la
// fenêtre : la mise en page est ainsi identique sur le projecteur et sur
// l'écran de préparation.
export const STAGE_WIDTH = 1600;
export const STAGE_HEIGHT = 900;

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'l', 'j']);
const PREVIOUS_KEYS = new Set(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'h', 'k']);

interface Position {
    index: number;
    step: number;
}

function clampIndex(index: number): number {
    return Math.min(Math.max(index, 0), slides.length - 1);
}

function stepsOf(index: number): number {
    return slides[index]?.steps ?? 1;
}

function readHash(): Position {
    const value = Number.parseInt(window.location.hash.replace('#', ''), 10);
    return { index: Number.isFinite(value) ? clampIndex(value - 1) : 0, step: 0 };
}

// Une pression avance d'abord dans les étapes de la diapositive, puis passe à
// la suivante ; en arrière, on retombe sur la dernière étape de la précédente.
function forward({ index, step }: Position): Position {
    if (step < stepsOf(index) - 1) return { index, step: step + 1 };
    if (index < slides.length - 1) return { index: index + 1, step: 0 };
    return { index, step };
}

function backward({ index, step }: Position): Position {
    if (step > 0) return { index, step: step - 1 };
    if (index > 0) return { index: index - 1, step: stepsOf(index - 1) - 1 };
    return { index, step };
}

function useStageScale(): number {
    const compute = () => Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT);
    const [scale, setScale] = useState(compute);
    useEffect(() => {
        const update = () => setScale(compute());
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);
    return scale;
}

export function Deck() {
    const [position, setPosition] = useState<Position>(readHash);
    const [direction, setDirection] = useState<1 | -1>(1);
    const scale = useStageScale();
    const reduceMotion = useReducedMotion();

    const move = useCallback((next: (current: Position) => Position) => {
        setPosition((current) => {
            const target = next(current);
            if (target.index !== current.index) setDirection(target.index > current.index ? 1 : -1);
            return target;
        });
    }, []);

    useEffect(() => {
        window.history.replaceState(null, '', `#${position.index + 1}`);
    }, [position.index]);

    useEffect(() => {
        const onHashChange = () => setPosition(readHash());
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, []);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            if (NEXT_KEYS.has(event.key)) {
                event.preventDefault();
                move(forward);
            } else if (PREVIOUS_KEYS.has(event.key)) {
                event.preventDefault();
                move(backward);
            } else if (event.key === 'Home') {
                event.preventDefault();
                move(() => ({ index: 0, step: 0 }));
            } else if (event.key === 'End') {
                event.preventDefault();
                move(() => ({ index: slides.length - 1, step: 0 }));
            } else if (event.key === 'f' || event.key === 'F') {
                event.preventDefault();
                if (document.fullscreenElement) void document.exitFullscreen();
                else void document.documentElement.requestFullscreen();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [move]);

    const slide = slides[position.index];
    if (!slide) throw new Error(`Diapositive ${position.index} introuvable.`);
    const Content = slide.component;

    const variants = useMemo(
        () => ({
            enter: (dir: 1 | -1) => ({ x: reduceMotion ? 0 : dir * 120, opacity: 0, scale: reduceMotion ? 1 : 0.985 }),
            center: { x: 0, opacity: 1, scale: 1 },
            exit: (dir: 1 | -1) => ({ x: reduceMotion ? 0 : dir * -120, opacity: 0, scale: reduceMotion ? 1 : 0.985 }),
        }),
        [reduceMotion],
    );

    const count = String(position.index + 1).padStart(2, '0');
    const total = String(slides.length).padStart(2, '0');

    return (
        <div className="viewport">
            <div className="stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
                <AnimatePresence mode="popLayout" custom={direction} initial={false}>
                    <motion.section
                        key={position.index}
                        className="slide"
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: 'spring', stiffness: 260, damping: 32, mass: 0.9 }}
                        aria-roledescription="diapositive"
                        aria-label={`Diapositive ${position.index + 1} sur ${slides.length}`}
                    >
                        <Content step={position.step} />
                    </motion.section>
                </AnimatePresence>

                <footer className="chrome" aria-hidden="true">
                    <span className="chrome-brand">UrbanFlow Mobility · Titre 6 CDSD</span>
                    <span className="chrome-count">
                        {count} / {total}
                    </span>
                </footer>
                <motion.div
                    className="progress"
                    initial={false}
                    animate={{ width: `${((position.index + 1) / slides.length) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 200, damping: 30 }}
                />
            </div>
        </div>
    );
}
