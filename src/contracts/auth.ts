// Contrats d'authentification et de session.
import { z } from 'zod';
import { mobilityProfile } from './profile';

const email = z.email('Adresse email invalide.').max(180);

// Regles alignees sur l'ASVS v4 niveau 1 : douze caracteres et un chiffre.
const password = z
    .string()
    .min(12, 'Le mot de passe doit faire au moins 12 caracteres.')
    .max(200)
    .regex(/\d/, 'Le mot de passe doit contenir un chiffre.');

export const credentials = z.object({
    email,
    // A la connexion, on ne rejoue pas la politique de robustesse : un ancien
    // mot de passe valide doit pouvoir se presenter, et la reponse ne doit pas
    // reveler la politique en vigueur.
    password: z.string().min(1, 'Le mot de passe est obligatoire.').max(200),
});
export type Credentials = z.infer<typeof credentials>;

export const registration = z.object({
    email,
    password,
    displayName: z.string().min(1, 'Le nom affiche est obligatoire.').max(60, '60 caracteres au plus.'),
});
export type Registration = z.infer<typeof registration>;

export const sessionUser = z.object({
    id: z.string(),
    email: z.string(),
    displayName: z.string(),
    profile: mobilityProfile,
});
export type SessionUser = z.infer<typeof sessionUser>;
