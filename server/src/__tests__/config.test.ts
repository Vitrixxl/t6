// Tests de chargement de la configuration.
//
// `.env.example` liste les clés avec une valeur vide, pour documenter ce qui
// existe. Copier ce fichier ne doit pas transformer chaque défaut en chaîne
// vide : c'est l'objet du premier cas ci-dessous.
import { describe, expect, it } from 'bun:test';
import { loadConfig } from '../config/index.ts';

describe('loadConfig', () => {
    it('traite une variable vide comme une variable absente', () => {
        const defaults = { foot: 'http://osrm-foot:5000', bike: 'http://osrm-bike:5000', car: 'http://osrm-car:5000' };
        expect(loadConfig({ OSRM_FOOT_URL: '', OSRM_BIKE_URL: '   ', OSRM_CAR_URL: '' }).osrmUrls).toEqual(defaults);
        expect(loadConfig({}).osrmUrls).toEqual(defaults);
    });

    it('retient une instance locale et retire la barre finale', () => {
        expect(loadConfig({
            OSRM_FOOT_URL: ' http://127.0.0.1:5001/ ',
            OSRM_BIKE_URL: 'http://osrm-bike:5000///',
            OSRM_CAR_URL: 'http://osrm-car:5000',
        }).osrmUrls).toEqual({ foot: 'http://127.0.0.1:5001', bike: 'http://osrm-bike:5000', car: 'http://osrm-car:5000' });
        expect(loadConfig({ OSRM_FOOT_URL: 'http://osrm-foot:5000' }).osrmUrls.bike).toBe('http://osrm-bike:5000');
    });

    it('refuse un port absurde plutôt que de le subir au démarrage', () => {
        expect(() => loadConfig({ API_PORT: '-1' })).toThrow();
        expect(() => loadConfig({ API_PORT: 'plus tard' })).toThrow();
    });
});
