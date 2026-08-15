/**
 * Qué URL es un archivo de medios, y por tanto qué se puede cachear.
 *
 * Vive fuera de `sw.ts` a propósito, igual que `sw-navigation.ts`: lo importan
 * la página (`media-cache.ts`) y el worker, y así se puede testear sin un
 * `ServiceWorkerGlobalScope`. Que sea un solo módulo importa porque los dos
 * lados tienen que coincidir exactamente: si el worker enruta una URL que la
 * página no considera medio, cachea algo que nadie va a leer; si la página
 * guarda una que el worker no enruta, la descarga no sirve de nada sin red.
 *
 * LA REGLA QUE NO SE PUEDE ROMPER: esto nunca puede dar verdadero para
 * `/api/**`. Todo GET a la API lleva `Authorization: Bearer` y Spring no manda
 * `Vary: Authorization`, así que una entrada de caché indexada por URL le daría
 * el perfil de una docente a la siguiente que abra la tablet. Los medios son lo
 * único público y sin autenticar, y por eso son lo único que el worker toca.
 */

/** Almacenes de objetos que sirven medios directamente. */
const STORAGE_HOSTS = [/^storage\.googleapis\.com$/, /\.supabase\.co$/];

/**
 * Parámetros que delatan una URL firmada. Una firma caduca y es distinta en
 * cada petición, así que cachear por esa URL crea una entrada nueva cada vez
 * que nunca se vuelve a acertar: ocupa espacio y no sirve a nadie. La URL
 * canónica (`/media/**`) es la que se guarda; ella redirige a la firmada.
 */
const SIGNATURE_PARAMS = ['X-Goog-Signature', 'X-Amz-Signature', 'Signature', 'token'];

function parse(href: string): URL | null {
  try {
    return new URL(href);
  } catch {
    return null;
  }
}

function isSigned(url: URL): boolean {
  return SIGNATURE_PARAMS.some((p) => url.searchParams.has(p));
}

/**
 * True si `href` es un archivo de medios cacheable.
 *
 * Casa la ruta canónica `/media/**` en cualquier origen —en producción es el
 * propio dominio vía el rewrite de Firebase Hosting, en dev/staging es Cloud
 * Run o Render— y los almacenes de objetos conocidos mientras la URL no venga
 * firmada.
 */
export function isMediaUrl(href: string): boolean {
  const url = parse(href);
  if (!url) return false;
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;

  // Explícito aunque ninguna regla de abajo lo permitiría: el día que alguien
  // añada un patrón nuevo, esta línea sigue aquí.
  if (url.pathname.startsWith('/api/')) return false;

  if (url.pathname.startsWith('/media/')) return true;

  return STORAGE_HOSTS.some((re) => re.test(url.hostname)) && !isSigned(url);
}

/**
 * True si el medio se sirve desde el mismo origen que la app.
 *
 * Decide si se puede comprobar la frescura de verdad. `ETag` **no** es una
 * cabecera de respuesta segura para CORS: entre orígenes el navegador se la
 * oculta a JavaScript salvo que el servidor mande `Access-Control-Expose-
 * Headers`, y `If-None-Match` en la petición además dispara un preflight. Desde
 * el mismo origen no hay ninguna de las dos limitaciones.
 *
 * `origin` se pasa explícito en los tests; por defecto es el de la página o el
 * del worker, que en ambos casos es `location.origin`.
 */
export function isSameOriginMedia(href: string, origin: string = defaultOrigin()): boolean {
  const url = parse(href);
  if (!url || !isMediaUrl(href)) return false;
  return url.origin === origin;
}

function defaultOrigin(): string {
  return typeof location === 'undefined' ? '' : location.origin;
}

/** Nombre de la caché de medios. Lo comparten la página y el worker. */
export const MEDIA_CACHE = 'explorarte-media-v1';
