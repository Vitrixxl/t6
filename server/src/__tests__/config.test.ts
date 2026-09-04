// Tests de chargement de la configuration.
//
// `.env.example` liste les cles avec une valeur vide, pour documenter ce qui
// existe. Copier ce fichier ne doit pas transformer chaque defaut en chaine
// vide : c'est l'objet du premier cas ci-dessous.
import { describe, expect, it } from 'bun:test';
import { loadConfig } from '../config/index.ts';

const PUBLIC_OSRM = 'https://routing.openstreetmap.de';

describe('loadConfig', () => {
    it('traite une variable vide comme une variable absente', () => {
        const defaults = { foot: `${PUBLIC_OSRM}/routed-foot`, bike: `${PUBLIC_OSRM}/routed-bike`, car: `${PUBLIC_OSRM}/routed-car` };
        expect(loadConfig({ OSRM_FOOT_URL: '', OSRM_BIKE_URL: '   ', OSRM_CAR_URL: '' }).osrmUrls).toEqual(defaults);
        expect(loadConfig({}).osrmUrls).toEqual(defaults);
    });

    it('retient une instance locale et retire la barre finale', () => {
        expect(loadConfig({
            OSRM_FOOT_URL: ' http://osrm-foot:5000/ ',
            OSRM_BIKE_URL: 'http://osrm-bike:5000///',
            OSRM_CAR_URL: 'http://osrm-car:5000',
        }).osrmUrls).toEqual({ foot: 'http://osrm-foot:5000', bike: 'http://osrm-bike:5000', car: 'http://osrm-car:5000' });
        expect(loadConfig({ OSRM_FOOT_URL: 'http://osrm-foot:5000' }).osrmUrls.bike).toBe(`${PUBLIC_OSRM}/routed-bike`);
    });

    it('refuse une duree de cache absurde plutot que de la subir en requete', () => {
        expect(() => loadConfig({ ROUTE_CACHE_TTL_MS: '-1' })).toThrow();
        expect(() => loadConfig({ ROUTE_CACHE_TTL_MS: 'plus tard' })).toThrow();
    });
});
