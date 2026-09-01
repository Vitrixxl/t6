// Barre d'actions permanente de l'ecran mobile.
//
// La carte est l'ecran principal : rien ne la recouvre tant que l'utilisateur
// ne le demande pas. Les actions vivent donc dans deux groupes ancres en bas,
// dans la zone que le pouce atteint sans changer de prise sur le telephone.
//
// Le regroupement suit la nature de l'action, pas l'ordre d'apparition : a
// gauche ce qui appartient a l'utilisateur (son profil, ses trajets), a droite
// ce qui agit sur la carte (se localiser, choisir les calques, regarder autour).
import { useState } from 'react';
import { Layers, LocateFixed, Radar, Route, UserRound } from 'lucide-react';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '../ui/drawer';
import { LayerPill, type LayerState } from '../app/shared';
import type { GeoPoint, TransportNetwork } from '../../types';
import { MobileHomePanel } from './MobileHomePanel';

function ActionButton({
  label,
  badge,
  onClick,
  children,
}: {
  label: string;
  badge?: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      // Taille en pixels, pas en rem : la racine du document est a 14 px, une
      // valeur en rem donnerait 42 px et raterait la cible tactile de 44 px.
      className="pointer-events-auto relative grid size-[52px] place-items-center rounded-2xl border border-white/80 bg-white/95 text-foreground shadow-float backdrop-blur-xl transition-transform active:scale-[0.94]"
    >
      {children}
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
  savedCount,
  layers,
  onLayersChange,
  onOpenProfile,
  onOpenSavedTrips,
  onLocate,
}: {
  network: TransportNetwork;
  currentPosition: GeoPoint | null;
  origin: GeoPoint | null;
  savedCount: number;
  layers: LayerState;
  onLayersChange: (layers: LayerState) => void;
  onOpenProfile: () => void;
  onOpenSavedTrips: () => void;
  onLocate: () => void;
}) {
  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex items-end justify-between px-3 pb-[calc(env(safe-area-inset-bottom)+0.85rem)]">
        <div className="flex items-end gap-2">
          <ActionButton label="Ouvrir le profil" onClick={onOpenProfile}>
            <UserRound className="size-5" aria-hidden="true" />
          </ActionButton>
          <ActionButton label="Trajets enregistres" badge={savedCount} onClick={onOpenSavedTrips}>
            <Route className="size-5" aria-hidden="true" />
          </ActionButton>
        </div>

        <div className="flex items-end gap-2">
          <ActionButton label="Ma position" onClick={onLocate}>
            <LocateFixed className="size-5" aria-hidden="true" />
          </ActionButton>
          <ActionButton label="Couches de la carte" onClick={() => setLayersOpen(true)}>
            <Layers className="size-5" aria-hidden="true" />
          </ActionButton>
          <ActionButton label="Autour de moi" onClick={() => setNearbyOpen(true)}>
            <Radar className="size-5" aria-hidden="true" />
          </ActionButton>
        </div>
      </div>

      <Drawer open={nearbyOpen} onOpenChange={setNearbyOpen}>
        <DrawerContent>
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle>Autour de moi</DrawerTitle>
            <DrawerDescription>
              Disponibilites en direct depuis {currentPosition ? 'ta position' : 'le centre de la metropole'}.
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
            <DrawerDescription>Ce qui apparait sur la carte.</DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-wrap gap-2 px-4 pb-6">
            <LayerPill
              active={layers.transitStops}
              onClick={() => onLayersChange({ ...layers, transitStops: !layers.transitStops })}
            >
              Arrets
            </LayerPill>
            <LayerPill active={layers.velov} onClick={() => onLayersChange({ ...layers, velov: !layers.velov })}>
              Velo&apos;v
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
