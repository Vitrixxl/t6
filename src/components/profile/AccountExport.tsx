import { Download } from 'lucide-react';
import { useExportAccount } from '../../queries';
import { Button } from '../ui/button';

export function AccountExport() {
    const accountExport = useExportAccount();

    return (
        <div className="grid gap-2">
            <Button type="button" variant="outline" className="w-full justify-center"
                disabled={accountExport.isPending} onClick={() => accountExport.mutate()}>
                <Download className="size-4" aria-hidden="true" />
                {accountExport.isPending ? 'Export en cours…' : 'Exporter mes données'}
            </Button>
            <p className="text-xs leading-5 text-muted-foreground">
                Télécharge un fichier JSON contenant ton compte, tes préférences, tes trajets et leurs lieux, et ton historique carbone.
            </p>
            {accountExport.isError && (
                <p role="alert" className="text-xs text-destructive">
                    L’export a échoué. Vérifie ta connexion et réessaie. Si ta session a expiré, reconnecte-toi.
                </p>
            )}
            {accountExport.isSuccess && (
                <p role="status" className="text-xs text-muted-foreground">Téléchargement lancé : urbanflow-export.json.</p>
            )}
        </div>
    );
}
