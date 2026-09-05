// Module layout desktop : barre laterale (planificateur, calques).
import { CalendarClock, CircleHelp, Layers3, Navigation, UserRound } from 'lucide-react';
import { Button } from '../ui/button';
import type { TransportContext } from '../../types';
import { useUser } from '../../queries';
import { LayerToggle, type LayerState } from '../app/shared';
import { TripsSidebarSection } from '../planner/trips';
import { getFeedFreshness } from '../../lib/transport';

function SidebarSectionHeader({
    id,
    index,
    icon,
    title,
    subtitle,
}: {
    id: string;
    index: number;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
}) {
    return (
        <header className="flex min-h-12 items-center gap-2.5 px-4 py-2.5">
            {icon}
            <span className="text-[11px] font-medium tabular-nums text-muted-foreground">{index}</span>
            <div className="min-w-0">
                <h2 id={id} className="text-[13px] font-semibold tracking-normal">
                    {title}
                </h2>
                <p className="truncate text-[10px] font-medium text-muted-foreground">{subtitle}</p>
            </div>
        </header>
    );
}

export function ShellSidebar({
    layers,
    onLayersChange,
    network,
    onOpenProfile,
    onStartTutorial }: {
        layers: LayerState;
        onLayersChange: (layers: LayerState) => void;
        network: TransportContext;
        onOpenProfile: () => void;
        onStartTutorial: () => void;
    }) {
    const user = useUser();

    return (
        <div className="flex h-full flex-col overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 pb-1 pt-3">
                <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
                    <Navigation className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 leading-tight">
                    <p className="font-display text-[15px] font-semibold tracking-tight">UrbanFlow</p>
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Planificateur de mobilité</p>
                </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-3 pt-2">
                <section className="border-b border-border/70" aria-labelledby="sidebar-trips-title" data-tour="trips">
                    <SidebarSectionHeader
                        id="sidebar-trips-title"
                        index={1}
                        icon={<CalendarClock className="size-4 shrink-0 text-primary" aria-hidden="true" />}
                        title="Mes trajets"
                        subtitle="À venir, récurrents et objectifs"
                    />
                    <TripsSidebarSection />
                </section>
                <section aria-labelledby="sidebar-layers-title" data-tour="layers">
                    <SidebarSectionHeader
                        id="sidebar-layers-title"
                        index={2}
                        icon={<Layers3 className="size-4 shrink-0 text-primary" aria-hidden="true" />}
                        title="Couches"
                        subtitle="Mobilité temps réel"
                    />
                    <LayerPanel layers={layers} onLayersChange={onLayersChange} network={network} />
                </section>
            </div>
            <div className="flex shrink-0 gap-2 px-3 pb-3">
                <Button
                    type="button"
                    variant="outline"
                    className="h-12 min-w-0 flex-1 justify-start rounded-xl"
                    onClick={onOpenProfile}
                    aria-label="Ouvrir le profil"
                    data-tour="profile"
                >
                    <UserRound className="size-4" aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-[13px]">Profil</span>
                        <span className="block truncate text-[10px] font-medium text-muted-foreground">{user.displayName}</span>
                    </span>
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-xl text-muted-foreground"
                    onClick={onStartTutorial}
                    aria-label="Revoir le tutoriel"
                    title="Revoir le tutoriel"
                >
                    <CircleHelp className="size-4" aria-hidden="true" />
                </Button>
            </div>
        </div>
    );
}

export function LayerPanel({
    layers,
    onLayersChange,
    network }: {
        layers: LayerState;
        onLayersChange: (layers: LayerState) => void;
        network: TransportContext;
    }) {
    const stations = network.sharedMobility?.data.stations ?? [];
    // Vélo'v est un service à stations : on compte les stations et les vélos qui
    // s'y trouvent. Dott est en flotte libre : chaque trottinette est un point,
    // il n'y a pas de station à compter. Les deux ne se résument donc pas de la
    // même facon, et les mélanger sous un seul libellé rendait le chiffre faux.
    const velovStations = stations.filter((station) => station.kind === 'velov');
    const scooters = stations.filter((station) => station.kind === 'scooter');
    const bikeCount = velovStations.reduce((sum, station) => sum + station.bikes_available, 0);
    const scooterCount = scooters.reduce((sum, station) => sum + station.scooters_available, 0);

    return (
        <div className="px-3 pb-4">
            <div className="grid gap-3">
                <LayerToggle
                    label="Arrêts GTFS"
                    detail={`${network.stopCount} arrêts publics`}
                    active={layers.transitStops}
                    color="bg-[#2563eb]"
                    onClick={() => onLayersChange({ ...layers, transitStops: !layers.transitStops })}
                />
                <LayerToggle
                    label="Vélo’v"
                    detail={network.sharedMobility ? `${bikeCount} vélos dans ${velovStations.length} stations` : "Données indisponibles"}
                    active={layers.velov}
                    color="bg-[#84cc16]"
                    onClick={() => onLayersChange({ ...layers, velov: !layers.velov })}
                />
                <LayerToggle
                    label="Trottinettes"
                    detail={network.sharedMobility ? `${scooterCount} trottinettes en flotte libre` : "Données indisponibles"}
                    active={layers.scooters}
                    color="bg-[#f97316]"
                    onClick={() => onLayersChange({ ...layers, scooters: !layers.scooters })}
                />
            </div>
            {network.sharedMobility ? (
                <div className="mt-4 rounded-lg border border-primary/25 bg-accent px-3 py-2 text-xs text-accent-foreground">
                    Données live: GBFS Vélo'v + Dott ({getFeedFreshness(network.sharedMobility)})
                    {network.sources?.gtfs === 'tcl-odbl' ? ', GTFS TCL (ODbL)' : ''}
                    {network.sources?.weather === 'open-meteo' ? ', météo Open-Meteo' : ''}.
                </div>
            ) : (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Impossible de récupérer les disponibilités Vélo’v et Dott.
                </div>
            )}
        </div>
    );
}
