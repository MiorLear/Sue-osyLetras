import { describe, expect, it } from 'vitest';

import {
  hasMorePages,
  isPageEnvelope,
  listItems,
  mergePage,
  totalCount,
  type PageEnvelope,
} from '@/lib/pagination';

// La Ola 1 hizo opt-in la paginación: sin ?page/?size los endpoints de lista
// siguen devolviendo un array, y con cualquiera de los dos, un sobre. La caché
// guarda lo que le den, así que quien lee tiene que servir ambas formas.

const envelope: PageEnvelope<{ id: number }> = {
  items: [{ id: 1 }, { id: 2 }],
  page: 0,
  size: 2,
  total: 5,
  pages: 3,
  hasMore: true,
};

describe('pagination · las dos formas de una lista', () => {
  it('reconoce el sobre y no confunde un array con él', () => {
    expect(isPageEnvelope(envelope)).toBe(true);
    expect(isPageEnvelope([{ id: 1 }])).toBe(false);
    expect(isPageEnvelope(null)).toBe(false);
    expect(isPageEnvelope({ total: 3 })).toBe(false);
  });

  it('listItems saca las filas de cualquiera de las dos', () => {
    expect(listItems(envelope)).toEqual([{ id: 1 }, { id: 2 }]);
    expect(listItems([{ id: 9 }])).toEqual([{ id: 9 }]);
  });

  it('listItems tolera undefined (nada cacheado todavía)', () => {
    expect(listItems(undefined)).toEqual([]);
    expect(listItems(null)).toEqual([]);
  });

  it('un array suelto es la lista entera: no hay más páginas', () => {
    expect(hasMorePages([{ id: 1 }])).toBe(false);
    expect(hasMorePages(envelope)).toBe(true);
  });

  it('totalCount usa el total del servidor o la longitud del array', () => {
    expect(totalCount(envelope)).toBe(5);
    expect(totalCount([{ id: 1 }, { id: 2 }, { id: 3 }])).toBe(3);
  });
});

describe('pagination · mergePage', () => {
  it('acumula páginas en vez de quedarse solo con la última', () => {
    const page0: PageEnvelope<{ id: number }> = { ...envelope, items: [{ id: 1 }, { id: 2 }] };
    const page1: PageEnvelope<{ id: number }> = {
      ...envelope,
      page: 1,
      items: [{ id: 3 }],
      hasMore: false,
    };

    const merged = mergePage(page0, page1);
    expect(listItems(merged).map((r) => r.id)).toEqual([1, 2, 3]);
    expect(hasMorePages(merged)).toBe(false);
  });

  it('de-duplica por id y se queda con la copia más nueva', () => {
    const cached = [{ id: 1, titulo: 'viejo' }];
    const fresh = [{ id: 1, titulo: 'nuevo' }, { id: 2, titulo: 'otro' }];

    const merged = listItems(mergePage(cached, fresh));
    expect(merged).toHaveLength(2);
    expect(merged[0]).toEqual({ id: 1, titulo: 'nuevo' });
  });

  it('conserva la forma de lo que llega', () => {
    expect(Array.isArray(mergePage([{ id: 1 }], [{ id: 2 }]))).toBe(true);
    expect(isPageEnvelope(mergePage([{ id: 1 }], envelope))).toBe(true);
  });

  it('funciona sin nada cacheado', () => {
    expect(listItems(mergePage(undefined, [{ id: 1 }]))).toEqual([{ id: 1 }]);
  });
});
