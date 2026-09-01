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
    expect(loadConfig({ OSRM_BASE_URL: '' }).osrmBaseUrl).toBe(PUBLIC_OSRM);
    expect(loadConfig({ OSRM_BASE_URL: '   ' }).osrmBaseUrl).toBe(PUBLIC_OSRM);
    expect(loadConfig({}).osrmBaseUrl).toBe(PUBLIC_OSRM);
  });

  it('retient une instance locale et retire la barre finale', () => {
    expect(loadConfig({ OSRM_BASE_URL: 'http://127.0.0.1:5000/' }).osrmBaseUrl).toBe('http://127.0.0.1:5000');
  });

  it('refuse une duree de cache absurde plutot que de la subir en requete', () => {
    expect(() => loadConfig({ ROUTE_CACHE_TTL_MS: '-1' })).toThrow();
    expect(() => loadConfig({ ROUTE_CACHE_TTL_MS: 'plus tard' })).toThrow();
  });
});
