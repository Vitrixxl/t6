// Tests de chargement de la configuration.
//
// `.env.example` liste les clés avec une valeur vide, pour documenter ce qui
// existe. Copier ce fichier ne doit pas transformer chaque défaut en chaîne
// vide : c'est l'objet du premier cas ci-dessous.
import { describe, expect, it } from 'bun:test';
import { loadConfig } from '../config/index.ts';

describe('loadConfig', () => {
    it('traite une variable vide comme une variable absente', () => {
        expect(loadConfig({ MOTIS_URL: '' }).motisUrl).toBe('http://motis:8080');
        expect(loadConfig({ MOTIS_URL: '   ' }).motisUrl).toBe('http://motis:8080');
        expect(loadConfig({}).motisUrl).toBe('http://motis:8080');
    });

    it('retient une instance locale et retire la barre finale', () => {
        expect(loadConfig({ MOTIS_URL: ' http://127.0.0.1:8080/ ' }).motisUrl).toBe('http://127.0.0.1:8080');
        expect(loadConfig({ MOTIS_URL: 'http://motis:8080///' }).motisUrl).toBe('http://motis:8080');
    });

    it('refuse un port absurde plutôt que de le subir au démarrage', () => {
        expect(() => loadConfig({ API_PORT: '-1' })).toThrow();
        expect(() => loadConfig({ API_PORT: 'plus tard' })).toThrow();
    });
});
