// Le compte tel que les ecrans l'affichent : la session, avec le profil
// courant. Le nom affiche suit le profil des qu'il change.
import type { SessionUser } from '../types';
import { useRef } from 'react';
import { useProfile } from './profile';
import { useSession } from './session';

/**
 * Les ecrans du compte ne montent qu'avec une session. A la fermeture, React
 * Query peut publier la session nulle un rendu avant que React demonte cet
 * arbre : garder la derniere valeur du composant rend ce dernier rendu stable.
 */
export function useUser(): SessionUser {
  const { data: session } = useSession();
  const profile = useProfile();
  const lastSession = useRef(session);
  if (session) {
    lastSession.current = session;
  }
  if (!lastSession.current) {
    throw new Error('Aucune session ouverte.');
  }
  return { ...lastSession.current.user, displayName: profile.displayName, profile };
}
