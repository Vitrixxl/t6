// Tour guide de premiere visite (meme mecanique spotlight qu'Urbaninator) :
// overlay plein ecran qui assombrit l'app et decoupe un "spotlight" autour de
// l'element cible via box-shadow 100vmax. Les cibles sont declarees par des
// attributs data-tour poses sur le shell ; une etape dont la cible est absente
// (ex: layout mobile vs desktop) est sautee automatiquement. Skippable a tout
// moment (Passer, croix, Echap), relancable via le bouton "?".
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { Button } from '../ui/button';

export const TUTORIAL_DONE_KEY = 'ufm.tutorialDone.v1';

interface TourStep {
  id: string;
  /** Attribut data-tour cible ; absent → carte centree sans spotlight. */
  target?: string;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Bienvenue sur UrbanFlow',
    body: "Ton planificateur de mobilite urbaine : compare les options d'itineraire bas carbone, planifie tes deplacements, automatise tes routines et suis tes objectifs. Ce tour rapide te montre l'essentiel — quitte-le a tout moment avec « Passer » ou Echap.",
  },
  {
    id: 'search',
    target: 'search',
    title: 'Recherche depart / arrivee',
    body: "Saisis une adresse : les suggestions viennent du geocodeur national (BAN). « Ma position » utilise le GPS comme point de depart. Des que les deux champs sont remplis, les options d'itineraire se calculent automatiquement.",
  },
  {
    id: 'map',
    target: 'map',
    title: 'La carte',
    body: "Les itineraires calcules s'affichent avec une couleur par option, l'option selectionnee en trait epais. En fond : arrets de transport public et stations de velos/trottinettes en temps reel.",
  },
  {
    id: 'routes',
    target: 'routes',
    title: "Comparer les options",
    body: "Chaque option affiche sa duree, sa distance et son empreinte en gCO₂e. La comparaison utilise le meme trajet voiture invisible pour toutes les options. Clique une option pour voir son detail.",
  },
  {
    id: 'route-detail',
    target: 'route-detail',
    title: 'Detail et actions',
    body: "Le detail d'une option liste chaque etape (marche, velo, transport...). Deux actions cles : « Planifier » pour dater le trajet ou en faire une routine, « Enregistrer » pour le garder sous la main.",
  },
  {
    id: 'trips',
    target: 'trips',
    title: 'Mes trajets — le planificateur',
    body: "Le coeur de l'application : tes trajets a venir (a marquer « Fait » ou a annuler), tes routines recurrentes (ex: aller-retour au travail, mise en pause possible), ton historique et tes itineraires enregistres.",
  },
  {
    id: 'goals',
    target: 'trips',
    title: 'Objectifs et progression',
    body: "Dans le planificateur, fixe tes objectifs hebdomadaires et mensuels de CO₂e evite puis suis leur progression. Chaque trajet marque « Fait » alimente tes statistiques.",
  },
  {
    id: 'layers',
    target: 'layers',
    title: 'Couches temps reel',
    body: "Active ou masque les arrets GTFS et les velos et trottinettes partages (flux GBFS live). La meteo temps reel influence aussi le score des options velo.",
  },
  {
    id: 'carbon',
    target: 'carbon',
    title: 'Suivi carbone',
    body: "Ton budget carbone hebdomadaire et le CO₂e evite par rapport a une reference voiture mesuree, alimentes par les trajets faits. Les objectifs se reglent dans ton profil.",
  },
  {
    id: 'profile',
    target: 'profile',
    title: 'Profil et preferences',
    body: "Modes preferes, marche maximale, priorite PMR, budget carbone : tout influence directement le calcul et le score des itineraires.",
  },
  {
    id: 'done',
    title: "C'est tout !",
    body: "Tu sais tout. Tu peux revoir ce tutoriel a tout moment via le bouton « ? » en bas du panneau lateral ou depuis ton profil. Bonne planification !",
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const CARD_WIDTH = 330;
const MARGIN = 16;

function resolveTarget(name: string): Element | null {
  // Plusieurs elements peuvent porter le meme data-tour (desktop + mobile) :
  // on prend le premier reellement visible.
  const candidates = document.querySelectorAll(`[data-tour="${name}"]`);
  for (const el of candidates) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return el;
    }
  }
  return null;
}

