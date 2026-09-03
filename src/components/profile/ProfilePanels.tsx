// Module profil : preferences de mobilite, objectifs carbone et compte.
import { FormEvent, useEffect, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Check, CircleHelp, LogOut, Trash2, UserRound } from 'lucide-react';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { Button } from '../ui/button';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '../ui/drawer';
import { Input } from '../ui/input';
import type { MobilityMode, MobilityProfile } from '../../types';
import { deleteAccountAtom, logoutAtom, setProfileAtom, userAtom } from '../../state';
import { MODE_ICON, MODE_OPTIONS } from '../app/shared';

export function ProfileDrawer({
  open,
  onOpenChange,
  onStartTutorial }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartTutorial: () => void;
}) {
  const user = useAtomValue(userAtom);
  const logout = useSetAtom(logoutAtom);
  const deleteAccount = useSetAtom(deleteAccountAtom);
  const [confirming, setConfirming] = useState<'logout' | 'delete' | null>(null);
  const onLogout = () => {
    onOpenChange(false);
    logout();
  };
  const onDeleteAccount = () => {
    onOpenChange(false);
    void deleteAccount();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto w-[calc(100%-1.5rem)] max-w-[1400px] overflow-hidden bg-[var(--shell)] p-0 sm:w-[calc(100%-3rem)]">
        <DrawerHeader className="items-center border-b border-border px-6 pb-4 pt-3 text-center sm:text-center">
          <DrawerTitle className="font-display">Profil et preferences</DrawerTitle>
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
                Preferences utilisees pour calculer les itineraires, filtrer les options PMR et suivre tes objectifs carbone.
              </p>
              <Button type="button" variant="outline" className="w-full justify-center" onClick={onStartTutorial}>
                <CircleHelp className="size-4" aria-hidden="true" />
                Revoir le tutoriel
              </Button>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" className="w-full justify-center" onClick={() => setConfirming('logout')}>
                  <LogOut className="size-4" aria-hidden="true" />
                  Deconnexion
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
        title="Se deconnecter ?"
        description="Tes trajets et tes preferences restent enregistres sur ton compte. Tu les retrouveras a la prochaine connexion."
        confirmLabel="Se deconnecter"
        onConfirm={onLogout}
      />

      <ConfirmDialog
        open={confirming === 'delete'}
        onOpenChange={(next) => setConfirming(next ? 'delete' : null)}
        title="Supprimer le compte ?"
        description="Le compte, les trajets, les routines et les itineraires enregistres sont effaces definitivement. Cette action est irreversible."
        confirmLabel="Supprimer le compte"
        destructive
        onConfirm={onDeleteAccount}
      />
    </Drawer>
  );
}

export function ProfilePanel() {
  const user = useAtomValue(userAtom);
  const onSave = useSetAtom(setProfileAtom);
  const [profile, setProfile] = useState<MobilityProfile>(user.profile);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setProfile(user.profile);
  }, [user]);

  const toggleMode = (mode: MobilityMode) => {
    setProfile((currentProfile) => ({
      ...currentProfile,
      preferredModes: currentProfile.preferredModes.includes(mode)
        ? currentProfile.preferredModes.filter((item) => item !== mode)
        : [...currentProfile.preferredModes, mode] }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(profile);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

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
      <form className="grid gap-3" onSubmit={handleSubmit}>
        <label className="grid gap-1.5 text-sm font-medium" htmlFor="profile-display-name">
          Nom affiche
          <Input
            id="profile-display-name"
            value={profile.displayName}
            onChange={(event) => setProfile({ ...profile, displayName: event.target.value })}
          />
        </label>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Modes preferes</legend>
          <div className="grid grid-cols-2 gap-2">
            {MODE_OPTIONS.map((option) => {
              const Icon = MODE_ICON[option.mode];
              const active = profile.preferredModes.includes(option.mode);
              return (
                <button
                  key={option.mode}
                  type="button"
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                    active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'
                  }`}
                  onClick={() => toggleMode(option.mode)}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>
        <label className="grid gap-1.5 text-sm font-medium">
          Marche max: {profile.maxWalkMinutes} min
          <input
            type="range"
            min="5"
            max="45"
            step="5"
            value={profile.maxWalkMinutes}
            onChange={(event) => setProfile({ ...profile, maxWalkMinutes: Number(event.target.value) })}
            className="accent-primary"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium" htmlFor="profile-route-preselection">
          Option retenue par defaut
          <select
            id="profile-route-preselection"
            value={profile.routePreselection ?? 'fastest'}
            onChange={(event) =>
              setProfile({ ...profile, routePreselection: event.target.value as MobilityProfile['routePreselection'] })
            }
            // Hauteur en pixels : la racine du document est a 14 px, une valeur
            // en rem raterait la cible tactile de 44 px.
            className="h-[44px] rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground"
          >
            <option value="fastest">Le plus rapide</option>
            {MODE_OPTIONS.map((option) => (
              <option key={option.mode} value={option.mode}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="text-xs font-normal text-muted-foreground">
            Toutes les options restent proposees : ce reglage ne decide que de celle qui s&apos;ouvre en premier. Si le
            mode choisi n&apos;existe pas sur un trajet, la plus rapide est retenue.
          </span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium" htmlFor="profile-carbon-goal">
          Budget carbone hebdomadaire (g)
          <Input
            id="profile-carbon-goal"
            type="number"
            min={250}
            max={20000}
            step={250}
            value={profile.carbonGoalGramsPerWeek}
            onChange={(event) => setProfile({ ...profile, carbonGoalGramsPerWeek: Number(event.target.value) })}
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={profile.accessibilityNeed}
            onChange={(event) => setProfile({ ...profile, accessibilityNeed: event.target.checked })}
            className="size-4 accent-primary"
          />
          Priorite PMR
        </label>
        <Button type="submit" size="sm">
          {saved ? <Check className="size-4" aria-hidden="true" /> : null}
          Enregistrer
        </Button>
      </form>
    </section>
  );
}
