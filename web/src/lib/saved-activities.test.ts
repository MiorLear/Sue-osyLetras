import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clearEverything } from './idb';
import { setCacheUser } from './offline-cache';
import {
  activityId,
  clearSavedActivities,
  toggleSavedActivity,
  useSavedActivities,
} from './saved-activities';

// "Mis recursos" es lo único que la docente crea por su cuenta dentro de la
// app, así que las dos cosas que no pueden fallar son que sobreviva a recargar
// y que no se cruce entre usuarias de una misma tablet.

const ACTIVIDAD = {
  id: activityId('tristeza', 'El frasco de la calma'),
  title: 'El frasco de la calma',
  purpose: 'Reconocer la tristeza y darle un lugar seguro.',
  emotionId: 'tristeza',
  emotionName: 'Tristeza',
  emoji: '😢',
};

beforeEach(async () => {
  clearSavedActivities();
  setCacheUser(null);
  localStorage.clear();
  await clearEverything();
});

afterEach(cleanup);

describe('mis recursos', () => {
  it('guarda y quita una actividad', () => {
    const { result } = renderHook(() => useSavedActivities());
    expect(result.current).toEqual([]);

    act(() => {
      toggleSavedActivity(ACTIVIDAD);
    });
    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toMatchObject({ title: 'El frasco de la calma', emotionId: 'tristeza' });

    act(() => {
      toggleSavedActivity(ACTIVIDAD);
    });
    expect(result.current).toEqual([]);
  });

  it('lo último guardado va primero', () => {
    const { result } = renderHook(() => useSavedActivities());
    act(() => {
      toggleSavedActivity(ACTIVIDAD);
      toggleSavedActivity({ ...ACTIVIDAD, id: activityId('enojo', 'El semáforo'), title: 'El semáforo', emotionId: 'enojo' });
    });
    expect(result.current.map((i) => i.title)).toEqual(['El semáforo', 'El frasco de la calma']);
  });

  // Lo que se guarda tiene que seguir ahí mañana: si no, el botón miente.
  it('sobrevive a recargar la app', async () => {
    setCacheUser('ana');
    const first = renderHook(() => useSavedActivities());
    act(() => {
      toggleSavedActivity(ACTIVIDAD);
    });
    await waitFor(() => expect(first.result.current).toHaveLength(1));
    cleanup();

    // Recargar: la memoria del módulo se va, la caché se queda.
    clearSavedActivities();
    const second = renderHook(() => useSavedActivities());
    await waitFor(() => expect(second.result.current).toHaveLength(1));
    expect(second.result.current[0].title).toBe('El frasco de la calma');
  });

  // Tablet compartida: lo de una docente no puede aparecerle a la siguiente.
  it('no se cruza entre usuarias', async () => {
    setCacheUser('ana');
    const ana = renderHook(() => useSavedActivities());
    act(() => {
      toggleSavedActivity(ACTIVIDAD);
    });
    await waitFor(() => expect(ana.result.current).toHaveLength(1));
    cleanup();

    // Cerrar sesión y entrar con otra: AuthContext hace exactamente esto.
    clearSavedActivities();
    setCacheUser('bea');
    const bea = renderHook(() => useSavedActivities());
    await waitFor(() => expect(bea.result.current).toEqual([]));
  });
});
