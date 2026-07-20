// Module authentification : connexion et inscription.
import { FormEvent, useState } from 'react';
import { Bike, Navigation, Route, ShieldCheck, Sparkles} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import type { SessionUser} from '../../types';
import { loginUser, registerUser } from '../../lib/auth';

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: SessionUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const authenticatedUser =
        mode === 'register'
          ? await registerUser({ displayName, email, password })
          : await loginUser({ email, password });
      onAuthenticated(authenticatedUser);
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-[radial-gradient(circle_at_18%_12%,oklch(0.93_0.05_130/0.65),transparent_42%),radial-gradient(circle_at_85%_90%,oklch(0.9_0.17_122/0.28),transparent_38%),linear-gradient(160deg,oklch(0.976_0.008_95),oklch(0.955_0.018_110))] p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-white/70 bg-white/90 shadow-float backdrop-blur-xl md:grid-cols-[1.05fr_1fr]">
        <section
          aria-label="Presentation UrbanFlow"
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
              Planifie tes deplacements multimodaux, automatise tes routines et suis tes objectifs carbone, dans une seule
              application pour la metropole.
            </p>
          </div>
          <ul className="relative grid gap-2 text-[13px] font-medium text-primary-foreground/92">
            <li className="flex items-center gap-2">
              <Route className="size-4 text-[oklch(0.9_0.17_122)]" aria-hidden="true" />
              Planificateur multimodal temps reel
            </li>
            <li className="flex items-center gap-2">
              <Bike className="size-4 text-[oklch(0.9_0.17_122)]" aria-hidden="true" />
              Velos, trottinettes et arrets GTFS integres
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-[oklch(0.9_0.17_122)]" aria-hidden="true" />
              Donnees protegees, geolocalisation avec consentement
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
              Mobilite urbaine intelligente
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
          <form className="grid gap-3" onSubmit={handleSubmit}>
            {mode === 'register' ? (
              <label className="grid gap-1.5 text-sm font-medium" htmlFor="register-display-name">
                Nom affiche
                <Input
                  id="register-display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="name"
                  required
                />
              </label>
            ) : null}
            <label className="grid gap-1.5 text-sm font-medium" htmlFor="auth-email">
              Email
              <Input id="auth-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
            </label>
            <label className="grid gap-1.5 text-sm font-medium" htmlFor="auth-password">
              Mot de passe
              <Input
                id="auth-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                minLength={12}
                required
              />
            </label>
            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={busy}>
              {busy ? 'Traitement...' : mode === 'register' ? 'Creer le compte' : 'Ouvrir la carte'}
            </Button>
          </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

