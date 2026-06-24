import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Emotion } from '@explorarte/shared';
import { Masthead } from '@/components/Masthead';
import { api } from '@/lib/api';

const playVideo = () => alert('Video de demostración — próximamente disponible en la web.');

export default function Emociones() {
  const navigate = useNavigate();
  const [emotions, setEmotions] = useState<Emotion[]>([]);

  useEffect(() => {
    api.emotions.list().then(setEmotions);
  }, []);

  return (
    <div className="page">
      <Masthead
        eyebrow="Biblioteca de emociones"
        title="Reconocer para"
        accent="acompañar"
        lede="Recursos para comprender distintas emociones y guiar conversaciones significativas con tus estudiantes."
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 24, alignItems: 'stretch', marginBottom: 34 }}>
        <div style={{ borderRadius: 24, padding: 32, background: '#fff', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 15.5, lineHeight: 1.7, color: 'var(--text-body)' }}>
            Las emociones forman parte de nuestra vida cotidiana. Reconocerlas, nombrarlas y comprenderlas es el primer
            paso para desarrollar bienestar emocional y construir relaciones saludables dentro del aula.
          </p>
          <div style={{ display: 'flex', gap: 18, marginTop: 22, paddingTop: 20, borderTop: '1px solid #F0E7D8' }}>
            <Stat n={emotions.length || 8} label="emociones" color="var(--brand)" />
            <Sep />
            <Stat n={24} label="actividades" color="var(--clay)" />
            <Sep />
            <Stat n={12} label="historias" color="var(--gold)" />
          </div>
        </div>

        <button onClick={playVideo} style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', background: '#1E7E78', minHeight: 210, textAlign: 'left' }}>
          <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(13,60,57,.15),rgba(13,60,57,.78))' }} />
          <span style={{ position: 'absolute', top: 18, right: 22, fontSize: 90, opacity: 0.25 }}>💛</span>
          <span style={{ position: 'absolute', left: 24, bottom: 22, right: 24, color: '#fff' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,.92)', color: '#1E7E78', fontSize: 18, marginBottom: 12 }}>▶</span>
            <span style={{ display: 'block', fontFamily: 'var(--font-serif)', fontSize: 19 }}>¿Por qué reconocer las emociones?</span>
            <span style={{ display: 'block', fontSize: 12.5, opacity: 0.85, marginTop: 2 }}>Video de introducción · ~1 min</span>
          </span>
        </button>
      </div>

      <div className="section-head" style={{ gap: 12 }}>
        <h2 className="section-title">Biblioteca</h2>
        <span className="section-rule" />
      </div>

      <div className="emotion-grid">
        {emotions.map((e) => (
          <button
            key={e.id}
            className="pressable"
            onClick={() => navigate(`/emociones/${e.id}`)}
            style={{ borderRadius: 20, padding: '26px 14px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, background: e.bg, border: `1px solid ${e.color}33` }}>
            <span style={{ fontSize: 50, lineHeight: 1 }}>{e.emoji}</span>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 600, color: 'var(--text-dark)' }}>{e.name}</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em', color: e.color }}>Explorar →</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <span>
      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color }}>{n}</span>
      <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{label}</span>
    </span>
  );
}

function Sep() {
  return <span style={{ width: 1, background: '#F0E7D8' }} />;
}
