import { useCallback, useEffect, useRef, useState } from 'react';
import { PageFlip } from 'page-flip';

import type { ToolBook } from '@explorarte/shared';

import { Icon } from '@/components/Icon';
import { toast } from '@/components/toast-store';
import {
  MediaDownloadError,
  download,
  getLocalBlob,
  isCacheStorageAvailable,
  mediaVersion,
  needsUpdate,
} from '@/lib/media-cache';
import { canShareFiles, openFile, reportDownloadError, saveFile, shareFile } from '@/lib/open-file';
import { closePdf, firstPageAspect, openPdf, renderPage, type PdfDocument } from '@/lib/pdf';
import { useIsOnline } from '@/lib/useNetworkStatus';

// El lector de libros de la Caja de herramientas: el PDF pintado página a
// página con pdf.js dentro de StPageFlip, que es quien dibuja la hoja
// doblándose al pasarla.
//
// Se carga de forma perezosa (React.lazy desde Herramientas): pdf.js y
// page-flip no viajan con el resto de la app.
//
// Dos decisiones que no son obvias:
//
//   * Las páginas las crea este componente A MANO, fuera de React. StPageFlip
//     mueve los nodos a su propio contenedor; si fueran de React, el siguiente
//     render o el desmontaje chocaría contra nodos que ya no están donde los dejó.
//   * Solo se pintan las páginas cerca de la abierta. Un canvas por página a
//     densidad de pantalla son decenas de MB en un libro de 80 páginas, que es
//     justo lo que un teléfono modesto no tiene.

/** Páginas pintadas alrededor de la abierta (hacia atrás / hacia delante). */
const RENDER_BEHIND = 2;
const RENDER_AHEAD = 3;
/** Más allá de esto se suelta el canvas para devolver la memoria. */
const KEEP_RADIUS = 7;

type Phase =
  | { kind: 'loading'; ratio?: number }
  | { kind: 'offline' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; doc: PdfDocument; aspect: number };

const pageKey = (id: string) => `explorarte:reader:${id}`;

