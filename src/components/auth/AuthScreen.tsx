// Module authentification : connexion et inscription.
//
// Chaque formulaire valide avec le contrat que l'API applique (contracts/auth) :
// une saisie refusée ici le serait au même titre par le serveur.
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Bike, Navigation, Route, ShieldCheck, Sparkles } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { credentials, registration, type Credentials, type Registration } from '../../contracts';
import { useLogin, useRegister } from '../../queries';
import { LegalDialog } from '../legal/LegalNotice';

function FieldError({ message }: { message?: string }) {
    return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

function RequestError({ error }: { error: Error | null }) {
    return error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error.message}
        </p>
    ) : null;
}

function LoginForm() {
    const login = useLogin();
    const form = useForm<Credentials>({ resolver: zodResolver(credentials), defaultValues: { email: '', password: '' } });
    const { errors } = form.formState;

    return (
        <form className="grid gap-3" noValidate onSubmit={form.handleSubmit((values) => login.mutate(values))}>
            <label className="grid gap-1.5 text-sm font-medium" htmlFor="auth-email">
                Email
                <Input id="auth-email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} {...form.register('email')} />
                <FieldError message={errors.email?.message} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium" htmlFor="auth-password">
                Mot de passe
                <Input
                    id="auth-password"
                    type="password"
                    autoComplete="current-password"
                    aria-invalid={Boolean(errors.password)}
                    {...form.register('password')}
                />
                <FieldError message={errors.password?.message} />
            </label>
            <RequestError error={login.error} />
            <Button type="submit" disabled={login.isPending}>
                {login.isPending ? 'Traitement...' : 'Ouvrir la carte'}
            </Button>
        </form>
    );
}

function RegisterForm({ onShowTerms }: { onShowTerms: () => void }) {
    const register = useRegister();
    // Pas de valeur par défaut pour l'acceptation : la case part décochée et le
    // contrat n'admet que « vrai ».
    const form = useForm<Registration>({
        resolver: zodResolver(registration),
        defaultValues: { displayName: '', email: '', password: '' },
    });
    const { errors } = form.formState;

    return (
        <form className="grid gap-3" noValidate onSubmit={form.handleSubmit((values) => register.mutate(values))}>
            <label className="grid gap-1.5 text-sm font-medium" htmlFor="register-display-name">
                Nom affiché
                <Input
                    id="register-display-name"
                    autoComplete="name"
                    aria-invalid={Boolean(errors.displayName)}
                    {...form.register('displayName')}
                />
                <FieldError message={errors.displayName?.message} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium" htmlFor="auth-email">
                Email
                <Input id="auth-email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} {...form.register('email')} />
                <FieldError message={errors.email?.message} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium" htmlFor="auth-password">
                Mot de passe
                <Input
                    id="auth-password"
                    type="password"
                    autoComplete="new-password"
                    aria-invalid={Boolean(errors.password)}
                    {...form.register('password')}
                />
                <FieldError message={errors.password?.message} />
            </label>
            <div className="grid gap-1.5">
                <label className="flex items-start gap-2.5 text-sm" htmlFor="register-terms">
                    <input
                        id="register-terms"
                        type="checkbox"
                        className="mt-1 size-4 shrink-0 accent-primary"
                        aria-invalid={Boolean(errors.termsAccepted)}
                        aria-describedby={errors.termsAccepted ? 'register-terms-error' : undefined}
                        {...form.register('termsAccepted')}
                    />
                    <span>
                        J’accepte les{' '}
                        <button type="button" className="font-medium text-primary underline underline-offset-2" onClick={onShowTerms}>
                            conditions d’utilisation
                        </button>{' '}
                        et j’ai lu l’information sur mes données personnelles.
                    </span>
                </label>
                <span id="register-terms-error">
                    <FieldError message={errors.termsAccepted?.message} />
                </span>
            </div>
            <RequestError error={register.error} />
            <Button type="submit" disabled={register.isPending}>
                {register.isPending ? 'Traitement...' : 'Créer le compte'}
            </Button>
        </form>
    );
}

