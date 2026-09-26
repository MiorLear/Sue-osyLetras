import { describe, expect, it } from 'vitest';
import { ApiError } from '@explorarte/shared';

import { describeAuthError, firebaseAuthCode } from '@/lib/auth-errors';

// El síntoma que motivó este archivo: el login mostraba "No pudimos conectar
// con el servidor" para CUALQUIER fallo de Firebase, incluido el popup
// bloqueado del navegador embebido de una app. El mensaje era falso y no
// dejaba diagnosticar nada. Lo que se prueba aquí es que cada causa se
// distingue de las demás.

describe('auth-errors · firebaseAuthCode', () => {
  it('reconoce un error de Firebase Auth por su código', () => {
    expect(firebaseAuthCode({ code: 'auth/popup-blocked' })).toBe('auth/popup-blocked');
  });

  it('ignora códigos de otros servicios de Firebase', () => {
    expect(firebaseAuthCode({ code: 'storage/object-not-found' })).toBeNull();
  });

  it('tolera lo que no es un objeto', () => {
    expect(firebaseAuthCode(null)).toBeNull();
    expect(firebaseAuthCode('auth/popup-blocked')).toBeNull();
    expect(firebaseAuthCode(undefined)).toBeNull();
  });
});

describe('auth-errors · describeAuthError', () => {
  it('explica el popup bloqueado en vez de culpar a la conexión', () => {
    const display = describeAuthError({ code: 'auth/popup-blocked' });
    expect(display).toEqual({ kind: 'message', message: expect.stringContaining('emergentes') });
  });

  // Cerrar la ventana de Google es una decisión, no un fallo: pintar un error
  // rojo por ello confunde a quien simplemente cambió de opinión.
  it('no dice nada cuando la usuaria cancela', () => {
    for (const code of [
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
      'auth/user-cancelled',
    ]) {
      expect(describeAuthError({ code })).toEqual({ kind: 'silent' });
    }
  });

  it('distingue un fallo de red de Google', () => {
    const display = describeAuthError({ code: 'auth/network-request-failed' });
    expect(display).toEqual({ kind: 'message', message: expect.stringContaining('conexión') });
  });

  // Sin el código a la vista, un fallo en el teléfono de una docente no se
  // puede diagnosticar sin reproducir su navegador.
  it('deja ver el código de los errores que no tienen mensaje propio', () => {
    const display = describeAuthError({ code: 'auth/internal-error' });
    expect(display).toEqual({
      kind: 'message',
      message: expect.stringContaining('(auth/internal-error)'),
    });
  });

  // El mensaje genérico no nombra proveedor: el código que trae dentro es lo
  // que hace diagnosticable un reporte desde el teléfono de una docente.
  it('el mensaje genérico no le echa la culpa a un proveedor concreto', () => {
    const display = describeAuthError({ code: 'auth/internal-error' });
    expect(display).toEqual({ kind: 'message', message: expect.not.stringContaining('Google') });
  });

  it('devuelve null para lo que no es de Firebase Auth, y así cae al mapeo de la API', () => {
    expect(describeAuthError(new ApiError(401, 'unauthorized', ''))).toBeNull();
    expect(describeAuthError(new TypeError('Failed to fetch'))).toBeNull();
  });
});
