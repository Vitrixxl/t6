// Disposition courante : bureau ou mobile.
//
// Les deux dispositions ne sont pas deux habillages du meme arbre : chacune
// monte sa carte, ses panneaux, ses barres. Les rendre toutes les deux et n'en
// montrer qu'une par CSS faisait tourner deux instances MapLibre en permanence
// (deux contextes WebGL, deux fois les tuiles, deux fois les sources). On ne
// rend donc que celle qui s'affiche, et le point de bascule est le meme que
// celui des classes `lg:` de Tailwind.
import { useSyncExternalStore } from 'react';

const DESKTOP_QUERY = '(min-width: 1024px)';

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function readDesktop(): boolean {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

export function useDesktopLayout(): boolean {
  return useSyncExternalStore(subscribe, readDesktop, () => false);
}
