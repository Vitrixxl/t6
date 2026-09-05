import type { ReactNode } from 'react';
import { motion, useReducedMotion, type Variants } from 'motion/react';

// Chaque diapositive révèle ses blocs l'un après l'autre : le conteneur porte
// le décalage, les enfants la trajectoire.
const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.09, delayChildren: 0.12 } },
};

export function useItemVariants(): Variants {
    const reduceMotion = useReducedMotion();
    return {
        hidden: { opacity: 0, y: reduceMotion ? 0 : 22 },
        show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 220, damping: 26 } },
    };
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
    return (
        <motion.div className={['frame', className].filter(Boolean).join(' ')} variants={container} initial="hidden" animate="show">
            {eyebrow && (
                <motion.span className="eyebrow" variants={item}>
                    {eyebrow}
                </motion.span>
            )}
            {title && (
                <motion.h2 className="title" variants={item}>
                    {title}
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

interface StatProps {
    value: ReactNode;
    label: ReactNode;
}

export function Stat({ value, label }: StatProps) {
    return (
        <Reveal className="stat">
            <b>{value}</b>
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
    const item = useItemVariants();
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
                <motion.tbody variants={container}>
                    {rows.map((row, rowIndex) => (
                        <motion.tr key={rowIndex} variants={item}>
                            {row.map((cell, cellIndex) => (
                                <td key={cellIndex}>{cell}</td>
                            ))}
                        </motion.tr>
                    ))}
                </motion.tbody>
            </table>
        </Reveal>
    );
}
