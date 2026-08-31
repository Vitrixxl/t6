// Actions flottantes de l'ecran mobile.
//
// La carte est l'ecran principal : rien ne la recouvre tant que l'utilisateur
// ne le demande pas. Les donnees du reseau et les reglages de couches vivent
// donc derriere des boutons flottants, dans des tiroirs ouverts a la demande,
// plutot que dans un panneau impose au chargement.
//
// Seules les options d'itineraire s'affichent d'elles-memes, parce qu'elles
// repondent a une action que l'utilisateur vient de faire.
import { useState } from 'react';
import { Layers, LocateFixed, Radar } from 'lucide-react';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '../ui/drawer';
import { LayerPill, MODE_ICON, MODE_OPTIONS, type LayerState } from '../app/shared';
import type { CarbonSummary, GeoPoint, MobilityMode, PlannedTrip, TransportNetwork } from '../../types';
import { MobileHomePanel } from './MobileHomePanel';

function FloatingButton({
  label,
  badge,
  active,
  onClick,
  children,
}: {
  label: string;
  badge?: number;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      // 44 px de cote : cible tactile minimale recommandee par le WCAG 2.5.5.
      className={`pointer-events-auto relative grid size-11 place-items-center rounded-full border shadow-float backdrop-blur-xl transition-colors ${
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-white/80 bg-white/95 text-foreground'
      }`}
    >
      {children}
      {badge && badge > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-white">
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
  enabledModes,
  routingApiStatus,
  onLayersChange,
  onToggleMode,
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
  enabledModes: MobilityMode[];
  routingApiStatus: string;
  onLayersChange: (layers: LayerState) => void;
  onToggleMode: (mode: MobilityMode) => void;
  onOpenHub: () => void;
  onLocate: () => void;
}) {
  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const incidentCount = network.gtfs.incidents.length;

  return (
    <>
      <div className="pointer-events-none absolute right-3 top-[calc(env(safe-area-inset-top)+7.25rem)] z-40 flex flex-col gap-2">
        <FloatingButton label="Centrer sur ma position" active={Boolean(currentPosition)} onClick={onLocate}>
          <LocateFixed className="size-5" aria-hidden="true" />
        </FloatingButton>
        <FloatingButton
          label="Voir ce qui est autour de moi"
          badge={incidentCount}
          onClick={() => setNearbyOpen(true)}
        >
          <Radar className="size-5" aria-hidden="true" />
        </FloatingButton>
        <FloatingButton label="Choisir les couches affichees" onClick={() => setLayersOpen(true)}>
          <Layers className="size-5" aria-hidden="true" />
        </FloatingButton>
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
            <DrawerTitle>Couches et modes</DrawerTitle>
            <DrawerDescription>Ce qui apparait sur la carte et les modes retenus au calcul.</DrawerDescription>
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
              <LayerPill
                active={layers.incidents}
                onClick={() => onLayersChange({ ...layers, incidents: !layers.incidents })}
              >
                Incidents
              </LayerPill>
            </section>

            <section aria-label="Modes de deplacement" className="flex flex-col gap-2">
              <h3 className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Modes pris en compte
              </h3>
              <div className="flex flex-wrap gap-2">
                {MODE_OPTIONS.map(({ mode, label }) => {
                  const Icon = MODE_ICON[mode];
                  const active = enabledModes.includes(mode);
                  return (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onToggleMode(mode)}
                      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-muted-foreground'
                      }`}
                    >
                      <Icon className="size-3.5" aria-hidden="true" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </section>

            <p className="text-[0.7rem] text-muted-foreground">Routage : {routingApiStatus}</p>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
