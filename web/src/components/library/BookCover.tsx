import { useState } from 'react';

import type { ToolBook } from '@explorarte/shared';

import { clothFor, coverOf, fileBadge } from './book-utils';

/**
 * La tapa del libro. Con imagen, la imagen; sin ella —o si no carga, que sin
 * conexión es lo normal para una portada nunca vista— una tapa de tela con el
 * título, que no necesita red para pintarse.
 */
export function BookCover({ book }: { book: ToolBook }) {
  const cover = coverOf(book);
  const [broken, setBroken] = useState<string | null>(null);
  const showImage = cover && broken !== cover.url;
  const [from, to] = clothFor(book.id);

  return (
    <span className="book-cover" aria-hidden="true">
      {showImage ? (
        <img
          src={cover.url}
          alt=""
          loading="lazy"
          decoding="async"
          className="book-cover__img"
          onError={() => setBroken(cover.url)}
        />
      ) : (
        <span className="book-cover__cloth" style={{ background: `linear-gradient(150deg, ${from}, ${to})` }}>
          <span className="book-cover__title">{book.title}</span>
          {book.author ? <span className="book-cover__author">{book.author}</span> : null}
          <span className="book-cover__badge">{fileBadge(book.file)}</span>
        </span>
      )}
      <span className="book-cover__spine" />
    </span>
  );
}
