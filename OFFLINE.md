# Arquitectura offline-first para documentos y videos (mobile)

**Objetivo del equipo:** que una docente pueda descargar documentos y videos con internet, y
después verlos sin conexión (por ejemplo, en un salón sin Wi-Fi), actualizándose solos la
próxima vez que haya red.

Este documento explica el patrón, qué ya está construido, y qué falta decidir/conectar cuando
haya contenido real (documentos y videos reales, no los strings de ejemplo que hay hoy).

---

## Por qué no está "terminado" todavía

Hoy, `ToolsContent.downloadables` (en `shared/openapi.yaml` y `shared/src/types/`) es solo una
lista de **nombres** (`"Plantillas"`, "Fichas de trabajo"...) sin ninguna URL real detrás — por
eso el botón "Descargar" en `src/app/herramientas.tsx` hoy muestra
`Alert.alert('Próximamente disponible')`. Antes de construir la pantalla de descarga real, hace
falta que el backend tenga **archivos reales con URLs reales** (ver sección de backend abajo).
Construir la UI de descarga contra datos que no existen sería trabajo a medias que habría que
rehacer — por eso este documento se enfoca en dejar lista la **infraestructura genérica**, que
ya funciona hoy mismo apenas exista una URL real que darle.

## Qué ya está construido (listo para usar)

### `src/lib/offlineStorage.ts` — caché de archivos en disco

Funciones genéricas, no atadas a ninguna pantalla:

```ts
import { download, getLocalUri, isDownloaded, needsUpdate, remove, listDownloaded } from '@/lib/offlineStorage';

await download('manual-explorarte', 'https://.../manual.pdf', { version: '2026-07-01' });
const uri = await getLocalUri('manual-explorarte');      // file:///.../downloads/manual-explorarte.pdf
await isDownloaded('manual-explorarte');                  // true
await needsUpdate('manual-explorarte', serverVersion);    // true si cambió o nunca se descargó
await remove('manual-explorarte');                        // libera espacio
```

- Guarda los archivos en el **directorio de documentos** de la app (`expo-file-system`, API
  nueva basada en clases `File`/`Directory`) — sobrevive a reinicios de la app y no requiere
  conexión para leerse.
- Guarda un índice liviano en `AsyncStorage` (`@react-native-async-storage/async-storage`) con
  qué se descargó, de qué URL, cuándo, y una `version` opaca (para detectar cambios — ver
  siguiente sección).
- `download()` es **idempotente**: volver a llamarlo con la misma URL simplemente sobreescribe
  el archivo — así es como se ve la "actualización cuando hay red".

### `src/lib/useNetworkStatus.ts` — saber si hay internet

```ts
import { useIsOnline } from '@/lib/useNetworkStatus';

const isOnline = useIsOnline(); // true/false, reactivo
```

Envuelve `@react-native-community/netinfo`. Con esto, una pantalla puede decidir: si hay
internet, revisar si hay una versión nueva del recurso y descargarla en segundo plano; si no hay
internet, servir directamente lo que ya está descargado sin ni intentar la llamada a la API.

---

## El patrón completo (cómo se conecta todo)

```
        ¿Hay internet?  (useIsOnline)
              │
      ┌───────┴────────┐
      │ sí             │ no
      ▼                ▼
¿needsUpdate()?    getLocalUri()
      │                │
  sí  │  no             │
      ▼   │             ▼
  download()  │    ¿existe?
      │       │      │      │
      ▼       ▼     sí      no
   getLocalUri()  render   "Descárgalo primero
                            cuando tengas internet"
```

En código, una pantalla que muestre un recurso descargable haría algo así (pseudocódigo, para
cuando haya un recurso real):

