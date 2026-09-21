import { describe, expect, it } from 'vitest';
import type { LearningProgressEntry, SubTopic } from '@explorarte/shared';

import {
  completedCount,
  currentStepIndex,
  effectiveProgress,
  progressId,
  stepState,
} from '@/lib/learning-progress';

const fase = (key: string): SubTopic => ({
  key,
  emoji: '',
  title: key,
  blocks: [],
  pdfs: [],
  videos: [],
  audios: [],
});

const FASES = [fase('uno'), fase('dos'), fase('tres')];

const hecho = (stepKey: string): LearningProgressEntry => ({
  topicId: 't',
  stepKey,
  completedAt: '2026-09-20T00:00:00.000Z',
});

describe('effectiveProgress', () => {
  it('sin nada pendiente, manda el servidor', () => {
    const done = effectiveProgress([hecho('uno')], new Map());
    expect([...done]).toEqual([progressId('t', 'uno')]);
  });

  // Este es el caso por el que existe la superposición: la docente desmarca sin
  // conexión, la sincronización trae un GET rancio que todavía la da por hecha,
  // y sin esto la fase se volvería a marcar sola delante de ella.
  it('un desmarcado pendiente gana a un servidor que aún dice «completada»', () => {
    const pending = new Map([[progressId('t', 'uno'), false]]);
    expect(effectiveProgress([hecho('uno')], pending).has(progressId('t', 'uno'))).toBe(false);
  });

  it('un marcado pendiente se pinta aunque el servidor no lo tenga', () => {
    const pending = new Map([[progressId('t', 'dos'), true]]);
    expect(effectiveProgress([], pending).has(progressId('t', 'dos'))).toBe(true);
  });

  it('aguanta que el servidor no haya respondido todavía', () => {
    expect(effectiveProgress(null, new Map()).size).toBe(0);
    expect(effectiveProgress(undefined, new Map()).size).toBe(0);
  });
});

describe('completedCount', () => {
  it('cuenta solo las fases que el tema tiene hoy', () => {
    // Una fase borrada desde el CMS deja su fila en el servidor —a propósito,
    // para que el avance vuelva si la fase vuelve— y sin el cruce el contador
    // diría "4 de 3".
    const done = effectiveProgress([hecho('uno'), hecho('borrada')], new Map());
    expect(completedCount(FASES, 't', done)).toBe(1);
  });
});

describe('currentStepIndex', () => {
  it('es la primera sin completar', () => {
    expect(currentStepIndex(FASES, 't', effectiveProgress([hecho('uno')], new Map()))).toBe(1);
  });

  it('con un hueco, la actual es el hueco y no la siguiente sin tocar', () => {
    const done = effectiveProgress([hecho('dos')], new Map());
    expect(currentStepIndex(FASES, 't', done)).toBe(0);
  });

  it('con todo hecho señala la última, no al vacío', () => {
    const done = effectiveProgress([hecho('uno'), hecho('dos'), hecho('tres')], new Map());
    expect(currentStepIndex(FASES, 't', done)).toBe(2);
  });

  it('un tema sin fases no devuelve un índice negativo', () => {
    expect(currentStepIndex([], 't', new Set())).toBe(0);
  });
});

describe('stepState', () => {
  it('completada gana a todo lo demás', () => {
    expect(stepState(5, 0, true)).toBe('completed');
  });

  it('la actual es la que marca el índice', () => {
    expect(stepState(1, 1, false)).toBe('current');
    expect(stepState(2, 1, false)).toBe('locked');
  });
});
