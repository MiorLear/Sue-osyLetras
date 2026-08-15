import { useCallback, useEffect, useState } from 'react';

import type { MediaItem } from '@explorarte/shared';

import { confirmDialog } from '@/components/confirm-store';
import { Icon } from '@/components/Icon';
import { Masthead } from '@/components/Masthead';
import { toast } from '@/components/toast-store';
import { collectMediaItems, syncAllContent } from '@/lib/content-sync';
import { listDownloaded, remove, totalDownloadedBytes } from '@/lib/media-cache';
import { formatBytes, iconFor } from '@/lib/media-format';
import {
  fitsInQuota,
  lastPersistOutcome,
  SAFE_QUOTA_FRACTION,
  storageUsage,
  type PersistOutcome,
  type StorageUsage,
} from '@/lib/storage-persist';
import { useIsOnline } from '@/lib/useNetworkStatus';

// Qué ocupa la app en este dispositivo y cómo controlarlo.
//
// El almacenamiento del navegador es finito y desalojable, y hasta ahora la app
// descargaba archivos sin que nadie pudiera ver cuántos ni liberarlos. En un
// teléfono con poco espacio eso termina de una sola manera: el navegador tira
// justo el contenido que la docente bajó para la clase de mañana.

interface Row {
  id: string;
  title: string;
  sizeBytes: number;
  mimeType?: string;
}

