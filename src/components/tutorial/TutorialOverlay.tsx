// Tour guidé de première visite : chaque disposition décrit son propre
// parcours, car les fonctions desktop et mobile n'ont ni les mêmes cibles ni
// le même espace disponible. Une cible absente est sautée, notamment quand la
// feuille d'un itinéraire remplace la barre d'actions mobile.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { Button } from '../ui/button';

export const TUTORIAL_DONE_KEY = 'ufm.tutorialDone.v2';

interface TourStep {
    id: string;
    /** Attribut data-tour cible ; absent → carte centrée sans spotlight. */
    target?: string;
    title: string;
    body: string;
}

const DESKTOP_STEPS: TourStep[] = [
    {
        id: 'welcome',
        title: 'Bienvenue sur UrbanFlow',
        body: "Ton planificateur de mobilité urbaine : trouve le trajet le plus rapide avec ce dont tu disposes, mesure son empreinte carbone, planifie tes déplacements, automatise tes routines et suis tes objectifs. Ce tour rapide te montre l'essentiel — quitte-le à tout moment avec « Passer » ou Échap.",
    },
    {
        id: 'search',
        target: 'search',
        title: 'Recherche départ / arrivée',
        body: "Saisis une adresse : les suggestions viennent du géocodeur national (BAN). « Ma position » utilise le GPS comme point de départ. Dès que les deux champs sont remplis, le trajet se calcule automatiquement.",
    },
    {
        id: 'map',
        target: 'map',
        title: 'La carte',
        body: "Le trajet retenu s'affiche segment par segment, une couleur par moyen de transport. En fond : arrêts de transport public et stations de vélos/trottinettes en temps réel.",
    },
    {
        id: 'route-detail',
        target: 'route-detail',
        title: 'Choisir un trajet',
        body: "Tous les trajets autorisés sont classés par arrivée. Le premier est sélectionné ; touche une autre carte pour changer de trajet. « Moyens de transport » permet d'en ajouter ou d'en retirer pour cette recherche. Le détail donne les horaires, l'empreinte en gCO₂e comparée au même trajet en voiture, et chaque étape. « Planifier » date le trajet ou en fait une routine, « Enregistrer » le garde sous la main.",
    },
    {
        id: 'trips',
        target: 'trips',
        title: 'Mes trajets — le planificateur',
        body: "Le cœur de l'application : tes trajets à venir (comptés automatiquement après leur date, sauf annulation), tes routines récurrentes (ex: aller-retour au travail, mise en pause possible), ton historique et tes itinéraires enregistrés.",
    },
    {
        id: 'goals',
        target: 'trips',
        title: 'Objectifs et progression',
        body: "Dans le planificateur, fixe tes objectifs hebdomadaires et mensuels de CO₂e évité puis suis leur progression. Chaque trajet passé et non annulé alimente automatiquement tes statistiques.",
    },
    {
        id: 'layers',
        target: 'layers',
        title: 'Couches temps réel',
        body: "Active ou masque les arrêts GTFS et les vélos et trottinettes partagés (flux GBFS live).",
    },
    {
        id: 'carbon',
        target: 'carbon',
        title: 'Suivi carbone',
        body: "Consulte tes émissions de la semaine, ton maximum et le reste disponible ou le dépassement. Les économies comparées à la voiture sont affichées séparément.",
    },
    {
        id: 'profile',
        target: 'profile',
        title: 'Profil et préférences',
        body: "Ce dont tu disposes (Vélo'v, Dott, transport en commun) et ton besoin PMR déterminent le trajet calculé. Le maximum carbone sert au suivi de tes dépenses dans la semaine ; il ne filtre pas les trajets.",
    },
    {
        id: 'done',
        title: "C'est tout !",
        body: "Tu sais tout. Tu peux revoir ce tutoriel à tout moment via le bouton « ? » en bas du panneau latéral ou depuis ton profil. Bonne planification !",
    },
];

