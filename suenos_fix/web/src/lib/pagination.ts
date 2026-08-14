// The Ola 1 API made pagination opt-in on the list endpoints (/posts, /events,
// /admin/users): with no ?page/?size they still return a bare array (capped at
// 200), and with either of them they return an envelope. Cached responses
// therefore come back in one of two shapes depending on how they were fetched —
// possibly a different one from the shape the same key was written with, if a
// screen starts paginating in a later release.
//
// The cache stores whatever JSON it is handed; these helpers let every consumer
// read a cached list without caring which shape it got.

/** RFC-ish page envelope returned when ?page or ?size is present. */
export interface PageEnvelope<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
  pages: number;
  hasMore: boolean;
}

export type ListResponse<T> = T[] | PageEnvelope<T>;

export function isPageEnvelope<T>(value: unknown): value is PageEnvelope<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Array.isArray((value as { items?: unknown }).items)
  );
}

/** The rows of a list response, whichever shape it arrived in. */
export function listItems<T>(value: ListResponse<T> | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (isPageEnvelope<T>(value)) return value.items;
  return [];
}

/** True when another page follows. A bare array is the whole (capped) list. */
export function hasMorePages(value: unknown): boolean {
  return isPageEnvelope(value) ? value.hasMore : false;
}

/** Total row count the server reports, or the array's own length. */
export function totalCount(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  return isPageEnvelope(value) ? value.total : 0;
}

/**
 * Appends a freshly fetched page onto what is already cached, so an offline
 * reader keeps the pages it had rather than only the last one fetched.
 * De-duplicates by `id` because a row can shift between pages when the
 * underlying list changes.
 */
export function mergePage<T extends { id?: string | number }>(
  cached: ListResponse<T> | undefined,
  incoming: ListResponse<T>,
): ListResponse<T> {
  const previous = listItems(cached);
  const next = listItems(incoming);

  const seen = new Set<string | number>();
  const merged: T[] = [];
  for (const row of [...previous, ...next]) {
    const id = row?.id;
    if (id !== undefined && id !== null) {
      if (seen.has(id)) {
        // Keep the newer copy: replace in place rather than dropping it.
        merged[merged.findIndex((r) => r.id === id)] = row;
        continue;
      }
      seen.add(id);
    }
    merged.push(row);
  }

  if (isPageEnvelope<T>(incoming)) return { ...incoming, items: merged };
  return merged;
}