function savedPage(id: string): number {
  try {
    const n = Number(localStorage.getItem(pageKey(id)));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function rememberPage(id: string, page: number) {
  try {
    localStorage.setItem(pageKey(id), String(page));
  } catch {
    /* sin almacenamiento: se empieza desde el principio la próxima vez */
  }
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Los bytes del libro: la copia local si está al día; si no, se descarga (y se queda guardada). */
async function loadBytes(
  book: ToolBook,
  online: boolean,
  onProgress: (ratio: number | undefined) => void,
): Promise<Blob | null> {
  const { file } = book;
  const cached = await getLocalBlob(file.id);
  if (cached && (!online || !(await needsUpdate(file.id, mediaVersion(file))))) return cached;
  if (!online) return null;
  if (!isCacheStorageAvailable()) {
    const res = await fetch(file.url);
    if (!res.ok) throw new MediaDownloadError(`El servidor respondió ${res.status}.`, file.id);
    return res.blob();
  }
  await download(file.id, file.url, { version: mediaVersion(file), onProgress: (p) => onProgress(p.ratio) });
  return getLocalBlob(file.id);
}

export default function BookReader({ book, onClose }: { book: ToolBook; onClose: () => void }) {
  const online = useIsOnline();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<PageFlip | null>(null);
  const renderRef = useRef<((center: number) => void) | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const reduced = prefersReducedMotion();

  // ── cargar el PDF ────────────────────────────────────────────────────────
  // `online` se lee al abrir y no es dependencia: perder la red a mitad de
  // lectura no tiene por qué cerrar un libro que ya está en memoria.
  const onlineAtOpen = useRef(online);
  useEffect(() => {
    let active = true;
    let doc: PdfDocument | null = null;
    void (async () => {
      try {
        const blob = await loadBytes(book, onlineAtOpen.current, (ratio) => {
          if (active) setPhase({ kind: 'loading', ratio });
        });
        if (!active) return;
        if (!blob) {
          setPhase({ kind: 'offline' });
          return;
        }
        // Response y no blob.arrayBuffer(): Safari anterior a 14 no tiene el segundo.
        doc = await openPdf(new Uint8Array(await new Response(blob).arrayBuffer()));
        const aspect = await firstPageAspect(doc);
        if (!active) {
          void closePdf(doc);
          return;
        }
        setTotal(doc.numPages);
        setPhase({ kind: 'ready', doc, aspect });
      } catch (e) {
        if (!active) return;
        if (e instanceof MediaDownloadError) {
          reportDownloadError(e);
          setPhase({ kind: 'error', message: e.message });
        } else {
          setPhase({ kind: 'error', message: 'No se pudo abrir este PDF. Puedes descargarlo o abrirlo en otra app.' });
        }
      }
    })();
    return () => {
      active = false;
      if (doc) void closePdf(doc);
    };
  }, [book]);

  // ── armar el libro ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase.kind !== 'ready') return;
    const host = hostRef.current;
    if (!host) return;
    const { doc, aspect } = phase;
    const n = doc.numPages;

    const bookEl = document.createElement('div');
    bookEl.className = 'reader__book';
    host.appendChild(bookEl);

    const canvases: HTMLCanvasElement[] = [];
    const pages: HTMLElement[] = [];
    for (let i = 0; i < n; i++) {
      const pageEl = document.createElement('div');
      pageEl.className = 'reader__page';
      // Tapa y contratapa duras, como un libro de verdad; el resto se dobla.
      pageEl.dataset.density = i === 0 || i === n - 1 ? 'hard' : 'soft';
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      pageEl.appendChild(canvas);
      bookEl.appendChild(pageEl);
      canvases.push(canvas);
      pages.push(pageEl);
    }

    const rendered = new Set<number>();
    let queue: Promise<void> = Promise.resolve();
    let disposed = false;

    const renderAround = (center: number) => {
      for (let i = 0; i < n; i++) {
        if (Math.abs(i - center) > KEEP_RADIUS && rendered.has(i)) {
          canvases[i].width = 0;
          canvases[i].height = 0;
          rendered.delete(i);
        }
      }
      // La abierta primero, después las siguientes, al final las de atrás.
      const order: number[] = [center];
      for (let d = 1; d <= RENDER_AHEAD; d++) order.push(center + d);
      for (let d = 1; d <= RENDER_BEHIND; d++) order.push(center - d);
      for (const i of order) {
        if (i < 0 || i >= n || rendered.has(i)) continue;
        rendered.add(i);
        queue = queue.then(async () => {
          if (disposed) return;
          // Las páginas que StPageFlip tiene escondidas miden 0: el ancho sale del
          // libro entero, completo en vertical y la mitad con el libro abierto.
          const bookWidth = bookEl.clientWidth || host.clientWidth || 400;
          const width = flip.getOrientation() === 'portrait' ? bookWidth : bookWidth / 2;
          try {
            await renderPage(doc, i + 1, canvases[i], width);
          } catch {
            rendered.delete(i);
          }
        });
      }
    };

    const baseWidth = 560;
    const start = Math.min(savedPage(book.id), n - 1);
    const flip = new PageFlip(bookEl, {
      width: baseWidth,
      height: Math.round(baseWidth / aspect),
      size: 'stretch',
      // StPageFlip pasa a una sola página cuando el espacio es menor que dos
      // veces esto. Con 300, un teléfono (≤ 600 px) lee página a página, a todo
      // el ancho; una tableta o una computadora ven el libro abierto en dos.
      minWidth: 300,
      maxWidth: 1600,
      minHeight: 200,
      maxHeight: 2400,
      showCover: true,
      usePortrait: true,
      mobileScrollSupport: false,
      maxShadowOpacity: reduced ? 0 : 0.45,
      drawShadow: !reduced,
      showPageCorners: !reduced,
      // Con movimiento reducido la página cambia sin animación.
      flippingTime: reduced ? 1 : 750,
      startPage: start,
    });
    flip.loadFromHTML(pages);
    flipRef.current = flip;
    renderRef.current = renderAround;
    setPage(start);
    renderAround(start);

    flip.on('flip', (e) => {
      setPage(e.data);
      rememberPage(book.id, e.data);
      renderAround(e.data);
    });
    // Al girar el teléfono cambia el ancho de cada página: se repintan a la medida nueva.
    flip.on('changeOrientation', () => {
      rendered.clear();
      renderAround(flip.getCurrentPageIndex());
    });

    return () => {
      disposed = true;
      flipRef.current = null;
      renderRef.current = null;
      try {
        flip.destroy();
      } catch {
        /* ya desmontado */
      }
      host.innerHTML = '';
    };
  }, [phase, book.id, reduced]);

  // ── teclado y foco ───────────────────────────────────────────────────────
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') flipRef.current?.flipNext();
      else if (e.key === 'ArrowLeft') flipRef.current?.flipPrev();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  const act = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }, []);

  const share = () =>
    act(async () => {
      if (canShareFiles()) return shareFile(book.file, online);
      // Sin compartir archivos (casi todo escritorio): se comparte el enlace.
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title: book.title, url: book.file.url });
        } catch (e) {
          if (!(e instanceof DOMException && e.name === 'AbortError')) toast.error('No se pudo compartir.');
        }
        return;
      }
      try {
        await navigator.clipboard.writeText(book.file.url);
        toast.success('Enlace copiado. Pégalo donde quieras compartirlo.');
      } catch {
        toast.error('No se pudo copiar el enlace.');
      }
    });

  const goTo = (n: number) => {
    const flip = flipRef.current;
    if (!flip) return;
    flip.turnToPage(n);
    // turnToPage no dispara 'flip': se sincroniza a mano.
    setPage(n);
    rememberPage(book.id, n);
    renderRef.current?.(n);
  };

  return (
    <div className="reader" role="dialog" aria-modal="true" aria-label={book.title}>
      <header className="reader__bar">
        <div className="reader__heading">
          <span className="reader__title">{book.title}</span>
          {book.author ? <span className="reader__author">{book.author}</span> : null}
        </div>
        <button ref={closeRef} type="button" className="reader__icon-btn" onClick={onClose} aria-label="Cerrar libro">
          <Icon name="x" size={18} color="#fff" />
        </button>
      </header>

      <div className="reader__stage">
        {phase.kind === 'loading' ? (
          <div className="reader__state">
            <span className="reader__spinner" aria-hidden="true" />
            <p>
              {phase.ratio === undefined ? 'Abriendo el libro…' : `Descargando… ${Math.round(phase.ratio * 100)}%`}
            </p>
          </div>
        ) : phase.kind === 'offline' ? (
          <div className="reader__state">
            <span aria-hidden="true" style={{ fontSize: 34 }}>📡</span>
            <p>Sin conexión, y este libro todavía no está guardado en este dispositivo.</p>
            <p className="reader__hint">Ábrelo una vez con internet y quedará disponible sin conexión.</p>
          </div>
        ) : phase.kind === 'error' ? (
          <div className="reader__state">
            <span aria-hidden="true" style={{ fontSize: 34 }}>📕</span>
            <p>{phase.message}</p>
          </div>
        ) : null}
        <div ref={hostRef} className="reader__host" hidden={phase.kind !== 'ready'} />
        {phase.kind === 'ready' ? (
          <>
            <button type="button" className="reader__turn reader__turn--prev" onClick={() => flipRef.current?.flipPrev()} disabled={page <= 0} aria-label="Página anterior">
              <Icon name="chevron-left" size={22} color="#fff" />
            </button>
            <button type="button" className="reader__turn reader__turn--next" onClick={() => flipRef.current?.flipNext()} disabled={page >= total - 1} aria-label="Página siguiente">
              <Icon name="chevron-right" size={22} color="#fff" />
            </button>
          </>
        ) : null}
      </div>

      <footer className="reader__footer">
        {phase.kind === 'ready' && total > 1 ? (
          <div className="reader__progress">
            <input
              type="range"
              min={1}
              max={total}
              value={page + 1}
              onChange={(e) => goTo(Number(e.target.value) - 1)}
              aria-label="Ir a la página"
              aria-valuetext={`Página ${page + 1} de ${total}`}
            />
            <span className="reader__count" aria-live="polite">
              Página {page + 1} de {total}
            </span>
          </div>
        ) : null}
        <div className="reader__actions">
          <button type="button" className="reader__action" disabled={busy} onClick={() => act(() => saveFile(book.file, online))}>
            <Icon name="download" size={16} color="#fff" /> Descargar
          </button>
          <button type="button" className="reader__action" disabled={busy} onClick={share}>
            <Icon name="send" size={16} color="#fff" /> Compartir
          </button>
          <button type="button" className="reader__action" disabled={busy} onClick={() => act(() => openFile(book.file, online))}>
            <Icon name="maximize" size={16} color="#fff" /> Abrir en otra app
          </button>
        </div>
      </footer>
    </div>
  );
}
