// Barre d'actions flottante de l'ecran mobile.
//
// La carte est l'ecran principal : rien ne la recouvre tant que l'utilisateur
// ne le demande pas. Les donnees du reseau et les reglages de couches vivent
// donc derriere des boutons, dans des tiroirs ouverts a la demande.
//
// La barre est en bas, dans la zone que le pouce atteint sans changer de prise
// sur le telephone. Chaque bouton porte la couleur de ce qu'il ouvre : le vert
// de la marque pour l'action de carte, le lime des Velo'v pour les
// disponibilites, le bleu des arrets pour les couches. La couleur code une
// information, elle ne decore pas.
//
// Seules les options d'itineraire s'affichent d'elles-memes, parce qu'elles
// repondent a une action que l'utilisateur vient de faire.
import { useState } from 'react';
import { Layers, LocateFixed, Radar } from 'lucide-react';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '../ui/drawer';
import { LayerPill, type LayerState } from '../app/shared';
import type { CarbonSummary, GeoPoint, PlannedTrip, TransportNetwork } from '../../types';
import { MobileHomePanel } from './MobileHomePanel';
import { ROUTING_STATUS_LABEL, type RoutingStatus } from '../app/hooks/useRouteOptions';

function ActionButton({
  label,
  badge,
  tone,
  onClick,
  children,
}: {
  label: string;
  badge?: number;
  tone: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // Hauteur en pixels, pas en rem : la racine du document est a 14px, une
      // valeur en rem donnerait 42 px et raterait la cible de 44 px.
      className={`pointer-events-auto relative inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl px-3 text-[0.8rem] font-bold shadow-float transition-transform active:scale-[0.97] ${tone}`}
    >
      {children}
      <span className="truncate">{label}</span>
      {badge && badge > 0 ? (
        <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-destructive px-1 text-[10px] font-bold leading-none text-white">
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
  upcomingTrip,
  carbonSummary,
  weeklyGoalGrams,
  layers,
  routingStatus,
  onLayersChange,
  onOpenHub,
  onLocate,
}: {
  network: TransportNetwork;
  currentPosition: GeoPoint | null;
  origin: GeoPoint | null;
  upcomingTrip: PlannedTrip | null;
  carbonSummary: CarbonSummary;
  weeklyGoalGrams: number;
  layers: LayerState;
  routingStatus: RoutingStatus;
  onLayersChange: (layers: LayerState) => void;
  onOpenHub: () => void;
  onLocate: () => void;
}) {
  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex items-stretch gap-2 px-3 pb-[calc(env(safe-area-inset-bottom)+0.85rem)]">
        <ActionButton label="Ma position" tone="bg-primary text-primary-foreground" onClick={onLocate}>
          <LocateFixed className="size-4 shrink-0" aria-hidden="true" />
        </ActionButton>
        <ActionButton
          label="Autour de moi"
          tone="bg-[var(--lime)] text-[oklch(0.3_0.06_145)]"
          onClick={() => setNearbyOpen(true)}
        >
          <Radar className="size-4 shrink-0" aria-hidden="true" />
        </ActionButton>
        <ActionButton label="Couches" tone="bg-[#1d4ed8] text-white" onClick={() => setLayersOpen(true)}>
          <Layers className="size-4 shrink-0" aria-hidden="true" />
        </ActionButton>
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
              upcomingTrip={upcomingTrip}
              carbonSummary={carbonSummary}
              weeklyGoalGrams={weeklyGoalGrams}
              onOpenHub={() => {
                setNearbyOpen(false);
                onOpenHub();
              }}
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
          <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <section aria-label="Couches de la carte" className="flex flex-wrap gap-2">
              <LayerPill
                active={layers.transitStops}
                onClick={() => onLayersChange({ ...layers, transitStops: !layers.transitStops })}
              >
                Arrets
              </LayerPill>
              <LayerPill active={layers.velov} onClick={() => onLayersChange({ ...layers, velov: !layers.velov })}>
                Velo&apos;v
              </LayerPill>
              <LayerPill
                active={layers.scooters}
                onClick={() => onLayersChange({ ...layers, scooters: !layers.scooters })}
              >
                Trottinettes
              </LayerPill>
            </section>


            <p className="text-[0.7rem] text-muted-foreground">Routage : {ROUTING_STATUS_LABEL[routingStatus]}</p>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
