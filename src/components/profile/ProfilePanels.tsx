// Module profil : préférences de mobilité, objectifs carbone et compte.
import { CarbonReference } from '../carbon/CarbonReference';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Check, CircleHelp, LogOut, Trash2, UserRound } from 'lucide-react';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { Button } from '../ui/button';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '../ui/drawer';
import { Input } from '../ui/input';
import type { MobilityMode, MobilityProfile } from '../../types';
import {
    DEFAULT_MONTHLY_SAVED_GOAL_GRAMS,
    DEFAULT_WEEKLY_SAVED_GOAL_GRAMS,
    DEFAULT_WEEKLY_TRIPS_GOAL,
    mobilityProfile,
} from '../../contracts';
import { useDeleteAccount, useLogout, useUpdateProfile, useUser } from '../../queries';
import { MODE_ICON, MODE_OPTIONS } from '../app/shared';

function FieldError({ message }: { message?: string }) {
    return message ? <p className="text-xs font-normal text-destructive">{message}</p> : null;
}

export function ProfileDrawer({
    open,
    onOpenChange,
    onStartTutorial }: {
        open: boolean;
        onOpenChange: (open: boolean) => void;
        onStartTutorial: () => void;
    }) {
    const user = useUser();
    const logout = useLogout();
    const deleteAccount = useDeleteAccount();
    const [confirming, setConfirming] = useState<'logout' | 'delete' | null>(null);
    const onLogout = () => {
        onOpenChange(false);
        logout();
    };
    const onDeleteAccount = () => {
        onOpenChange(false);
        deleteAccount.mutate();
    };

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="mx-auto w-[calc(100%-1.5rem)] max-w-[1400px] overflow-hidden bg-[var(--shell)] p-0 sm:w-[calc(100%-3rem)]">
                <DrawerHeader className="items-center border-b border-border px-6 pb-4 pt-3 text-center sm:text-center">
                    <DrawerTitle className="font-display">Profil et préférences</DrawerTitle>
                    <DrawerDescription className="truncate">{user.email}</DrawerDescription>
                </DrawerHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8">
                    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <section className="overflow-hidden rounded-xl border border-border bg-background">
                            <ProfilePanel />
                        </section>
                        <section className="grid content-start gap-3 rounded-xl border border-border bg-background p-4">
                            <div className="flex items-center gap-3">
                                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                                    <UserRound className="size-4" aria-hidden="true" />
                                </span>
                                <span className="min-w-0">
                                    <strong className="block truncate text-sm">{user.displayName}</strong>
                                    <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                                </span>
                            </div>
                            <p className="text-xs leading-5 text-muted-foreground">
                                Préférences utilisées pour calculer les itinéraires, filtrer les options PMR et suivre tes objectifs carbone.
                            </p>
                            <Button type="button" variant="outline" className="w-full justify-center" onClick={onStartTutorial}>
                                <CircleHelp className="size-4" aria-hidden="true" />
                                Revoir le tutoriel
                            </Button>
                            <div className="grid gap-2 sm:grid-cols-2">
                                <Button type="button" variant="outline" className="w-full justify-center" onClick={() => setConfirming('logout')}>
                                    <LogOut className="size-4" aria-hidden="true" />
                                    Déconnexion
                                </Button>
                                <Button type="button" variant="destructive" className="w-full justify-center" onClick={() => setConfirming('delete')}>
                                    <Trash2 className="size-4" aria-hidden="true" />
                                    Supprimer le compte
                                </Button>
                            </div>
                        </section>
                    </div>
                </div>
                <DrawerFooter className="mx-auto w-full max-w-5xl border-t border-border px-5 py-4">
                    <DrawerClose asChild>
                        <Button type="button" className="w-full justify-center bg-foreground text-background hover:bg-foreground/90">
                            Fermer
                        </Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
            <ConfirmDialog
                open={confirming === 'logout'}
                onOpenChange={(next) => setConfirming(next ? 'logout' : null)}
                title="Se déconnecter ?"
                description="Tes trajets et tes préférences restent enregistrés sur ton compte. Tu les retrouveras à la prochaine connexion."
                confirmLabel="Se déconnecter"
                onConfirm={onLogout}
            />

            <ConfirmDialog
                open={confirming === 'delete'}
                onOpenChange={(next) => setConfirming(next ? 'delete' : null)}
                title="Supprimer le compte ?"
                description="Le compte, les trajets, les routines et les itinéraires enregistrés sont effaces definitivement. Cette action est irreversible."
                confirmLabel="Supprimer le compte"
                destructive
                onConfirm={onDeleteAccount}
            />
        </Drawer>
    );
}

