import { useState } from 'react';
import { Masthead } from '@/components/Masthead';

import { api } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';

const TOPIC_BG = ['#EEEAF7', '#EAF3E8', '#F8E8DE', '#FBF1DA'];

export default function Aprendiendo() {
  const { data: topics, loading, error, reload } = useAsync(() => api.learning.topics(), []);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="page page-narrow">
      <Masthead
        eyebrow="Aprendiendo"
        title="Bienestar"
        accent="emocional"
        lede="Conceptos y estrategias para fortalecer el acompañamiento socioemocional en tu comunidad educativa."
      />

      <div style={{ borderRadius: 24, padding: '30px 32px', background: 'linear-gradient(150deg,#E7F4F2,#FFFCF6)', border: '1px solid #DCEDEA', marginBottom: 30, position: 'relative', overflow: 'hidden' }}>
        <span style={{ position: 'absolute', top: -20, right: -10, fontSize: 120, opacity: 0.08 }}>🌱</span>
        <p style={{ fontSize: 15.5, lineHeight: 1.7, color: '#3F5450', maxWidth: 560, position: 'relative' }}>
          Esta sección fortalece los conocimientos y herramientas de las docentes para acompañar procesos de bienestar
          emocional en sus comunidades educativas.
        </p>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-body)', padding: '48px 0' }}>Cargando…</p>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <p style={{ fontSize: 14.5, color: 'var(--text-body)', marginBottom: 14 }}>
            No pudimos cargar los contenidos. Revisa tu conexión.
          </p>
          <button
            onClick={reload}
            style={{ padding: '9px 20px', borderRadius: 10, background: 'var(--brand)', color: '#fff', fontWeight: 700, fontSize: 13.5 }}
          >
            Reintentar
          </button>
        </div>
      ) : !topics || topics.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0', fontSize: 13.5 }}>
          Aún no hay contenidos disponibles.
        </p>
      ) : (
        topics.map((topic, ti) => (
          <div key={topic.id} style={{ marginBottom: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
              <span style={{ width: 40, height: 40, borderRadius: 13, background: TOPIC_BG[ti % TOPIC_BG.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21 }}>{topic.emoji}</span>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 21, fontWeight: 600, color: 'var(--text-dark)' }}>{topic.title}</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {topic.subtopics.map((sub, idx) => {
                const key = `${topic.id}-${idx}`;
                const isOpen = open === key;
                return (
                  <div key={key} style={{ borderRadius: 15, overflow: 'hidden', background: '#fff', border: `1px solid ${isOpen ? 'var(--brand)' : 'var(--border)'}`, transition: 'border-color .15s' }}>
                    <button onClick={() => setOpen(isOpen ? null : key)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', textAlign: 'left' }}>
                      <span style={{ width: 26, height: 26, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-serif)', fontSize: 14, background: isOpen ? 'var(--nav-bg)' : '#F4EEE2', color: isOpen ? 'var(--brand-dark)' : '#A38F73' }}>{idx + 1}</span>
                      <span style={{ flex: 1, fontSize: 14.5, fontWeight: isOpen ? 700 : 600, color: isOpen ? 'var(--brand-dark)' : 'var(--text-dark)' }}>{sub.title}</span>
                      <span style={{ fontSize: 18, color: isOpen ? 'var(--brand)' : 'var(--gold-label)', transform: `rotate(${isOpen ? 180 : 0}deg)`, transition: 'transform .2s', display: 'inline-block' }}>⌄</span>
                    </button>
                    {isOpen ? (
                      <div style={{ padding: '0 18px 16px 58px' }}>
                        <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--text-body)' }}>{sub.body}</p>
                        {[...sub.pdfs, ...sub.videos, ...sub.audios].length > 0 ? (
                          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {sub.pdfs.map((m) => (
                              <a key={m.id} href={m.url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand-dark)' }}>📄 {m.title}</a>
                            ))}
                            {sub.videos.map((m) => (
                              <a key={m.id} href={m.url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand-dark)' }}>🎬 {m.title}</a>
                            ))}
                            {sub.audios.map((m) => (
                              <a key={m.id} href={m.url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand-dark)' }}>🎧 {m.title}</a>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
