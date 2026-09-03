import { webcrypto } from 'node:crypto';
import { beforeEach } from 'bun:test';

// L'environnement de test n'expose pas toujours Web Crypto subtle : on prend
// celle de Node quand elle manque.
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}

function createStorage(): Storage {
  let store: Record<string, string> = {};

  return {
    get length() {
      return Object.keys(store).length;
    },
    clear() {
      store = {};
    },
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    key(index: number) {
      return Object.keys(store)[index] ?? null;
    },
    removeItem(key: string) {
      delete store[key];
    },
    setItem(key: string, value: string) {
      store[key] = String(value);
    },
  };
}

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: createStorage(),
    configurable: true,
  });
}

if (typeof globalThis.sessionStorage === 'undefined') {
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: createStorage(),
    configurable: true,
  });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
