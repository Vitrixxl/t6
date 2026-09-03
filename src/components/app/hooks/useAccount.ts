// Etat du compte en memoire, et son envoi au serveur.
//
// Le serveur est la seule source de verite. L'etat est recu a la connexion,
// modifie en memoire a chaque action, et renvoye en entier. Les envois sont
// serialises : chacun part avec l'etat le plus recent au moment ou il part,
// donc une rafale d'actions ne produit jamais un etat ancien qui ecraserait
// un plus recent. Une ecriture refusee est signalee, pas masquee.
import { useCallback, useMemo, useRef, useState } from 'react';
import type { MobilityProfile, SessionUser } from '../../../types';
import { saveAccountState, type AccountState, type Session } from '../../../lib/api/account';

export interface Account {
  /** Compte, avec le profil courant : ce que les ecrans affichent. */
  user: SessionUser;
  state: AccountState;
  /** Dernier envoi refuse, ou chaine vide. */
  saveError: string;
  update: (updater: (state: AccountState) => AccountState) => void;
  setProfile: (profile: MobilityProfile) => void;
}

export function useAccount(session: Session): Account {
  const [state, setState] = useState(session.state);
  const [saveError, setSaveError] = useState('');
  const latest = useRef(session.state);
  const queue = useRef(Promise.resolve());

  const update = useCallback((updater: (state: AccountState) => AccountState) => {
    const next = updater(latest.current);
    latest.current = next;
    setState(next);
    queue.current = queue.current
      .then(() => saveAccountState(latest.current))
      .then(
        () => setSaveError(''),
        (error: unknown) => setSaveError(error instanceof Error ? error.message : 'Enregistrement impossible.'),
      );
  }, []);

  const setProfile = useCallback((profile: MobilityProfile) => update((current) => ({ ...current, profile })), [update]);

  const user = useMemo<SessionUser>(
    () => ({ ...session.user, displayName: state.profile.displayName, profile: state.profile }),
    [session.user, state.profile],
  );

  return { user, state, saveError, update, setProfile };
}
