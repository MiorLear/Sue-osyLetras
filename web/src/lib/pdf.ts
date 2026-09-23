import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

// pdf.js, en un solo sitio. Este módulo SOLO se importa de forma perezosa (desde
// el lector y desde el CMS): pesa más que el resto del bundle de las docentes y
// no tiene por qué bajarse para ver los estantes.
//
// Build `legacy` a propósito: la moderna da por hechas APIs que los teléfonos
// viejos de algunas docentes no tienen, y ahí el lector se quedaría en blanco.
//
// `useWasm: false` porque la CSP de firebase.json no permite
// 'wasm-unsafe-eval'. Lo que se pierde es el decodificador rápido de JPEG 2000,
// que casi ningún PDF exportado de Word o Canva usa.

GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfDocument = PDFDocumentProxy;

export async function openPdf(data: ArrayBuffer | Uint8Array): Promise<PdfDocument> {
  return getDocument({ data, useWasm: false }).promise;
}

/** Suelta el documento y su worker. En pdf.js 6 se cierra por su tarea de carga. */
export function closePdf(doc: PdfDocument): Promise<void> {
  return doc.loadingTask.destroy();
}

/** Ancho/alto de la página 1, para darle al libro su proporción real. */
export async function firstPageAspect(doc: PdfDocument): Promise<number> {
  const page = await doc.getPage(1);
  const { width, height } = page.getViewport({ scale: 1 });
  return width / height;
}

/**
 * Pinta la página `pageNumber` (desde 1) en el canvas, a `cssWidth` píxeles de
 * ancho en pantalla. La densidad sigue al `devicePixelRatio` pero con tope: a 3×
 * un teléfono con 80 páginas abiertas se queda sin memoria.
 */
export async function renderPage(
  doc: PdfDocument,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  cssWidth: number,
): Promise<void> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const dpr = Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, 2);
  const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await page.render({ canvas, viewport }).promise;
  page.cleanup();
}

/** La primera página como JPEG, para la portada automática de un libro. */
export async function renderCover(data: ArrayBuffer, width = 600): Promise<Blob> {
  const doc = await openPdf(data);
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: width / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Este navegador no puede dibujar la portada.');
    // Fondo blanco: un PDF con página transparente daría una portada negra en JPEG.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, viewport }).promise;
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la portada.'))), 'image/jpeg', 0.85),
    );
  } finally {
    await closePdf(doc);
  }
}
