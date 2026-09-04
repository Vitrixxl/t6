// Contrats de données et de validation, importes par le client et par l'API.
//
// C'est le pendant de src/types.ts pour tout ce qui se valide : un schéma zod
// par objet echange, et son type dérive. Une modification ici casse la
// compilation des deux côtés, c'est voulu.
import { z } from 'zod';

// Les messages par défaut de zod sont en anglais ; l'interface et l'API
// parlent français. La locale s'applique à tous les schémas, des deux côtés.
z.config(z.locales.fr());

export * from './primitives';
export * from './limits';
export * from './profile';
export * from './auth';
export * from './trips';
export * from './collections';
export * from './state';
export * from './routing';
