// Passerelle de test.
//
// Les tests etaient ecrits pour Vitest, qui est un outil du bundler precedent.
// Plutot que de reecrire neuf fichiers et deux cents assertions — donc de
// risquer d'en changer le sens au passage — cette passerelle traduit les
// quelques primitives utilisees vers celles de `bun:test`.
//
// Elle ne couvre que ce dont le depot se sert. Une methode absente doit etre
// ajoutee ici en connaissance de cause, pas contournee dans un test.
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

export { afterEach, beforeEach, describe, expect, it };

/** Valeurs globales remplacees, pour pouvoir les rendre telles quelles. */
const stubbed = new Map<string, unknown>();

export const vi = {
    fn: mock,
    spyOn,

    /**
     * Remplace une valeur globale en gardant l'ancienne. `bun:test` n'a pas
     * d'equivalent : la restauration doit etre explicite, d'ou la table.
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
