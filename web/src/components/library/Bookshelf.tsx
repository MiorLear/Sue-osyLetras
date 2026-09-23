import type { ToolBook, ToolShelf } from '@explorarte/shared';

import { BookCover } from './BookCover';
import { fileBadge, isPdf } from './book-utils';

/**
 * Un estante: el título de la categoría y sus libros de pie sobre una repisa.
 * En el teléfono los libros se deslizan de lado; en la computadora se reparten
 * en varias filas, cada una con su repisa.
 */
export function Bookshelf({ shelf, onOpen }: { shelf: ToolShelf; onOpen: (book: ToolBook) => void }) {
  const headingId = `shelf-${shelf.id}`;
  return (
    <section className="shelf" aria-labelledby={headingId}>
      <div className="shelf__head">
        <h3 id={headingId} className="shelf__title">{shelf.title}</h3>
        <span className="shelf__count">
          {shelf.books.length} {shelf.books.length === 1 ? 'libro' : 'libros'}
        </span>
      </div>
      <ul className="shelf__row">
        {shelf.books.map((book) => {
          const readable = isPdf(book.file);
          return (
            <li key={book.id} className="shelf__slot">
              <button
                type="button"
                className="book"
                onClick={() => onOpen(book)}
                aria-label={`${readable ? 'Leer' : 'Abrir'} ${book.title}${book.author ? `, de ${book.author}` : ''}${readable ? '' : ` (${fileBadge(book.file)})`}`}>
                <BookCover book={book} />
                <span className="book__title">{book.title}</span>
                {book.author ? <span className="book__author">{book.author}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