```tsx
const isOnline = useIsOnline();
const [localUri, setLocalUri] = useState<string | null>(null);

useEffect(() => {
  (async () => {
    if (isOnline && (await needsUpdate(resource.id, resource.version))) {
      await download(resource.id, resource.url, { version: resource.version });
    }
    setLocalUri(await getLocalUri(resource.id));
  })();
}, [isOnline, resource.id]);

// renderiza desde localUri si existe (aunque en ese momento no haya internet);
// si no existe y no hay internet, muestra "necesitas conexión para descargarlo la primera vez".
```

Esto es **"cache-first, actualiza en segundo plano cuando hay red"** — el patrón estándar para
offline-first. La app nunca bloquea la UI esperando red si ya tiene una copia local buena.

---

## Lo que falta decidir con contenido real

### 1. El contrato de datos necesita URLs reales

`ToolsContent` (y cualquier video por módulo de emoción) tienen que dejar de ser strings sueltos
y pasar a algo con URL + versión, por ejemplo:

```ts
// Propuesta para shared/src/types — NO implementado todavía, a definir cuando haya contenido real
export interface DownloadableResource {
  id: string;
  title: string;
  url: string;          // URL pública del archivo
  mimeType: string;     // "application/pdf", "video/mp4", ...
  sizeBytes: number;
  updatedAt: string;     // ISO date — se usa como `version` en offlineStorage
}
```

Este cambio toca: `shared/openapi.yaml`, `shared/src/types/`, el mock, el cliente HTTP, la
entidad/DTO de `ToolsContent` en el backend (`api/src/main/java/com/explorarte/api/tools/`), y
la pantalla `herramientas.tsx`. Es un cambio real pero mecánico — sigue el mismo flujo de
["cómo agregar un endpoint nuevo"](./COMO-TRABAJAMOS.md#cómo-agregar-un-endpoint-nuevo-flujo-completo).

### 2. ¿Dónde viven los archivos reales?

El backend en Java no debería servir archivos binarios pesados desde su propio disco (Cloud Run
es efímero — no hay garantía de que el mismo archivo siga ahí en el siguiente request). La
opción que ya calza con el plan de [`DESPLIEGUE.md`](./DESPLIEGUE.md) es **Cloud Storage for
Firebase** (un bucket de Google Cloud Storage): se sube el PDF/video una vez ahí, y `url` en el
contrato apunta a esa URL pública (o firmada, si se quiere restringir acceso). El backend en Java
solo guarda la URL en la base de datos — no maneja los bytes del archivo.

### 3. UI de descarga

Falta: botón de "Descargar" real (que llame a `download()`), indicador de progreso (el
`downloadFileAsync` de `expo-file-system` soporta reportar progreso — revisar la documentación
de la versión instalada al implementar), badge de "✓ Descargado" por recurso, y una pantalla de
"Mis descargas" (usando `listDownloaded()` y `totalDownloadedBytes()`) para que el usuario pueda
ver/borrar lo que ocupa espacio.

### 4. Videos por módulo de emoción

Hoy cada módulo usa el mismo video local bundleado (`assets/video/demo.mp4`, vía `expo-video`,
ver `src/components/video-placeholder.tsx`). Si a futuro cada emoción tiene su propio video
**remoto**, ese campo (`videoUrl` en `EmotionDetail`, por ejemplo) seguiría exactamente el mismo
patrón que los documentos — `offlineStorage.ts` no le importa si el archivo es un PDF o un MP4.

---

## Resumen para quien continúe

- **Ya se puede usar hoy**: `src/lib/offlineStorage.ts` y `src/lib/useNetworkStatus.ts` — no
  dependen de que el contenido real exista.
- **Falta, y depende de decisiones de producto/contenido**: URLs reales en el contrato
  (`DownloadableResource`), dónde se suben los archivos (Cloud Storage), y la UI de
  descarga/progreso/gestión de espacio.
- Ver también [`COMO-TRABAJAMOS.md`](./COMO-TRABAJAMOS.md) para el flujo general de cómo se
  extiende el contrato compartido, y [`DESPLIEGUE.md`](./DESPLIEGUE.md) para dónde calza Cloud
  Storage en el plan de producción.
