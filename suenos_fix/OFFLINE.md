# Acceso sin internet a documentos y videos (mobile)

**Objetivo:** que una docente pueda descargar documentos y videos con internet y después verlos sin
conexión (por ejemplo, en un salón sin Wi-Fi), actualizándose solos la próxima vez que haya red.

> **Este documento describe lo que existe hoy en `src/` (la app Expo).** La versión anterior
> describía un tipo `DownloadableResource` que nunca se implementó, un botón que decía
> "Próximamente" y un almacenamiento que no era el real (MAINT-11). Nada de eso sigue siendo
> cierto: el contrato real es `MediaItem`, el botón descarga de verdad, y los archivos viven en
> Cloud Storage for Firebase. La caché de la PWA en `web/` es otra cosa y se documenta aparte.

---

## El contrato: `MediaItem`

No hay ningún tipo `DownloadableResource`. Todo archivo real —foto, PDF, video, audio— es un
`MediaItem` (`shared/src/types/index.ts`, y el record del mismo nombre en el backend):

```ts
interface MediaItem {
  id: string;         // UUID, generado por el backend al subir
  title: string;      // nombre de archivo saneado
  url: string;        // URL canónica y permanente — ver DESPLIEGUE.md §5
  mimeType: string;   // detectado de los bytes, nunca de lo que dice el cliente
  sizeBytes: number;
}
```

Aparece en `tools_content` (manual, guías, descargables), `emotion_content.stories`,
`topic_subtopics` (pdfs/videos/audios), `screen_intro_videos.video` y `posts.attachments`.

**`url` es la URL canónica**, no una firmada: no lleva query string y no caduca. La API resuelve
cada lectura a una URL firmada de corta duración mediante un 302, y esa parte efímera nunca llega
a guardarse. Es lo que hace que un archivo ya descargado no se rompa nunca. El detalle completo
está en [`DESPLIEGUE.md`](./DESPLIEGUE.md), sección "La forma de las URLs de medios".

---

## Las piezas que existen

### `src/lib/offlineStorage.ts` — caché de archivos en disco

```ts
import { download, getLocalUri, isDownloaded, needsUpdate, remove, listDownloaded } from '@/lib/offlineStorage';
```

- Guarda los archivos en el directorio de documentos de la app (`expo-file-system`, API de clases
  `File`/`Directory`) — sobrevive a reinicios y no requiere conexión para leerse.
- Mantiene un índice en `AsyncStorage` con qué se descargó, de qué URL, cuándo, y una `version`
  opaca.
- **Se indexa por el `id` del `MediaItem`, no por la URL.** Es un detalle con consecuencias: si un
  archivo cambia de dominio (como pasó al migrar de Supabase a Cloud Storage), la caché de mobile
  **no se invalida** y no se vuelve a descargar nada.

### `src/lib/media-sync.ts` — descarga proactiva

`syncAllContent()` recorre el contenido de solo lectura (emociones y su detalle, herramientas,
aprendizaje, videos de intro), lo guarda en la caché JSON y **descarga los archivos que
referencia**, para que toda la sección de contenido funcione después con cero conectividad.

La versión con la que decide si re-descargar es `sizeBytes`: si el tamaño no cambió, no vuelve a
bajar el archivo. Un fallo en un archivo no aborta la pasada completa.

### `src/lib/useNetworkStatus.ts` — saber si hay internet

```ts
const isOnline = useIsOnline(); // reactivo, envuelve @react-native-community/netinfo
```

### `src/components/video-placeholder.tsx` — reproducir local primero

Recibe el `MediaItem` del video de la pantalla y resuelve la fuente con `getLocalUri(item.id)`,
cayendo a `item.url` si no hay copia local. Si no hay video subido para esa pantalla, no renderiza
nada en vez de mostrar un hueco roto.

---

## El patrón

```
        ¿Hay internet?  (useIsOnline)
              │
      ┌───────┴────────┐
      │ sí             │ no
      ▼                ▼
¿needsUpdate()?    getLocalUri()
      │                │
  sí  │  no            │
      ▼   │            ▼
  download()  │     ¿existe?
      │       │      │      │
      ▼       ▼     sí      no
   getLocalUri()  render   "Descárgalo primero
                            cuando tengas internet"
```

Es **cache-first con actualización en segundo plano**: la UI nunca se bloquea esperando red si ya
hay una copia local buena.

---

## Lo que falta

- **Gestión de espacio.** `listDownloaded()` y `totalDownloadedBytes()` existen, pero no hay una
  pantalla de "Mis descargas" donde ver y borrar lo que ocupa lugar.
- **Progreso de descarga.** `downloadFileAsync` puede reportar progreso; hoy no se muestra.
- **`syncAllContent()` no está limitado.** Corre en cada transición a "online"
  (`src/app/_layout.tsx`), así que una tablet que salta entre Wi-Fi y datos móviles repite la
  pasada y gasta el plan de datos de la docente (SCALE-03).
- **Cifrado.** El índice y la caché JSON van en claro en `AsyncStorage` (SEC-22).

Ver también [`COMO-TRABAJAMOS.md`](./COMO-TRABAJAMOS.md) para cómo se extiende el contrato
compartido, y [`DESPLIEGUE.md`](./DESPLIEGUE.md) para dónde viven los archivos en producción.
