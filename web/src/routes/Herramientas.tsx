import { Suspense, lazy, useCallback, useState } from 'react';

import type { ToolBook } from '@explorarte/shared';

import { CacheAgeNote, ContentState } from '@/components/ContentState';
import { Masthead } from '@/components/Masthead';
import { MediaViewer } from '@/components/MediaViewer';
import { ScreenIntroHero } from '@/components/ScreenIntroHero';
import { VideoPlaceholder } from '@/components/VideoPlaceholder';
import { BibliographyGrid } from '@/components/library/BibliographyGrid';
import { Bookshelf } from '@/components/library/Bookshelf';
import { isPdf } from '@/components/library/book-utils';
import { api } from '@/lib/api';
import { cacheKeys } from '@/lib/cache-keys';
import { TOOLS_FALLBACK_INTRO } from '@/lib/tools-intro';
import { useOfflineAsync } from '@/lib/useOfflineAsync';

// pdf.js y page-flip viajan solo con el lector, y solo cuando se abre un libro.
const BookReader = lazy(() => import('@/components/library/BookReader'));


export default function Herramientas() {
  const {
    data: tools,
    status,
    ageMs,
    reload,
  } = useOfflineAsync(cacheKeys.tools(), () => api.tools.get(), []);
  const { data: intro } = useOfflineAsync(
    cacheKeys.screenIntro('tools'),
    () => api.screenIntros.get('tools'),
    [],
  );
  const [open, setOpen] = useState<ToolBook | null>(null);
  const close = useCallback(() => setOpen(null), []);

  // Un caché escrito por la versión anterior no trae estantes: se trata como
  // vacío en vez de romper la pantalla hasta que llegue la respuesta nueva.
  const shelves = (tools?.shelves ?? []).filter((s) => s.books.length > 0);
  const bibliography = tools?.bibliographyItems ?? [];

  return (
    <div className="page">
      <Masthead
        eyebrow="Caja de herramientas"
        title="Tu biblioteca para"
        accent="la práctica"
        lede="Manuales, guías y recursos para leer aquí mismo, descargar o compartir, y bibliografía para seguir aprendiendo."
      />

      <CacheAgeNote status={status} ageMs={ageMs} />

      <ScreenIntroHero variant="card" paragraphs={intro?.paragraphs} fallback={TOOLS_FALLBACK_INTRO} marginBottom={16} />

      <div style={{ marginBottom: 22 }}>
        <VideoPlaceholder caption="Cómo utilizar los recursos disponibles" video={intro?.video ?? null} duration="44 s" fallbackUrl="/videos/herramientas.mp4" />
      </div>

      {tools ? (
        <>
          <div className="library">
            {shelves.length === 0 ? (
              <p className="library__empty">Aún no hay libros en la biblioteca.</p>
            ) : (
              shelves.map((shelf) => <Bookshelf key={shelf.id} shelf={shelf} onOpen={setOpen} />)
            )}
          </div>

          <section className="library__section" aria-labelledby="biblio-title">
            <h3 id="biblio-title" className="shelf__title">Bibliografía sugerida</h3>
            <p className="library__lede">
              Lecturas para profundizar en bienestar emocional y desarrollo socioemocional.
            </p>
            <BibliographyGrid entries={bibliography} />
          </section>
        </>
      ) : (
        <ContentState status={status} onRetry={reload} what="las herramientas" />
      )}

      {open && isPdf(open.file) ? (
        <Suspense
          fallback={
            <div className="reader" role="status">
              <div className="reader__state">
                <span className="reader__spinner" aria-hidden="true" />
                <p>Abriendo el libro…</p>
              </div>
            </div>
          }>
          <BookReader book={open} onClose={close} />
        </Suspense>
      ) : open ? (
        <MediaViewer item={{ ...open.file, title: open.title }} onClose={close} />
      ) : null}
    </div>
  );
}
