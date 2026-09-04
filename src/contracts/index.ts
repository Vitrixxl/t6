// Contrats de donnees et de validation, importes par le client et par l'API.
//
// C'est le pendant de src/types.ts pour tout ce qui se valide : un schema zod
// par objet echange, et son type derive. Une modification ici casse la
// compilation des deux cotes, c'est voulu.
import { z } from 'zod';

// Les messages par defaut de zod sont en anglais ; l'interface et l'API
// parlent francais. La locale s'applique a tous les schemas, des deux cotes.
z.config(z.locales.fr());

export * from './primitives';
export * from './limits';
export * from './profile';
export * from './auth';
export * from './trips';
export * from './collections';
export * from './state';
export * from './routing';
