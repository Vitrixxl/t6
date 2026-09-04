// Passerelle de test.
//
// Les tests étaient ecrits pour Vitest, qui est un outil du bundler précédent.
// Plutôt que de reecrire neuf fichiers et deux cents assertions — donc de
// risquer d'en changer le sens au passage — cette passerelle traduit les
// quelques primitives utilisées vers celles de `bun:test`.
//
// Elle ne couvre que ce dont le dépôt se sert. Une méthode absente doit être
// ajoutée ici en connaissance de cause, pas contournee dans un test.
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

export { afterEach, beforeEach, describe, expect, it };

/** Valeurs globales remplacees, pour pouvoir les rendre telles quelles. */
const stubbed = new Map<string, unknown>();

export const vi = {
    fn: mock,
    spyOn,

    /**
     * Remplace une valeur globale en gardant l'ancienne. `bun:test` n'a pas
     * d'équivalent : la restauration doit être explicite, d'où la table.
     */
    stubGlobal(name: string, value: unknown) {
        if (!stubbed.has(name)) {
            stubbed.set(name, (globalThis as Record<string, unknown>)[name]);
        }
        (globalThis as Record<string, unknown>)[name] = value;
    },

    unstubAllGlobals() {
        for (const [name, original] of stubbed) {
            if (original === undefined) {
                delete (globalThis as Record<string, unknown>)[name];
            } else {
                (globalThis as Record<string, unknown>)[name] = original;
            }
        }
        stubbed.clear();
    },

    restoreAllMocks() {
        mock.restore();
    },
};
