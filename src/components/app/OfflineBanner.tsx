import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from './hooks/useOnlineStatus';

export function OfflineBanner() {
    const online = useOnlineStatus();

    return (
        <div role="status" aria-live="polite" aria-atomic="true" className="relative z-[100] shrink-0">
            {!online ? (
                <div className="flex items-start justify-center gap-3 border-b border-amber-300 bg-amber-50 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-sm leading-5 text-amber-950">
                    <WifiOff className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                    <p className="max-w-5xl">
                        <strong>Vous êtes hors ligne.</strong>{' '}
                        Une connexion Internet est nécessaire pour rechercher des itinéraires et enregistrer vos modifications.{' '}
                        Les informations déjà affichées peuvent être périmées.
                    </p>
                </div>
            ) : null}
        </div>
    );
}
