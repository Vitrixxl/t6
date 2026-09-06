import { useEffect, useState, type ReactNode } from 'react';
import { animate, motion, useReducedMotion, type Variants } from 'motion/react';

// Chaque diapositive révèle ses blocs l'un après l'autre : le conteneur porte
// le décalage, les enfants la trajectoire. Les titres arrivent mot par mot et
// les compteurs montent jusqu'à leur valeur.
const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08, delayChildren: 0.18 } },
};

const words: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.035, delayChildren: 0.08 } },
};

export function useItemVariants(): Variants {
    const reduceMotion = useReducedMotion();
    return {
        hidden: reduceMotion
            ? { opacity: 0 }
            : { opacity: 0, y: 26, scale: 0.985, filter: 'blur(6px)' },
        show: {
            opacity: 1,
            y: 0,
            scale: 1,
            filter: 'blur(0px)',
            transition: { type: 'spring', stiffness: 240, damping: 24, mass: 0.8 },
        },
    };
}

function useWordVariants(): Variants {
    const reduceMotion = useReducedMotion();
    return {
        hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, filter: 'blur(8px)' },
        show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 300, damping: 26 } },
    };
}

interface WordsProps {
    text: string;
}

function Words({ text }: WordsProps) {
    const word = useWordVariants();
    return (
        <motion.span className="words" variants={words}>
            {text.split(' ').map((token, i) => (
                <motion.span key={`${token}-${i}`} className="word" variants={word}>
                    {token}
                </motion.span>
            ))}
        </motion.span>
    );
}

interface SlideFrameProps {
    eyebrow?: string;
    title?: ReactNode;
    lead?: ReactNode;
    className?: string;
    children?: ReactNode;
}

export function SlideFrame({ eyebrow, title, lead, className, children }: SlideFrameProps) {
    const item = useItemVariants();
    const reduceMotion = useReducedMotion();
    const eyebrowVariants: Variants = {
        hidden: { opacity: 0, x: reduceMotion ? 0 : -18 },
        show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 260, damping: 26 } },
    };
    return (
        <motion.div className={['frame', className].filter(Boolean).join(' ')} variants={container} initial="hidden" animate="show">
            {eyebrow && (
                <motion.span className="eyebrow" variants={eyebrowVariants}>
                    {eyebrow}
                </motion.span>
            )}
            {title && (
                <motion.h2 className="title" variants={typeof title === 'string' ? words : item}>
                    {typeof title === 'string' ? <Words text={title} /> : title}
                </motion.h2>
            )}
            {lead && (
                <motion.p className="lead" variants={item}>
                    {lead}
                </motion.p>
            )}
            {children}
        </motion.div>
    );
}

interface RevealProps {
    as?: 'div' | 'p' | 'li' | 'figure' | 'blockquote' | 'tr';
    className?: string;
    children?: ReactNode;
}

export function Reveal({ as = 'div', className, children }: RevealProps) {
    const item = useItemVariants();
    const Tag = motion[as];
    return (
        <Tag className={className} variants={item}>
            {children}
        </Tag>
    );
}

interface CardProps {
    kicker?: string;
    title: ReactNode;
    children: ReactNode;
    tone?: 'plain' | 'pine' | 'alert';
}

export function Card({ kicker, title, children, tone = 'plain' }: CardProps) {
    return (
        <Reveal className={`card card-${tone}`}>
            {kicker && <span className="card-kicker">{kicker}</span>}
            <h3 className="card-title">{title}</h3>
            <div className="card-body">{children}</div>
        </Reveal>
    );
}

// Un entier affiché monte de zéro à sa valeur ; tout autre texte reste tel quel.
function CountUp({ value }: { value: string }) {
    const reduceMotion = useReducedMotion();
    const target = Number.parseInt(value.replace(/\s/g, ''), 10);
    const isInteger = /^\d[\d\s]*$/.test(value) && Number.isFinite(target);
    const [shown, setShown] = useState(isInteger && !reduceMotion ? 0 : target);

    useEffect(() => {
        if (!isInteger || reduceMotion) return;
        const controls = animate(0, target, {
            duration: 1.3,
            delay: 0.35,
            ease: [0.16, 1, 0.3, 1],
            onUpdate: (latest) => setShown(Math.round(latest)),
        });
        return () => controls.stop();
    }, [isInteger, reduceMotion, target]);

    if (!isInteger) return <>{value}</>;
    return <>{shown.toLocaleString('fr-FR')}</>;
}

interface StatProps {
    value: string;
    label: ReactNode;
}

export function Stat({ value, label }: StatProps) {
    return (
        <Reveal className="stat">
            <b>
                <CountUp value={value} />
            </b>
            <span>{label}</span>
        </Reveal>
    );
}

interface TableProps {
    head: readonly string[];
    rows: readonly (readonly ReactNode[])[];
    className?: string;
}

export function Table({ head, rows, className }: TableProps) {
    const reduceMotion = useReducedMotion();
    const row: Variants = {
        hidden: { opacity: 0, x: reduceMotion ? 0 : -16 },
        show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 260, damping: 26 } },
    };
    const body: Variants = {
        hidden: {},
        show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
    };
    return (
        <Reveal className={['table-wrap', className].filter(Boolean).join(' ')}>
            <table>
                <thead>
                    <tr>
                        {head.map((cell) => (
                            <th key={cell} scope="col">
                                {cell}
                            </th>
                        ))}
                    </tr>
                </thead>
                <motion.tbody variants={body}>
                    {rows.map((cells, rowIndex) => (
                        <motion.tr key={rowIndex} variants={row}>
                            {cells.map((cell, cellIndex) => (
                                <td key={cellIndex}>{cell}</td>
                            ))}
                        </motion.tr>
                    ))}
                </motion.tbody>
            </table>
        </Reveal>
    );
}
