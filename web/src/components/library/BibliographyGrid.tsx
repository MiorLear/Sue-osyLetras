import { useState } from 'react';

import type { BibliographyEntry } from '@explorarte/shared';

import { Icon } from '@/components/Icon';

import { clothFor } from './book-utils';

function EntryImage({ entry }: { entry: BibliographyEntry }) {
  const [broken, setBroken] = useState(false);
  const [from, to] = clothFor(entry.id);
  if (entry.image && !broken) {
    return (
      <img
        src={entry.image.url}
        alt=""
        loading="lazy"
        decoding="async"
        className="biblio__img"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span className="biblio__img biblio__img--cloth" style={{ background: `linear-gradient(150deg, ${from}, ${to})` }}>
      <span aria-hidden="true">📚</span>
    </span>
  );
}

export function BibliographyGrid({ entries }: { entries: BibliographyEntry[] }) {
  if (entries.length === 0) {
    return <p className="library__empty">Aún no hay bibliografía sugerida.</p>;
  }
  return (
    <ul className="biblio">
      {entries.map((entry) => (
        <li key={entry.id} className="biblio__card">
          <EntryImage entry={entry} />
          <div className="biblio__body">
            <span className="biblio__title">{entry.title}</span>
            {entry.author ? <span className="biblio__author">{entry.author}</span> : null}
            {entry.url ? (
              <a
                className="biblio__link"
                href={entry.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Ver ${entry.title} (se abre en otra pestaña)`}>
                Ver libro <Icon name="external-link" size={13} color="var(--brand-dark)" />
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
