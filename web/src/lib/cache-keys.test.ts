import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { STATIC_CACHE_KEYS, cacheKeys } from './cache-keys';

const routesDir = path.resolve(import.meta.dirname, '../routes');

describe('claves de caché', () => {
  it('no repite ninguna clave estática', () => {
    expect(new Set(STATIC_CACHE_KEYS).size).toBe(STATIC_CACHE_KEYS.length);
  });

  it('las claves con parámetro no colisionan entre pantallas', () => {
    expect(cacheKeys.emotion('alegria')).not.toBe(cacheKeys.emotion('tristeza'));
    expect(cacheKeys.posts('mios')).not.toBe(cacheKeys.posts(undefined));
    expect(cacheKeys.screenIntro('tools')).not.toBe(cacheKeys.screenIntro('learning'));
  });

  // El feed sin filtro y el feed filtrado por "todos" son la misma vista; si
  // cayeran en claves distintas, cada una guardaría su copia y una quedaría
  // vieja sin que nada lo indique.
  it('el feed sin filtro y el filtro «todos» comparten entrada', () => {
    expect(cacheKeys.posts(undefined)).toBe(cacheKeys.posts('todos'));
  });

  // Las mismas claves que usa la app de React Native. Si alguien cambia una
  // aquí y no allá, la caché de esa pantalla se invalida en un solo cliente.
  it('mantiene los nombres que ya usa la app móvil', () => {
    expect(cacheKeys.emotionsList()).toBe('emotions:list');
    expect(cacheKeys.emotion('42')).toBe('emotion:42');
    expect(cacheKeys.tools()).toBe('tools');
    expect(cacheKeys.learningTopics()).toBe('learning:topics');
    expect(cacheKeys.events()).toBe('events');
    expect(cacheKeys.profile()).toBe('profile:me');
    expect(cacheKeys.screenIntro('home')).toBe('screen-intro:home');
  });
});

// La razón de que este módulo exista: una clave escrita a mano en una pantalla
// no rompe nada visible online, pero deja esa pantalla sin caché sin avisar.
describe('las pantallas no escriben claves a mano', () => {
  const files = [
    'Main.tsx',
    'Emociones.tsx',
    'EmotionDetail.tsx',
    'Herramientas.tsx',
    'Aprendiendo.tsx',
    'Comunidad.tsx',
    'Calendar.tsx',
    'Profile.tsx',
    'Onboarding.tsx',
  ];

  it.each(files)('%s usa useOfflineAsync con cacheKeys', (file) => {
    const source = readFileSync(path.join(routesDir, file), 'utf8');
    expect(source).toContain('useOfflineAsync');
    expect(source).toContain('cacheKeys.');
    // El primer argumento del hook nunca es un literal.
    expect(source).not.toMatch(/useOfflineAsync\(\s*['"`]/);
  });
});
