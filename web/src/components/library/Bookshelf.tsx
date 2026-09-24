import { useState, type FocusEvent } from 'react';

import type { ToolBook, ToolShelf } from '@explorarte/shared';

import { BookCover } from './BookCover';
import { clothFor, fileBadge, isPdf } from './book-utils';

/**
 * Un estante: el título de la categoría y sus libros de pie sobre una repisa.
 * En el teléfono los libros se deslizan de lado; en la computadora se reparten
 * en varias filas, cada una con su repisa.
 *
 * Con cursor (o con el teclado), el libro señalado se adelanta, los demás se
 * apagan un poco y su descripción entra en la ficha que hay al lado del
 * estante. En pantallas táctiles no hay "pasar por encima": ahí la ficha no se
 * dibuja y el toque abre el libro directamente.
 */
export function Bookshelf({ shelf, onOpen }: { shelf: ToolShelf; onOpen: (book: ToolBook) => void }) {
  const headingId = `shelf-${shelf.id}`;
  const [active, setActive] = useState<ToolBook | null>(null);

  // Salir del estante con el foco limpia la ficha; moverse entre libros no.
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setActive(null);
  };

  return (
    <section className="shelf" aria-labelledby={headingId}>
      <div className="shelf__head">
        <h3 id={headingId} className="shelf__title">{shelf.title}</h3>
        <span className="shelf__count">
          {shelf.books.length} {shelf.books.length === 1 ? 'libro' : 'libros'}
        </span>
      </div>
      <div className="shelf__body" onMouseLeave={() => setActive(null)} onBlur={onBlur}>
        <ul className={`shelf__row${active ? ' shelf__row--browsing' : ''}`}>
          {shelf.books.map((book) => {
            const readable = isPdf(book.file);
            const descId = `book-desc-${shelf.id}-${book.id}`;
            return (
              <li key={book.id} className="shelf__slot">
                <button
                  type="button"
                  className={`book${active?.id === book.id ? ' book--active' : ''}`}
                  onClick={() => onOpen(book)}
                  onMouseEnter={() => setActive(book)}
                  onFocus={() => setActive(book)}
                  aria-label={`${readable ? 'Leer' : 'Abrir'} ${book.title}${book.author ? `, de ${book.author}` : ''}${readable ? '' : ` (${fileBadge(book.file)})`}`}
                  aria-describedby={book.description ? descId : undefined}>
                  <BookCover book={book} />
                  <span className="book__title">{book.title}</span>
                  {book.author ? <span className="book__author">{book.author}</span> : null}
                </button>
                {book.description ? (
                  <span id={descId} hidden>
                    {book.description}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>

        {/* Decorativa para lectores de pantalla: la descripción ya les llega por
            aria-describedby, y anunciar la ficha a cada paso sería ruido. */}
        <aside className="shelf__aside" aria-hidden="true">
          {active ? (
            <div
              key={active.id}
              className="shelf__detail"
              style={{ ['--accent' as string]: clothFor(active.id)[0] }}>
              <span className="shelf__detail-badge">{fileBadge(active.file)}</span>
              <span className="shelf__detail-title">{active.title}</span>
              {active.author ? <span className="shelf__detail-author">{active.author}</span> : null}
              <p className={`shelf__detail-text${active.description ? '' : ' shelf__detail-text--empty'}`}>
                {active.description || 'Este libro todavía no tiene descripción.'}
              </p>
              <span className="shelf__detail-cta">
                {isPdf(active.file) ? 'Clic para leer' : 'Clic para abrir'} <span aria-hidden="true">→</span>
              </span>
            </div>
          ) : (
            <p className="shelf__aside-hint">
              <span aria-hidden="true">📖</span>
              Pasa el cursor por un libro para ver de qué trata.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
