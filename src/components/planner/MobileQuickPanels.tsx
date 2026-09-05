// Barre mobile opaque : libellés visibles, cibles tactiles et contraste sur la carte.
import { useState } from 'react';
import { useSetAtom } from 'jotai';
import { Layers, LocateFixed, Radar, Route, UserRound } from 'lucide-react';
import { useSavedRoutes } from '../../queries';
import { openHubAtom } from '../../state';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '../ui/drawer';
import { LayerPill, type LayerState } from '../app/shared';
import type { GeoPoint, TransportContext } from '../../types';
import { MobileHomePanel } from './MobileHomePanel';

function ActionButton({
    label,
    caption,
    badge,
    tourTarget,
    onClick,
    children,
}: {
    label: string;
    caption: string;
    badge?: number;
    tourTarget: string;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            data-tour={tourTarget}
            // Taille en pixels, pas en rem : la racine du document est à 14 px, une
            // valeur en rem donnerait 42 px et raterait la cible tactile de 44 px.
            className="relative flex min-h-[60px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-primary/20 bg-primary/5 px-1 text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:bg-primary/20"
        >
            {children}
            <span className="text-[11px] font-semibold leading-tight">{caption}</span>
            {badge && badge > 0 ? (
                <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
                    {Math.min(badge, 9)}
                </span>
            ) : null}
        </button>
    );
}

export function MobileActionRail({
    network,
    currentPosition,
    origin,
    layers,
    onLayersChange,
    onOpenProfile,
    onLocate,
}: {
    network: TransportContext;
    currentPosition: GeoPoint | null;
    origin: GeoPoint | null;
    layers: LayerState;
    onLayersChange: (layers: LayerState) => void;
    onOpenProfile: () => void;
    onLocate: () => void;
}) {
    const savedCount = useSavedRoutes().length;
    const openHub = useSetAtom(openHubAtom);
    const onOpenSavedTrips = () => openHub('saved');
    const [nearbyOpen, setNearbyOpen] = useState(false);
    const [layersOpen, setLayersOpen] = useState(false);

    return (
        <>
            <div role="group" aria-label="Actions de la carte" className="absolute inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+8px)] z-40 grid grid-cols-5 gap-1 rounded-2xl border border-primary/25 bg-background p-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.25)]">
                <ActionButton label="Ouvrir le profil" caption="Profil" tourTarget="mobile-profile" onClick={onOpenProfile}>
                    <UserRound className="size-5" aria-hidden="true" />
                </ActionButton>
                <ActionButton label="Trajets enregistrés" caption="Trajets" badge={savedCount} tourTarget="mobile-trips" onClick={onOpenSavedTrips}>
                    <Route className="size-5" aria-hidden="true" />
                </ActionButton>

                <ActionButton label="Ma position" caption="Position" tourTarget="mobile-location" onClick={onLocate}>
                    <LocateFixed className="size-5" aria-hidden="true" />
                </ActionButton>
                <ActionButton label="Couches de la carte" caption="Couches" tourTarget="mobile-layers" onClick={() => setLayersOpen(true)}>
                    <Layers className="size-5" aria-hidden="true" />
                </ActionButton>
                <ActionButton label="Autour de moi" caption="Autour" tourTarget="mobile-nearby" onClick={() => setNearbyOpen(true)}>
                    <Radar className="size-5" aria-hidden="true" />
                </ActionButton>
            </div>

            <Drawer open={nearbyOpen} onOpenChange={setNearbyOpen}>
                <DrawerContent>
                    <DrawerHeader className="pb-2 text-left">
                        <DrawerTitle>Autour de moi</DrawerTitle>
                        <DrawerDescription>
                            Disponibilités en direct depuis {currentPosition ? 'ta position' : 'le centre de la métropole'}.
                        </DrawerDescription>
                    </DrawerHeader>
                    <div className="overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <MobileHomePanel
                            network={network}
                            currentPosition={currentPosition}
                            origin={origin}
                            onUseCurrentPosition={onLocate}
                        />
                    </div>
                </DrawerContent>
            </Drawer>

            <Drawer open={layersOpen} onOpenChange={setLayersOpen}>
                <DrawerContent>
                    <DrawerHeader className="pb-2 text-left">
                        <DrawerTitle>Couches</DrawerTitle>
                        <DrawerDescription>Ce qui apparaît sur la carte.</DrawerDescription>
                    </DrawerHeader>
                    <div className="flex flex-wrap gap-2 px-4 pb-6">
                        <LayerPill
                            active={layers.transitStops}
                            onClick={() => onLayersChange({ ...layers, transitStops: !layers.transitStops })}
                        >
                            Arrêts
                        </LayerPill>
                        <LayerPill active={layers.velov} onClick={() => onLayersChange({ ...layers, velov: !layers.velov })}>
                            Vélo&apos;v
                        </LayerPill>
                        <LayerPill active={layers.scooters} onClick={() => onLayersChange({ ...layers, scooters: !layers.scooters })}>
                            Trottinettes
                        </LayerPill>
                    </div>
                </DrawerContent>
            </Drawer>
        </>
    );
}
