import { describe, expect, it } from 'vitest';

import type { DeadLetterRecord } from '@/lib/idb';
import { describeAttempts, describeMutation, describeRecord } from '@/lib/sync-problem-text';

// Lo que la docente lee cuando un cambio suyo no llegó. Un id crudo no le dice
// nada a nadie, así que lo que se prueba aquí es que cada clase de cambio se
// explica sola.

const LOOKUP = {
  events: [{ id: 'e-1', title: 'Sesión con 3.º grado' }],
  posts: [{ id: 7, text: 'Compartí una actividad nueva con el grupo' }],
};

describe('sync-problem-text · qué era el cambio', () => {
  it('el perfil dice qué campos se tocaron', () => {
    expect(describeMutation({ kind: 'profile.update', input: { name: 'Ana', phone: '1' } })).toEqual({
      title: 'Cambios en tu perfil',
      detail: 'Nombre, Teléfono',
    });
  });

  it('un evento nuevo se nombra y se fecha', () => {
    expect(
      describeMutation({
        kind: 'event.create',
        tempId: 'tmp-1',
        input: { title: 'Reunión de ciclo', date: '2026-03-12', startTime: '10:00' } as never,
      }),
    ).toEqual({ title: 'Evento nuevo: «Reunión de ciclo»', detail: '12 de marzo, 10:00' });
  });

  it('marcar una tarea se cuenta como lo que es', () => {
    expect(
      describeMutation({ kind: 'event.update', targetId: 'e-1', input: { completed: true } }, LOOKUP),
    ).toEqual({ title: 'Marcar «Sesión con 3.º grado» como completada' });
    expect(
      describeMutation({ kind: 'event.update', targetId: 'e-1', input: { completed: false } }, LOOKUP),
    ).toEqual({ title: 'Marcar «Sesión con 3.º grado» como pendiente' });
  });

  it('un borrado saca el nombre de lo que hay en la tablet', () => {
    // La mutación solo guarda un id: sin la caché, "Eliminar el evento e-1" no
    // le dice nada a nadie.
    expect(describeMutation({ kind: 'event.remove', targetId: 'e-1' }, LOOKUP)).toEqual({
      title: 'Eliminar el evento «Sesión con 3.º grado»',
    });
  });

  it('y si no hay nada en la tablet, cae en un texto que igual se entiende', () => {
    expect(describeMutation({ kind: 'event.remove', targetId: 'e-desconocido' })).toEqual({
      title: 'Eliminar un evento de tu calendario',
    });
    expect(describeMutation({ kind: 'post.like', postId: 999 })).toEqual({
      title: 'Me gusta en una publicación',
      detail: undefined,
    });
  });

  it('una publicación se resume, no se vuelca entera', () => {
    const largo = 'palabra '.repeat(40);
    const { title, detail } = describeMutation({
      kind: 'post.create',
      tempId: 1e12,
      input: { text: largo },
    });
    expect(title).toBe('Publicación en Comunidad');
    expect(detail!.length).toBeLessThanOrEqual(90);
    expect(detail!.endsWith('…')).toBe(true);
  });

  it('un comentario se cita', () => {
    expect(
      describeMutation({ kind: 'post.comment', postId: 7, input: { text: 'qué buena idea' } }),
    ).toEqual({ title: 'Comentario: «qué buena idea»' });
  });

  it('una reacción dice sobre qué publicación era', () => {
    expect(describeMutation({ kind: 'post.like', postId: 7 }, LOOKUP).detail).toContain(
      'Compartí una actividad',
    );
  });
});

describe('sync-problem-text · la fila entera', () => {
  const row = (kind: string, payload: unknown): DeadLetterRecord => ({
    id: 'm1',
    userId: 'ana',
    kind,
    payload,
    chainKey: 'profile',
    createdAt: 0,
    attempts: 3,
    nextAttemptAt: 0,
    failedAt: Date.now(),
    reason: 'El servidor no aceptó el cambio.',
  });

  it('reensambla la mutación guardada', () => {
    expect(describeRecord(row('profile.update', { input: { name: 'Ana' } })).title).toBe(
      'Cambios en tu perfil',
    );
  });

  it('una fila que esta versión ya no entiende se dice sin tecnicismos', () => {
    expect(describeRecord(row('post.reaccion-retirada', {})).title).toBe(
      'Un cambio que esta versión de la app ya no reconoce',
    );
  });

  it('enseña cuántas veces se intentó', () => {
    // Sin ese número nadie sabe si tiene sentido volver a pulsar "Reintentar".
    expect(describeAttempts(row('profile.update', {}), 'hace 2 h')).toBe(
      'Falló hace 2 h · 3 intentos',
    );
    expect(describeAttempts({ ...row('profile.update', {}), attempts: 1 }, 'hace 5 min')).toBe(
      'Falló hace 5 min · 1 intento',
    );
    expect(describeAttempts({ ...row('profile.update', {}), attempts: 0 }, null)).toBe(
      'Falló hace un momento',
    );
  });
});
