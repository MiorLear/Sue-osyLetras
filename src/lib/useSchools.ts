import { useEffect, useState } from 'react';

import { INSTITUCIONES } from '@/constants/theme';
import { api } from '@/lib/api';

/** Institution list for the dropdowns. Starts with the built-in list and merges
 * in the ones already registered by teachers (GET /schools), so a newly added
 * institution shows up for everyone. Falls back to the built-in list on error. */
export function useSchools(): string[] {
  const [schools, setSchools] = useState<string[]>(() => [...INSTITUCIONES]);

  useEffect(() => {
    let active = true;
    api.misc
      .schools()
      .then((list) => {
        if (!active || !Array.isArray(list)) return;
        const merged = Array.from(
          new Set([...INSTITUCIONES, ...list].map((s) => (s ?? '').trim()).filter(Boolean)),
        ).sort((a, b) => a.localeCompare(b, 'es'));
        setSchools(merged);
      })
      .catch(() => {
        /* keep the built-in list */
      });
    return () => {
      active = false;
    };
  }, []);

  return schools;
}
