// Éléments partagés par les modules d'interface : carte différée, constantes de
// modes, états de calques et de feuille mobile, micro-composants transverses.
import { type ComponentProps, lazy, Suspense } from 'react';
import { Bike, Bus, Footprints, Zap } from 'lucide-react';
import type { MobilityMode, RouteOption } from '../../types';
import { getRouteColor } from '../../lib/routeColors';

// La carte embarque MapLibre (~2/3 du poids applicatif). On la charge à la
// demande, après l'écran de connexion, pour alleger le bundle initial.
export const LazyUrbanMap = lazy(() => import('../map/UrbanMap').then((module) => ({ default: module.UrbanMap })));

export function UrbanMap(props: ComponentProps<typeof LazyUrbanMap>) {
    return (
        <Suspense
            fallback={
                <div className="grid h-full w-full place-items-center bg-muted text-sm font-medium text-muted-foreground">
                    Chargement de la carte...
                </div>
            }
        >
            <LazyUrbanMap {...props} />
        </Suspense>
    );
}

export const MODE_OPTIONS: Array<{ mode: MobilityMode; label: string }> = [
    { mode: 'walk', label: 'Marche' },
    { mode: 'bike', label: 'Vélo' },
    { mode: 'scooter', label: 'Trottinette' },
    { mode: 'transit', label: 'Transport public' },
];

export const MODE_ICON: Record<MobilityMode, typeof Footprints> = {
    walk: Footprints,
    bike: Bike,
    scooter: Zap,
    transit: Bus
};

export type LayerState = {
    transitStops: boolean;
    velov: boolean;
    scooters: boolean;
};

export type MobileSheetLevel = 'collapsed' | 'mid' | 'expanded';

export const DEFAULT_LAYERS: LayerState = {
    transitStops: true,
    velov: true,
    scooters: true
};

export const MOBILE_SHEET_ORDER: MobileSheetLevel[] = ['collapsed', 'mid', 'expanded'];
export const MOBILE_SHEET_HEIGHT: Record<MobileSheetLevel, { shell: string; content: string }> = {
    collapsed: {
        shell: 'max-h-[30dvh]',
        content: 'max-h-[calc(30dvh-0.5rem)]'
    },
    mid: {
        shell: 'max-h-[54dvh]',
        content: 'max-h-[calc(54dvh-0.5rem)]'
    },
    expanded: {
        shell: 'max-h-[82dvh]',
        content: 'max-h-[calc(82dvh-0.5rem)]'
    }
};

export function shiftMobileSheetLevel(current: MobileSheetLevel, direction: -1 | 1) {
    const currentIndex = MOBILE_SHEET_ORDER.indexOf(current);
    const nextIndex = Math.min(Math.max(currentIndex + direction, 0), MOBILE_SHEET_ORDER.length - 1);
    return MOBILE_SHEET_ORDER[nextIndex];
}

export function MergeFillet({
    corner,
    size = 24,
    className }: {
        corner: 'tl' | 'tr' | 'bl' | 'br';
        size?: number;
        className?: string;
    }) {
    const at = {
        tl: 'top left',
        tr: 'top right',
        bl: 'bottom left',
        br: 'bottom right'
    }[corner];

    return (
        <span
            aria-hidden
            className={`pointer-events-none absolute ${className ?? ''}`}
            style={{
                width: size,
                height: size,
                background: `radial-gradient(circle at ${at}, rgb(from var(--shell) r g b / 0) ${size - 1}px, var(--shell) ${size}px)`
            }}
        />
    );
}

export function RouteChip({ routeOption, selected, onClick }: { routeOption: RouteOption; selected: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2.5 py-2 text-left transition ${selected ? 'bg-primary/10 text-primary' : 'bg-muted/35 hover:bg-muted/60'
                }`}
            onClick={onClick}
        >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold text-white" style={{ background: getRouteColor(routeOption) }}>
                {routeOption.durationMinutes}
            </span>
            <span className="min-w-0">
                <strong className="flex min-w-0 items-center gap-1.5 text-sm">
                    <span className="truncate">{routeOption.title}</span>
                </strong>
                <span className="block truncate text-xs text-muted-foreground">
                    {routeOption.distanceKm.toFixed(1)} km - {routeOption.carbonGrams} gCO₂e
                </span>
            </span>
        </button>
    );
}

export function LayerToggle({
    label,
    detail,
    active,
    color,
    onClick }: {
        label: string;
        detail: string;
        active: boolean;
        color: string;
        onClick: () => void;
    }) {
    return (
        <button
            type="button"
            className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition ${active ? 'border-primary/30 bg-primary/8' : 'border-border bg-background'
                }`}
            onClick={onClick}
        >
            <span className="flex items-center gap-3">
                <span className={`size-3 rounded-full ${color}`} />
                <span>
                    <strong className="block text-sm">{label}</strong>
                    <span className="block text-xs text-muted-foreground">{detail}</span>
                </span>
            </span>
            <span className={`size-2 rounded-full ${active ? 'bg-primary' : 'bg-border'}`} />
        </button>
    );
}

export function LayerPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
    return (
        <button
            type="button"
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'
                }`}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

export function Metric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
    // <dl> auto-porteur : les dt/dd restent validés quel que soit le conteneur
    // parent (grilles div), exigence WCAG vérifiée par l'audit axe-core.
    return (
        <dl className={`m-0 rounded-lg border border-border/70 bg-background/75 ${compact ? 'px-2 py-1.5' : 'p-2.5'}`}>
            <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
            <dd className="m-0 mt-1 text-sm font-bold">{value}</dd>
        </dl>
    );
}