export default function Descargas() {
  const online = useIsOnline();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [usage, setUsage] = useState<StorageUsage>({ supported: false });
  const [persist, setPersist] = useState<PersistOutcome | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; title: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    // El índice guarda id, url y tamaño, pero no el título: ese vive en el
    // contenido. Se cruzan por id para que la lista diga "Manual ExplorArte" y
    // no un uuid.
    const [stored, referenced, bytes, estimate, persisted] = await Promise.all([
      listDownloaded(),
      collectMediaItems(),
      totalDownloadedBytes(),
      storageUsage(),
      lastPersistOutcome(),
    ]);

    const byId = new Map<string, MediaItem>(referenced.map((m) => [m.id, m]));
    setRows(
      stored
        .map((record) => ({
          id: record.id,
          title: byId.get(record.id)?.title ?? record.id,
          sizeBytes: record.sizeBytes,
          mimeType: record.mimeType ?? byId.get(record.id)?.mimeType,
        }))
        .sort((a, b) => b.sizeBytes - a.sizeBytes),
    );
    setTotal(bytes);
    setUsage(estimate);
    setPersist(persisted);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const deleteOne = async (row: Row) => {
    const ok = await confirmDialog({
      title: `¿Borrar "${row.title}"?`,
      message: 'Dejará de estar disponible sin conexión. Podrás volver a descargarlo con internet.',
      confirmLabel: 'Borrar',
      tone: 'danger',
    });
    if (!ok) return;

    await remove(row.id);
    await load();
    toast.success('Archivo borrado del dispositivo.');
  };

  const downloadEverything = async () => {
    if (!online) {
      toast.info('Necesitas conexión para descargar el contenido.', { title: 'Sin conexión' });
      return;
    }

    // Se comprueba ANTES de empezar. Que el navegador desaloje a mitad de la
    // descarga es peor que no empezarla: se pierde también lo que ya había.
    const pending = (await collectMediaItems()).reduce((sum, m) => sum + (m.sizeBytes || 0), 0);
    const fresh = await storageUsage();
    if (!fitsInQuota(pending, fresh)) {
      const limit = (fresh.quota ?? 0) * SAFE_QUOTA_FRACTION;
      toast.error(
        `El contenido ocupa ${formatBytes(pending)} y en este dispositivo solo podemos usar ${formatBytes(limit)}. Borra algunos archivos e inténtalo de nuevo.`,
        { title: 'No hay espacio suficiente' },
      );
      return;
    }

    setBusy(true);
    setProgress({ done: 0, total: 0, title: '' });
    try {
      const result = await syncAllContent((done, count, title) =>
        setProgress({ done, total: count, title }),
      );
      await load();
      if (result.failures.length > 0) {
        toast.error(
          `${result.failures.length} ${result.failures.length === 1 ? 'archivo no se pudo descargar' : 'archivos no se pudieron descargar'}. El resto sí está disponible sin conexión.`,
        );
      } else {
        toast.success('Todo el contenido está disponible sin conexión.');
      }
    } catch {
      toast.error('No se pudo completar la descarga. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const pct =
    usage.supported && usage.quota ? Math.min(100, ((usage.usage ?? 0) / usage.quota) * 100) : null;

  return (
    <div className="page page-narrow">
      <Masthead
        eyebrow="Descargas"
        title="Contenido en"
        accent="este dispositivo"
        lede="Lo que has guardado para usar sin conexión, y cuánto espacio ocupa."
        showDate={false}
      />

      <section className="storage-card">
        <div className="storage-card__head">
          <span className="storage-card__total">{formatBytes(total) || '0 B'}</span>
          <span className="storage-card__label">
            {rows === null
              ? 'Calculando…'
              : rows.length === 1
                ? '1 archivo guardado'
                : `${rows.length} archivos guardados`}
          </span>
        </div>

        {pct !== null ? (
          <>
            <div className="storage-card__bar">
              <span style={{ width: `${pct}%` }} />
            </div>
            <p className="storage-card__hint">
              {formatBytes(usage.usage ?? 0)} de {formatBytes(usage.quota ?? 0)} que este navegador
              permite guardar.
            </p>
          </>
        ) : (
          <p className="storage-card__hint">
            Este navegador no dice cuánto espacio queda, así que solo se muestra lo guardado.
          </p>
        )}

        {/* PWA-2.13: donde la docente mira el espacio es donde tiene sentido
            decirle si el navegador puede borrarlo sin avisar. */}
        {persist?.granted ? (
          <p className="storage-card__persist storage-card__persist--ok">
            <Icon name="check-circle" size={14} color="var(--brand-dark)" /> El navegador no borrará
            este contenido para hacer espacio.
          </p>
        ) : persist && !persist.supported ? (
          <p className="storage-card__persist">
            Este navegador puede borrar el contenido guardado si necesita espacio.{' '}
            <strong>Instala la app</strong> para que no ocurra.
          </p>
        ) : null}
      </section>

      <div className="storage-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={downloadEverything}
          disabled={busy}>
          {busy ? 'Descargando…' : 'Descargar todo para usar sin conexión'}
        </button>
      </div>

      {progress ? (
        <div className="storage-progress">
          <div className="media-row__progress">
            <span
              style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : '0%' }}
            />
          </div>
          <p className="storage-card__hint">
            {progress.total
              ? `${progress.done} de ${progress.total}${progress.title ? ` · ${progress.title}` : ''}`
              : 'Preparando…'}
          </p>
        </div>
      ) : null}

      {rows === null ? (
        <p className="storage-card__hint">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="storage-card__hint">
          Todavía no has guardado nada. Descarga un archivo desde Herramientas, Aprendiendo o una
          emoción, o usa el botón de arriba.
        </p>
      ) : (
        <div className="media-list">
          {rows.map((row) => (
            <div key={row.id} className="media-row">
              <span className="media-row__icon" aria-hidden="true">
                <Icon name={iconFor(row.mimeType)} size={17} color="var(--brand)" />
              </span>
              <span className="media-row__body">
                <span className="media-row__title">{row.title}</span>
                <span className="media-row__meta">{formatBytes(row.sizeBytes)}</span>
              </span>
              <button
                type="button"
                className="storage-delete"
                onClick={() => deleteOne(row)}
                aria-label={`Borrar ${row.title}`}>
                <Icon name="trash" size={16} color="#c53030" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
