// Las claves con las que se guarda cada respuesta en la caché offline.
//
// Existen como módulo por dos razones que no son de estilo:
//
//  1. La pasada de sincronización (PWA-2.11) recorre lo cacheado por clave para
//     saber qué medios referencia el contenido. Con literales sueltos en las
//     pantallas, una clave mal escrita no rompe nada visible: la pantalla
//     simplemente deja de tener caché y la sincronización deja de verla. El
//     fallo es silencioso y solo aparece sin conexión.
//  2. Son las mismas claves que usa la app de React Native (`src/app/*.tsx`),
//     así que ambos clientes hablan del mismo contenido con el mismo nombre.
//     Cambiar una aquí sin cambiarla allá invalida la caché de esa pantalla en
//     un solo lado.
//
// La única de RN que no tiene equivalente aquí es `dashboard`, que allá guarda
// `{ profile, events }` en una entrada. En web el panel principal saca el
// nombre de AuthContext y los eventos de la entrada `events`, la misma que lee
// el calendario: una sola copia y una sola revalidación para las dos pantallas.
//
// El namespace por usuaria no va aquí: lo pone `offline-cache.ts` al escribir,
// con `scopedKey(userId, key)`.

/** Las pantallas que pueden tener video de introducción. */
export type IntroScreen = 'home' | 'emotions' | 'tools' | 'learning';

/** Filtro del feed de Comunidad. `undefined` es "todos". */
export type PostFilter = string | undefined;

export const cacheKeys = {
  /** Biblioteca de emociones. */
  emotionsList: () => 'emotions:list',
  /** Ficha de una emoción. */
  emotion: (id: string) => `emotion:${id}`,
  /** Caja de herramientas (manual, guías, bibliografía). */
  tools: () => 'tools',
  /** Temas de Aprendiendo. */
  learningTopics: () => 'learning:topics',
  /** Calendario. */
  events: () => 'events',
  /** Feed de Comunidad, una entrada por filtro. */
  posts: (filter: PostFilter) => `posts:${filter ?? 'todos'}`,
  /** Perfil de la usuaria conectada. */
  profile: () => 'profile:me',
  /** Video de introducción de una pantalla. */
  screenIntro: (screen: IntroScreen) => `screen-intro:${screen}`,
} as const;

/**
 * Todas las claves que la app puede escribir sin depender de un id o un filtro.
 * La sincronización de JSON (PWA-2.11) la usa para saber qué precargar, y el
 * test de este módulo para comprobar que no hay duplicadas.
 */
export const STATIC_CACHE_KEYS: readonly string[] = [
  cacheKeys.emotionsList(),
  cacheKeys.tools(),
  cacheKeys.learningTopics(),
  cacheKeys.events(),
  cacheKeys.profile(),
  cacheKeys.screenIntro('home'),
  cacheKeys.screenIntro('emotions'),
  cacheKeys.screenIntro('tools'),
  cacheKeys.screenIntro('learning'),
];