export function ProfilePanel() {
    const user = useUser();
    const updateProfile = useUpdateProfile();
    // Le formulaire valide avec le contrat que l'API applique : ce qui passe ici
    // n'est jamais refusé à l'envoi. `values` le rattache au profil courant.
    const form = useForm<MobilityProfile>({
        resolver: zodResolver(mobilityProfile),
        values: {
            ...user.profile,
            weeklyTripsGoal: user.profile.weeklyTripsGoal ?? DEFAULT_WEEKLY_TRIPS_GOAL,
            weeklySavedGoalGrams: user.profile.weeklySavedGoalGrams ?? DEFAULT_WEEKLY_SAVED_GOAL_GRAMS,
            monthlySavedGoalGrams: user.profile.monthlySavedGoalGrams ?? DEFAULT_MONTHLY_SAVED_GOAL_GRAMS,
        },
    });
    const { errors } = form.formState;
    const preferredModes = form.watch('preferredModes');
    const [saved, setSaved] = useState(false);

    const toggleMode = (mode: MobilityMode) => {
        const next = preferredModes.includes(mode) ? preferredModes.filter((item) => item !== mode) : [...preferredModes, mode];
        form.setValue('preferredModes', next, { shouldValidate: form.formState.isSubmitted, shouldDirty: true });
    };

    const onSubmit = form.handleSubmit((profile) => {
        updateProfile(profile);
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1600);
    });

    return (
        <section className="p-4">
            <div className="mb-3 flex items-center gap-2">
                <div className="grid size-8 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                    <UserRound className="size-4" aria-hidden="true" />
                </div>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Profil</p>
                    <h2 className="font-semibold">{user.displayName}</h2>
                </div>
            </div>
            <form className="grid gap-3" noValidate onSubmit={onSubmit}>
                <label className="grid gap-1.5 text-sm font-medium" htmlFor="profile-display-name">
                    Nom affiché
                    <Input id="profile-display-name" aria-invalid={Boolean(errors.displayName)} {...form.register('displayName')} />
                    <FieldError message={errors.displayName?.message} />
                </label>
                <fieldset className="grid gap-2">
                    <legend className="text-sm font-medium">Modes préférés</legend>
                    <div className="grid grid-cols-2 gap-2">
                        {MODE_OPTIONS.map((option) => {
                            const Icon = MODE_ICON[option.mode];
                            const active = preferredModes.includes(option.mode);
                            return (
                                <button
                                    key={option.mode}
                                    type="button"
                                    aria-pressed={active}
                                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'
                                        }`}
                                    onClick={() => toggleMode(option.mode)}
                                >
                                    <Icon className="size-4" aria-hidden="true" />
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                    <FieldError message={errors.preferredModes?.message} />
                </fieldset>
                <label className="grid gap-1.5 text-sm font-medium" htmlFor="profile-route-preselection">
                    Option retenue par défaut
                    <select
                        id="profile-route-preselection"
                        // Hauteur en pixels : la racine du document est à 14 px, une valeur
                        // en rem raterait la cible tactile de 44 px.
                        className="h-[44px] rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground"
                        {...form.register('routePreselection')}
                    >
                        <option value="fastest">Le plus rapide</option>
                        {MODE_OPTIONS.map((option) => (
                            <option key={option.mode} value={option.mode}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <span className="text-xs font-normal text-muted-foreground">
                        Toutes les options restent proposées : ce réglage ne décide que de celle qui s&apos;ouvre en premier. Si le
                        mode choisi n&apos;existe pas sur un trajet, la plus rapide est retenue.
                    </span>
                </label>
                <label className="grid gap-1.5 text-sm font-medium" htmlFor="profile-carbon-goal">
                    Maximum carbone hebdomadaire (gCO₂e)
                    <Input
                        id="profile-carbon-goal"
                        type="number"
                        min={250}
                        max={20000}
                        step={250}
                        aria-invalid={Boolean(errors.carbonGoalGramsPerWeek)}
                        {...form.register('carbonGoalGramsPerWeek', { valueAsNumber: true })}
                    />
                    <FieldError message={errors.carbonGoalGramsPerWeek?.message} />
                    <span className="text-xs font-normal text-muted-foreground">Ton plafond personnel d’émissions pour les trajets suivis. Consulte la dépense et le reste disponible dans le suivi des trajets.</span>
                </label>
                <CarbonReference />
                <fieldset className="grid gap-3 rounded-xl border border-border bg-muted/30 p-3">
                    <legend className="px-1 text-sm font-semibold">Objectifs d&apos;économie de CO₂e</legend>
                    <p className="text-xs leading-5 text-muted-foreground">
                        Ces deux objectifs sont indépendants du budget carbone et servent à mesurer les émissions évitées par tes trajets.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1.5 text-sm font-medium" htmlFor="profile-weekly-saved-goal">
                            Par semaine (gCO₂e)
                            <Input
                                id="profile-weekly-saved-goal"
                                type="number"
                                min={100}
                                max={50000}
                                step={100}
                                aria-invalid={Boolean(errors.weeklySavedGoalGrams)}
                                {...form.register('weeklySavedGoalGrams', { valueAsNumber: true })}
                            />
                            <FieldError message={errors.weeklySavedGoalGrams?.message} />
                        </label>
                        <label className="grid gap-1.5 text-sm font-medium" htmlFor="profile-monthly-saved-goal">
                            Par mois (gCO₂e)
                            <Input
                                id="profile-monthly-saved-goal"
                                type="number"
                                min={100}
                                max={200000}
                                step={100}
                                aria-invalid={Boolean(errors.monthlySavedGoalGrams)}
                                {...form.register('monthlySavedGoalGrams', { valueAsNumber: true })}
                            />
                            <FieldError message={errors.monthlySavedGoalGrams?.message} />
                        </label>
                    </div>
                </fieldset>
                <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" className="size-4 accent-primary" {...form.register('accessibilityNeed')} />
                    Priorité PMR
                </label>
                <Button type="submit" size="sm">
                    {saved ? <Check className="size-4" aria-hidden="true" /> : null}
                    Enregistrer
                </Button>
            </form>
        </section>
    );
}
