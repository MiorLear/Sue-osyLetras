import { describe, expect, it } from 'vitest';

import { isMediaUrl, isSameOriginMedia } from './media-origins';

const APP = 'http://localhost:3000';

describe('isMediaUrl', () => {
  // La regla que sostiene todo el diseño del worker: si esto casara con la
  // API, una entrada de caché indexada por URL le daría el perfil de una
  // docente a la siguiente que abriera la tablet compartida.
  it.each([
    `${APP}/api/posts`,
    `${APP}/api/media/upload`,
    'https://explorarte-api.onrender.com/api/profile',
  ])('nunca casa con la API: %s', (url) => {
    expect(isMediaUrl(url)).toBe(false);
  });

  it('casa la ruta canónica /media/** en cualquier origen', () => {
    expect(isMediaUrl(`${APP}/media/tools/manual.pdf`)).toBe(true);
    expect(isMediaUrl('https://explorarte-prod.web.app/media/posts/foto.jpg')).toBe(true);
    expect(isMediaUrl('https://explorarte-api.onrender.com/media/x')).toBe(true);
  });

  it('casa los almacenes de objetos conocidos', () => {
    expect(isMediaUrl('https://storage.googleapis.com/explorarte-media/tools/a.pdf')).toBe(true);
    expect(isMediaUrl('https://abc.supabase.co/storage/v1/object/public/media/a.pdf')).toBe(true);
  });

  // Una firma caduca y cambia en cada petición: guardar bajo esa URL crea una
  // entrada nueva cada vez que nunca se vuelve a acertar. La canónica es la que
  // se cachea, y ella redirige a la firmada.
  it('no casa una URL firmada', () => {
    expect(
      isMediaUrl('https://storage.googleapis.com/explorarte-media/a.pdf?X-Goog-Signature=deadbeef'),
    ).toBe(false);
    expect(isMediaUrl('https://abc.supabase.co/storage/v1/object/sign/m/a.pdf?token=xyz')).toBe(
      false,
    );
  });

  it('no casa cualquier otro host ni una URL rota', () => {
    expect(isMediaUrl('https://ejemplo.com/algo.pdf')).toBe(false);
    expect(isMediaUrl('no soy una url')).toBe(false);
    expect(isMediaUrl('javascript:alert(1)')).toBe(false);
    expect(isMediaUrl('data:text/plain,hola')).toBe(false);
  });
});

describe('isSameOriginMedia', () => {
  // Decide si se puede comprobar la frescura de verdad: entre orígenes el
  // navegador oculta ETag a JavaScript salvo que el servidor lo exponga.
  it('sí para el propio origen', () => {
    expect(isSameOriginMedia(`${APP}/media/a.pdf`, APP)).toBe(true);
  });

  it('no para otro origen, aunque sea un medio válido', () => {
    expect(isSameOriginMedia('https://storage.googleapis.com/m/a.pdf', APP)).toBe(false);
    expect(isSameOriginMedia('https://explorarte-api.onrender.com/media/a.pdf', APP)).toBe(false);
  });

  it('no para lo que no es un medio, aunque sea del propio origen', () => {
    expect(isSameOriginMedia(`${APP}/api/posts`, APP)).toBe(false);
  });
});
