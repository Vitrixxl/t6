import { GripHorizontal, Map, Maximize2, Rows2 } from 'lucide-react';
import type { MobileSheetLevel, useMobileSheet } from './useMobileSheet';

const SIZES: Array<{ level: MobileSheetLevel; label: string; action: string; icon: typeof Map }> = [
    { level: 'collapsed', label: 'Carte', action: 'Réduire le panneau : carte', icon: Map },
    { level: 'mid', label: 'Aperçu', action: 'Taille moyenne du panneau : aperçu', icon: Rows2 },
    { level: 'expanded', label: 'Détails', action: 'Agrandir le panneau : détails', icon: Maximize2 },
];

export function MobileSheetControls({ sheet, contentId }: { sheet: ReturnType<typeof useMobileSheet>; contentId: string }) {
    return (
        <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-1.5">
            <button
                type="button"
                className="flex size-[44px] shrink-0 touch-none cursor-grab items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary active:cursor-grabbing"
                aria-label={sheet.level === 'expanded' ? 'Réduire le panneau trajets' : 'Agrandir le panneau trajets'}
                aria-controls={contentId}
                title="Glisser vers le haut ou le bas, ou toucher pour changer de taille"
                data-testid="mobile-trip-sheet-handle"
                {...sheet.handle}
            >
                <GripHorizontal className="size-6" aria-hidden="true" />
            </button>
            <div role="group" aria-label="Taille du panneau trajets" className="grid min-w-0 flex-1 grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1">
                {SIZES.map(({ level, label, action, icon: Icon }) => (
                    <button
                        key={level}
                        type="button"
                        aria-label={action}
                        aria-pressed={sheet.level === level}
                        aria-controls={contentId}
                        onClick={() => sheet.setLevel(level)}
                        className={`flex min-h-[44px] min-w-0 items-center justify-center gap-1 rounded-lg px-1 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-primary ${sheet.level === level ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:bg-white/60'}`}
                    >
                        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                        {label}
                    </button>
                ))}
            </div>
        </div>
    );
}
