// Contrats d'authentification et de session.
import { t } from 'elysia';
import { mobilityProfile } from './profile.ts';

const email = t.String({ format: 'email', maxLength: 180 });

// Regles alignees sur le mode autonome du client et sur l'ASVS v4 niveau 1.
const password = t.String({
  minLength: 12,
  maxLength: 200,
  pattern: '\\d',
  error: 'Le mot de passe doit faire au moins 12 caracteres et contenir un chiffre.',
});

export const credentials = t.Object({
  email,
  // A la connexion, on ne rejoue pas la politique de robustesse : un ancien
  // mot de passe valide doit pouvoir se presenter, et la reponse ne doit pas
  // reveler la politique en vigueur.
  password: t.String({ minLength: 1, maxLength: 200 }),
});

export const registration = t.Object({
  email,
  password,
  displayName: t.String({ minLength: 1, maxLength: 60 }),
});

export const sessionUser = t.Object({
  id: t.String(),
  email: t.String(),
  displayName: t.String(),
  profile: mobilityProfile,
});
