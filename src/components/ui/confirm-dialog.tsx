// Dialogue de confirmation pour les actions sans retour en arriere.
//
// Les actions partagent la même forme, mais pas les mêmes conséquences :
// le libellé du bouton d’action dit ce qui va se passer
// ("Supprimer le compte"), jamais "Oui" ou "Confirmer", pour qu'un utilisateur
// qui ne lit que le bouton comprenne quand même ce qu'il déclenche.
import { Button } from './button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './dialog';

export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel,
    destructive = false,
    onConfirm,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: () => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm" onEscapeKeyDown={(event) => {
                // Échap ferme la confirmation sans fermer le dialogue parent.
                event.preventDefault();
                event.stopPropagation();
                onOpenChange(false);
            }}>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-2">
                    <DialogClose asChild>
                        <Button type="button" variant="outline" className="w-full justify-center sm:w-auto">
                            Annuler
                        </Button>
                    </DialogClose>
                    <Button
                        type="button"
                        variant={destructive ? 'destructive' : 'default'}
                        className="w-full justify-center sm:w-auto"
                        onClick={() => {
                            onOpenChange(false);
                            onConfirm();
                        }}
                    >
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