function stepAvailable(step: TourStep): boolean {
  return !step.target || resolveTarget(step.target) !== null;
}

function nextVisibleStep(from: number, dir: 1 | -1): number {
  let i = from + dir;
  while (i > 0 && i < STEPS.length - 1 && !stepAvailable(STEPS[i])) {
    i += dir;
  }
  return Math.min(Math.max(i, 0), STEPS.length - 1);
}

function sameRect(a: Rect | null, b: Rect | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

function clampToViewport(r: Rect): Rect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.max(r.left, 0);
  const top = Math.max(r.top, 0);
  return {
    left,
    top,
    width: Math.max(0, Math.min(r.left + r.width, vw) - left),
    height: Math.max(0, Math.min(r.top + r.height, vh) - top),
  };
}

// Position de la carte d'explication : droite → gauche → dessous → dessus.
function cardPosition(rect: Rect | null, cardH: number): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!rect || rect.width > vw * 0.6) {
    const cx = rect ? rect.left + rect.width / 2 : vw / 2;
    const cy = rect ? rect.top + rect.height / 2 : vh / 2;
    return { left: Math.min(Math.max(cx, CARD_WIDTH / 2 + MARGIN), vw - CARD_WIDTH / 2 - MARGIN), top: cy, transform: 'translate(-50%, -50%)' };
  }

  const clampTop = (t: number) => Math.min(Math.max(t, MARGIN), Math.max(MARGIN, vh - cardH - MARGIN));
  const clampLeft = (l: number) => Math.min(Math.max(l, MARGIN), Math.max(MARGIN, vw - CARD_WIDTH - MARGIN));
  const anchorTop = rect.height > vh * 0.8 ? rect.top + rect.height / 2 - cardH / 2 : rect.top;

  const right = rect.left + rect.width + MARGIN;
  if (right + CARD_WIDTH + MARGIN <= vw) {
    return { left: right, top: clampTop(anchorTop) };
  }
  const left = rect.left - MARGIN - CARD_WIDTH;
  if (left >= MARGIN) {
    return { left, top: clampTop(anchorTop) };
  }
  const below = rect.top + rect.height + MARGIN;
  if (below + cardH + MARGIN <= vh) {
    return { left: clampLeft(rect.left), top: below };
  }
  return { left: clampLeft(rect.left), top: clampTop(rect.top - MARGIN - cardH) };
}

