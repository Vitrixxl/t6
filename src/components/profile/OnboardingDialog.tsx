// Accueil d'un nouveau compte : deux questions avant la première recherche,
// ce dont l'utilisateur dispose et son besoin PMR. Le profil les garde, chaque
// recherche en part. Le dialogue ne se ferme qu'une fois répondu.
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { mobilityProfile, type MobilityProfile } from '../../contracts';
import { ArrowRight } from 'lucide-react';
import { AVAILABLE_MODES } from '../../contracts/primitives';
import { AVAILABLE_MODE_LABELS } from '../../lib/planner';
import { useProfile, useUpdateProfile } from '../../queries';
import type { AvailableMode } from '../../types';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { MODE_ICON } from '../app/shared';

export function OnboardingDialog() {
    const profile = useProfile();
    const updateProfile = useUpdateProfile();
    const form = useForm<MobilityProfile>({
        resolver: zodResolver(mobilityProfile),
        defaultValues: profile,
    });
    const modes = form.watch('availableModes');
    const accessibilityNeed = form.watch('accessibilityNeed');

    if (profile.onboardedAt !== null) return null;

    const toggleMode = (mode: AvailableMode) =>
        form.setValue('availableModes', AVAILABLE_MODES.filter((item) => item === mode ? !modes.includes(item) : modes.includes(item)));
    const onSubmit = form.handleSubmit((values) => {
        updateProfile.mutate({ ...values, onboardedAt: new Date().toISOString() });
    });

    return (
        <Dialog open>
            <DialogContent
                hideClose
                aria-describedby="onboarding-description"
                onEscapeKeyDown={(event) => event.preventDefault()}
                onInteractOutside={(event) => event.preventDefault()}
            >
                <form className="min-h-0 overflow-y-auto" onSubmit={onSubmit} noValidate>
                    <DialogHeader>
                        <DialogTitle>Bienvenue sur UrbanFlow</DialogTitle>
                        <DialogDescription id="onboarding-description">
                            Deux questions pour ne te proposer que des trajets que tu peux vraiment prendre.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 px-5 py-4">
                        <fieldset className="grid gap-2">
                            <legend className="text-sm font-medium">Qu’est-ce que tu peux utiliser ?</legend>
                            <div className="grid gap-2 sm:grid-cols-3">
                                {AVAILABLE_MODES.map((mode) => {
                                    const Icon = MODE_ICON[mode];
                                    const active = modes.includes(mode);
                                    return (
                                        <button
                                            key={mode}
                                            type="button"
                                            aria-pressed={active}
                                            className={`flex min-h-[44px] items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'}`}
                                            onClick={() => toggleMode(mode)}
                                        >
                                            <Icon className="size-4" aria-hidden="true" />
                                            {AVAILABLE_MODE_LABELS[mode]}
                                        </button>
                                    );
                                })}
                            </div>
                            <span className="text-xs font-normal text-muted-foreground">
                                Les déplacements à pied ou en fauteuil restent inclus. Tu pourras changer ces réglages dans ton profil, ou pour une seule recherche.
                            </span>
                        </fieldset>
                        <label className="flex min-h-[44px] items-center gap-3 text-sm font-medium">
                            <input type="checkbox" className="size-4 accent-primary" checked={accessibilityNeed} onChange={(event) => form.setValue('accessibilityNeed', event.target.checked)} />
                            Je suis en situation de mobilité réduite (PMR)
                        </label>
                        <p className="text-xs text-muted-foreground">En mode PMR, les accès utilisent le profil fauteuil et les transports doivent déclarer leur accessibilité. Vélo’v et Dott sont exclus.</p>
                    </div>
                    {updateProfile.error ? <p role="alert" className="px-5 pb-3 text-sm text-destructive">{updateProfile.error.message} Tu peux réessayer.</p> : null}
                    <DialogFooter>
                        <Button type="submit" disabled={updateProfile.isPending}>
                            Commencer
                            <ArrowRight className="size-4" aria-hidden="true" />
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