export function AuthScreen() {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [termsOpen, setTermsOpen] = useState(false);

    return (
        <main className="grid min-h-full place-items-center bg-[radial-gradient(circle_at_18%_12%,oklch(0.93_0.05_130/0.65),transparent_42%),radial-gradient(circle_at_85%_90%,oklch(0.9_0.17_122/0.28),transparent_38%),linear-gradient(160deg,oklch(0.976_0.008_95),oklch(0.955_0.018_110))] p-4">
            <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-white/70 bg-white/90 shadow-float backdrop-blur-xl md:grid-cols-[1.05fr_1fr]">
                <section
                    aria-label="Présentation UrbanFlow"
                    className="relative hidden flex-col justify-between overflow-hidden bg-[linear-gradient(155deg,oklch(0.34_0.075_165),oklch(0.44_0.09_160)_55%,oklch(0.5_0.1_150))] p-8 text-primary-foreground md:flex"
                >
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:radial-gradient(oklch(0.98_0.012_105)_1.2px,transparent_1.2px)] [background-size:22px_22px]"
                    />
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-[oklch(0.9_0.17_122/0.35)] blur-3xl"
                    />
                    <div className="relative flex items-center gap-2.5">
                        <span className="grid size-10 place-items-center rounded-2xl bg-[oklch(0.9_0.17_122)] text-[oklch(0.3_0.06_145)] shadow-soft">
                            <Navigation className="size-5" aria-hidden="true" />
                        </span>
                        <span className="font-display text-lg font-semibold tracking-tight">UrbanFlow</span>
                    </div>
                    <div className="relative">
                        <h1 className="font-display text-4xl font-semibold leading-[1.06] tracking-tight">
                            La ville,
                            <br />
                            fluide et
                            <br />
                            <span className="text-[oklch(0.9_0.17_122)]">bas carbone.</span>
                        </h1>
                        <p className="mt-4 max-w-xs text-sm leading-relaxed text-primary-foreground/78">
                            Planifie tes déplacements multimodaux, automatise tes routines et suis tes objectifs carbone, dans une seule
                            application pour la métropole.
                        </p>
                    </div>
                    <ul className="relative grid gap-2 text-[13px] font-medium text-primary-foreground/92">
                        <li className="flex items-center gap-2">
                            <Route className="size-4 text-[oklch(0.9_0.17_122)]" aria-hidden="true" />
                            Planificateur multimodal temps réel
                        </li>
                        <li className="flex items-center gap-2">
                            <Bike className="size-4 text-[oklch(0.9_0.17_122)]" aria-hidden="true" />
                            Vélos, trottinettes et arrêts GTFS intégrés
                        </li>
                        <li className="flex items-center gap-2">
                            <ShieldCheck className="size-4 text-[oklch(0.9_0.17_122)]" aria-hidden="true" />
                            Données protégées, géolocalisation avec consentement
                        </li>
                    </ul>
                </section>
                <Card className="rounded-none border-0 bg-transparent shadow-none">
                    <div className="flex items-center gap-2.5 px-6 pt-6 md:hidden">
                        <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
                            <Navigation className="size-4.5" aria-hidden="true" />
                        </span>
                        <span className="font-display text-lg font-semibold tracking-tight">UrbanFlow</span>
                    </div>
                    <CardHeader>
                        <Badge variant="info" className="w-fit">
                            <Sparkles className="size-3.5" aria-hidden="true" />
                            Mobilité urbaine intelligente
                        </Badge>
                        <CardTitle className="font-display text-2xl">UrbanFlow Mobility</CardTitle>
                        <CardDescription>Connecte-toi pour planifier tes trajets et suivre tes objectifs carbone.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Mode d'authentification">
                            <Button type="button" role="tab" aria-selected={mode === 'login'} variant={mode === 'login' ? 'default' : 'ghost'} size="sm" onClick={() => setMode('login')}>
                                Connexion
                            </Button>
                            <Button type="button" role="tab" aria-selected={mode === 'register'} variant={mode === 'register' ? 'default' : 'ghost'} size="sm" onClick={() => setMode('register')}>
                                Inscription
                            </Button>
                        </div>
                        {mode === 'login' ? <LoginForm /> : <RegisterForm onShowTerms={() => setTermsOpen(true)} />}
                        <button
                            type="button"
                            className="mt-4 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                            onClick={() => setTermsOpen(true)}
                        >
                            Conditions d’utilisation et données personnelles
                        </button>
                    </CardContent>
                </Card>
            </div>
            <LegalDialog open={termsOpen} onOpenChange={setTermsOpen} />
        </main>
    );
}