export function TutorialOverlay({ relaunchSignal = 0 }: { relaunchSignal?: number }) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(220);

  const finish = () => {
    try {
      window.localStorage.setItem(TUTORIAL_DONE_KEY, String(Date.now()));
    } catch {
      // stockage indisponible: le tour se reproposera
    }
    setActive(false);
  };

  // Lancement auto a la premiere visite.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(TUTORIAL_DONE_KEY)) {
        return;
      }
    } catch {
      return;
    }
    const timeout = window.setTimeout(() => {
      setStep(0);
      setActive(true);
    }, 900);
    return () => window.clearTimeout(timeout);
  }, []);

  // Relance manuelle (bouton "?").
  useEffect(() => {
    if (relaunchSignal > 0) {
      setStep(0);
      setActive(true);
    }
  }, [relaunchSignal]);

  // Suivi du rect cible en continu : les panneaux s'ouvrent avec des
  // animations, un simple resize listener raterait le mouvement. Interval
  // plutot que requestAnimationFrame, qui peut etre suspendu (onglet cache,
  // webviews embarquees) et figerait le spotlight.
  useEffect(() => {
    if (!active) {
      return;
    }
    const tick = () => {
      const target = STEPS[step]?.target;
      let nextRect: Rect | null = null;
      if (target) {
        const el = resolveTarget(target);
        if (el) {
          const r = el.getBoundingClientRect();
          nextRect = clampToViewport({ top: r.top, left: r.left, width: r.width, height: r.height });
        }
      }
      setRect((prevRect) => (sameRect(prevRect, nextRect) ? prevRect : nextRect));
    };
    tick();
    const interval = window.setInterval(tick, 120);
    return () => window.clearInterval(interval);
  }, [active, step]);

  useLayoutEffect(() => {
    if (!active) {
      return;
    }
    const height = cardRef.current?.offsetHeight;
    if (height) {
      setCardH((prev) => (Math.abs(height - prev) > 1 ? height : prev));
    }
  }, [active, step, rect]);

  // Clavier : Echap = passer, fleches / Entree = navigation.
  useEffect(() => {
    if (!active) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        finish();
      } else if (event.key === 'ArrowRight' || event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        setStep((current) => {
          if (current === STEPS.length - 1) {
            finish();
            return current;
          }
          return nextVisibleStep(current, 1);
        });
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        event.stopPropagation();
        setStep((current) => (current > 0 ? nextVisibleStep(current, -1) : current));
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [active]);

  if (!active) {
    return null;
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const spotlight = current.target ? rect : null;
  const onNext = () => {
    if (isLast) {
      finish();
    } else {
      setStep(nextVisibleStep(step, 1));
    }
  };

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Tutoriel UrbanFlow">
      {/* Spotlight : trou transparent, assombrissement autour via box-shadow 100vmax. */}
      <div
        className="absolute rounded-2xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={
          spotlight
            ? {
                top: spotlight.top - 4,
                left: spotlight.left - 4,
                width: spotlight.width + 8,
                height: spotlight.height + 8,
                boxShadow:
                  'inset 0 0 0 2px color-mix(in srgb, var(--lime) 80%, transparent), 0 0 0 100vmax rgba(16, 24, 20, 0.58)',
              }
            : {
                top: '50%',
                left: '50%',
                width: 0,
                height: 0,
                boxShadow: '0 0 0 100vmax rgba(16, 24, 20, 0.58)',
              }
        }
      />

      <div
        key={current.id}
        ref={cardRef}
        className="absolute animate-in fade-in-0 zoom-in-95 rounded-2xl border border-border bg-background shadow-float duration-200"
        style={{ width: CARD_WIDTH, ...cardPosition(spotlight, cardH) }}
      >
        <div className="flex items-center gap-2 px-4 pt-3.5">
          <span className="text-[9px] tabular-nums text-muted-foreground">
            {String(step + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
          </span>
          <span className="h-px flex-1 bg-border/70" aria-hidden="true" />
          <Button
            type="button"
            variant="ghost"
            size="compactIcon"
            className="h-6 w-6 text-muted-foreground"
            onClick={finish}
            aria-label="Passer le tutoriel"
            title="Passer le tutoriel"
          >
            <X className="size-3.5" aria-hidden="true" />
          </Button>
        </div>

        <div className="px-4 pb-1 pt-1.5">
          <h2 className="font-display text-[14px] font-semibold tracking-tight text-foreground">{current.title}</h2>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">{current.body}</p>
        </div>

        <div className="mx-4 mt-2 h-0.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="flex items-center gap-1.5 p-3">
          <Button type="button" variant="ghost" size="sm" onClick={finish} className="text-muted-foreground">
            Passer
          </Button>
          <span className="flex-1" aria-hidden="true" />
          {step > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setStep(nextVisibleStep(step, -1))} aria-label="Etape precedente">
              <ArrowLeft className="size-3.5" aria-hidden="true" />
            </Button>
          ) : null}
          <Button type="button" size="sm" onClick={onNext}>
            {isLast ? (
              <>
                Terminer
                <Check className="size-3.5" aria-hidden="true" />
              </>
            ) : (
              <>
                Suivant
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
