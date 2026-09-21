import { useState } from 'react';
import type { Topic } from '@explorarte/shared';
import { MediaList } from '@/components/DownloadableMediaItem';
import { BlockList } from '@/components/learning/BlockList';

// El acordeón de siempre, extraído tal cual de `Aprendiendo.tsx`.
//
// Sigue siendo la forma por defecto de un tema, y la que recibe cualquier
// `layout` que esta versión de la app no conozca: un CMS más nuevo no puede
// dejar la pantalla en blanco.

export function TopicAccordion({ topic }: { topic: Topic }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {topic.subtopics.map((sub, idx) => {
        const key = `${topic.id}-${sub.key || idx}`;
        const isOpen = open === key;
        return (
          <div
            key={key}
            style={{
              borderRadius: 15,
              overflow: 'hidden',
              background: '#fff',
              border: `1px solid ${isOpen ? 'var(--brand)' : 'var(--border)'}`,
              transition: 'border-color .15s',
            }}>
            <button
              onClick={() => setOpen(isOpen ? null : key)}
              aria-expanded={isOpen}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', textAlign: 'left' }}>
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 9,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-serif)',
                  fontSize: 14,
                  background: isOpen ? 'var(--nav-bg)' : '#F4EEE2',
                  color: isOpen ? 'var(--brand-dark)' : '#A38F73',
                }}>
                {sub.emoji || idx + 1}
              </span>
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: isOpen ? 700 : 600, color: isOpen ? 'var(--brand-dark)' : 'var(--text-dark)' }}>
                {sub.title}
              </span>
              <span
                aria-hidden
                style={{ fontSize: 18, color: isOpen ? 'var(--brand)' : 'var(--gold-label)', transform: `rotate(${isOpen ? 180 : 0}deg)`, transition: 'transform .2s', display: 'inline-block' }}>
                ⌄
              </span>
            </button>
            {isOpen ? (
              <div style={{ padding: '0 18px 16px clamp(18px, 10vw, 58px)' }}>
                <BlockList blocks={sub.blocks} size="sm" headingLevel={4} />
                <div style={{ marginTop: 12 }}>
                  <MediaList items={[...sub.pdfs, ...sub.videos, ...sub.audios]} />
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
