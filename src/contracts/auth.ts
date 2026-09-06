// Contrats d'authentification et de session.
import { z } from 'zod';
import { mobilityProfile } from './profile';

const email = z.email('Adresse email invalide.').max(180);

// Règles alignées sur l'ASVS v4 niveau 1 : douze caractères et un chiffre.
const password = z
    .string()
    .min(12, 'Le mot de passe doit faire au moins 12 caractères.')
    .max(200)
    .regex(/\d/, 'Le mot de passe doit contenir un chiffre.');

export const credentials = z.object({
    email,
    // À la connexion, on ne rejoue pas la politique de robustesse : un ancien
    // mot de passe valide doit pouvoir se présenter, et la réponse ne doit pas
    // reveler la politique en vigueur.
    password: z.string().min(1, 'Le mot de passe est obligatoire.').max(200),
});
export type Credentials = z.infer<typeof credentials>;

/**
 * Version des conditions d'utilisation et de l'information sur les données
 * personnelles. Elle est enregistrée avec le compte à l'inscription : on sait
 * quel texte l'utilisateur a accepté. Changer le texte, c'est changer la date.
 */
export const TERMS_VERSION = '2026-09-06';

export const registration = z.object({
    email,
    password,
    displayName: z.string().min(1, 'Le nom affiché est obligatoire.').max(60, '60 caractères au plus.'),
    // Seule la valeur vraie passe : le serveur refuse une inscription sans
    // acceptation au même titre que le formulaire.
    termsAccepted: z.literal(true, 'Tu dois accepter les conditions d’utilisation pour créer un compte.'),
});
export type Registration = z.infer<typeof registration>;

export const sessionUser = z.object({
    id: z.string(),
    email: z.string(),
    displayName: z.string(),
    profile: mobilityProfile,
});
export type SessionUser = z.infer<typeof sessionUser>;