const MOBILE_STEPS: TourStep[] = [
    {
        id: 'welcome',
        title: 'Bienvenue sur UrbanFlow',
        body: "Ce tour te montre les fonctions accessibles depuis la carte mobile. Tu peux l'arrêter à tout moment avec « Passer ».",
    },
    {
        id: 'search',
        target: 'mobile-search',
        title: 'Recherche départ / arrivée',
        body: "Saisis une destination : ta position sert de départ si le GPS est autorisé. Tu peux ensuite afficher les deux champs pour choisir ou inverser précisément le départ et l'arrivée.",
    },
    {
        id: 'map',
        target: 'mobile-map',
        title: 'La carte',
        body: "La carte affiche les mobilités disponibles et les tracés réels des itinéraires. Un appui long permet aussi de choisir directement un point de départ ou d'arrivée.",
    },
    {
        id: 'location',
        target: 'mobile-location',
        title: 'Ta position',
        body: 'Ce bouton demande ta position puis recentre la carte. Si tu refuses le GPS, toute la recherche reste disponible avec une adresse saisie manuellement.',
    },
    {
        id: 'nearby',
        target: 'mobile-nearby',
        title: 'Autour de moi',
        body: "Ouvre les disponibilités proches : stations Vélo'v, trottinettes et arrêts de transport autour de ta position ou du centre de la métropole.",
    },
    {
        id: 'layers',
        target: 'mobile-layers',
        title: 'Couches temps réel',
        body: "Choisis ce que la carte affiche : arrêts GTFS, stations Vélo'v et trottinettes issues des flux de disponibilité en temps réel.",
    },
    {
        id: 'trips',
        target: 'mobile-trips',
        title: 'Trajets et objectifs',
        body: "Retrouve ici tes trajets à venir, routines, historiques et itinéraires enregistrés. C'est aussi là que tu suis et modifies tes objectifs hebdomadaires et mensuels.",
    },
    {
        id: 'profile',
        target: 'mobile-profile',
        title: 'Profil et préférences',
        body: "Règle ce dont tu disposes (Vélo'v, Dott, transport en commun), ton besoin PMR et tes objectifs carbone. Le trajet calculé en dépend directement.",
    },
    {
        id: 'done',
        title: "C'est tout !",
        body: 'Tu peux relancer ce tutoriel depuis ton profil. Choisis maintenant une destination pour obtenir ton trajet le plus rapide et son empreinte en gCO₂e.',
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
    // Plusieurs éléments peuvent porter le même data-tour (desktop + mobile) :
    // on prend le premier réellement visible.
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

function nextVisibleStep(steps: TourStep[], from: number, dir: 1 | -1): number {
    let i = from + dir;
    while (i > 0 && i < steps.length - 1 && !stepAvailable(steps[i])) {
        i += dir;
    }
    return Math.min(Math.max(i, 0), steps.length - 1);
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

function mobileCardPosition(rect: Rect | null, cardH: number, cardW: number): React.CSSProperties {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = (vw - cardW) / 2;
    const clampTop = (top: number) => Math.min(Math.max(top, MARGIN), Math.max(MARGIN, vh - cardH - MARGIN));

    if (!rect) {
        return { left, top: clampTop((vh - cardH) / 2) };
    }
    if (rect.width > vw * 0.8 && rect.height > vh * 0.6) {
        return { left, top: clampTop(vh - cardH - MARGIN) };
    }

    const below = rect.top + rect.height + MARGIN;
    if (below + cardH + MARGIN <= vh) {
        return { left, top: below };
    }
    const above = rect.top - cardH - MARGIN;
    if (above >= MARGIN) {
        return { left, top: above };
    }
    return { left, top: clampTop(rect.top + rect.height / 2 < vh / 2 ? vh - cardH - MARGIN : MARGIN) };
}

// Position desktop : droite → gauche → dessous → dessus.
function desktopCardPosition(rect: Rect | null, cardH: number, cardW: number): React.CSSProperties {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!rect || rect.width > vw * 0.6) {
        const cx = rect ? rect.left + rect.width / 2 : vw / 2;
        const cy = rect ? rect.top + rect.height / 2 : vh / 2;
        return {
            left: Math.min(Math.max(cx, cardW / 2 + MARGIN), vw - cardW / 2 - MARGIN),
            top: cy,
            transform: 'translate(-50%, -50%)',
        };
    }

    const clampTop = (t: number) => Math.min(Math.max(t, MARGIN), Math.max(MARGIN, vh - cardH - MARGIN));
    const clampLeft = (l: number) => Math.min(Math.max(l, MARGIN), Math.max(MARGIN, vw - cardW - MARGIN));
    const anchorTop = rect.height > vh * 0.8 ? rect.top + rect.height / 2 - cardH / 2 : rect.top;

    const right = rect.left + rect.width + MARGIN;
    if (right + cardW + MARGIN <= vw) {
        return { left: right, top: clampTop(anchorTop) };
    }
    const left = rect.left - MARGIN - cardW;
    if (left >= MARGIN) {
        return { left, top: clampTop(anchorTop) };
    }
    const below = rect.top + rect.height + MARGIN;
    if (below + cardH + MARGIN <= vh) {
        return { left: clampLeft(rect.left), top: below };
    }
    return { left: clampLeft(rect.left), top: clampTop(rect.top - MARGIN - cardH) };
}

export function TutorialOverlay({ desktop, ready, relaunchSignal = 0 }: {
    desktop: boolean;
    /** Le tour ne démarre pas tant qu'un autre dialogue attend une réponse. */
    ready: boolean;
    relaunchSignal?: number;
}) {
    const steps = desktop ? DESKTOP_STEPS : MOBILE_STEPS;
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

    // Lancement auto à la première visite, une fois l'écran libre.
    useEffect(() => {
        if (!ready) {
            return;
        }
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
    }, [ready]);

    // Relance manuelle (bouton "?").
    useEffect(() => {
        if (relaunchSignal > 0) {
            setStep(0);
            setActive(true);
        }
    }, [relaunchSignal]);

    // Suivi du rect cible en continu : les panneaux s'ouvrent avec des
    // animations, un simple resize listener raterait le mouvement. Interval
    // plutôt que requestAnimationFrame, qui peut être suspendu (onglet cache,
    // webviews embarquées) et figerait le spotlight.
    useEffect(() => {
        if (!active) {
            return;
        }
        const tick = () => {
            const target = steps[step]?.target;
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
    }, [active, step, steps]);

    useLayoutEffect(() => {
        if (!active) {
            return;
        }
        const height = cardRef.current?.offsetHeight;
        if (height) {
            setCardH((prev) => (Math.abs(height - prev) > 1 ? height : prev));
        }
    }, [active, step, rect]);

    // Clavier : Échap = passer, fleches / Entrée = navigation.
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
                    if (current === steps.length - 1) {
                        finish();
                        return current;
                    }
                    return nextVisibleStep(steps, current, 1);
                });
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                event.stopPropagation();
                setStep((current) => (current > 0 ? nextVisibleStep(steps, current, -1) : current));
            }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [active, steps]);

    if (!active) {
        return null;
    }

    const current = steps[step] ?? steps[0];
    const isLast = step === steps.length - 1;
    const spotlight = current.target ? rect : null;
    const cardW = Math.min(CARD_WIDTH, window.innerWidth - MARGIN * 2);
    const onNext = () => {
        if (isLast) {
            finish();
        } else {
            setStep(nextVisibleStep(steps, step, 1));
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100]"
            role="dialog"
            aria-modal="true"
            aria-label="Tutoriel UrbanFlow"
            data-tour-step={current.id}
        >
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
                data-testid="tutorial-card"
                className="absolute animate-in fade-in-0 zoom-in-95 rounded-2xl border border-border bg-background shadow-float duration-200"
                style={{
                    width: cardW,
                    ...(desktop ? desktopCardPosition(spotlight, cardH, cardW) : mobileCardPosition(spotlight, cardH, cardW)),
                }}
            >
                <div className="flex items-center gap-2 px-4 pt-3.5">
                    <span className="text-[9px] tabular-nums text-muted-foreground">
                        {String(step + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
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
                        style={{ width: `${((step + 1) / steps.length) * 100}%` }}
                    />
                </div>

                <div className="flex items-center gap-1.5 p-3">
                    <Button type="button" variant="ghost" size="sm" onClick={finish} className="text-muted-foreground">
                        Passer
                    </Button>
                    <span className="flex-1" aria-hidden="true" />
                    {step > 0 ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setStep(nextVisibleStep(steps, step, -1))}
                            aria-label="Étape précédente"
                        >
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
