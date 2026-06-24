import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { EmotionDetail as EmotionDetailType } from '@explorarte/shared';
import { Icon } from '@/components/Icon';
import { api } from '@/lib/api';

function Divider() {
  return <div style={{ height: 1, background: 'var(--border-soft)', margin: '18px 0' }} />;
}
function SectionTitle({ children }: { children: string }) {
  return <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-dark)' }}>{children}</h3>;
}

export default function EmotionDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [emotion, setEmotion] = useState<EmotionDetailType | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.emotions.get(id).then((e) => {
      setEmotion(e);
      setLoaded(true);
    });
  }, [id]);

  const color = emotion?.color ?? 'var(--brand)';
  const data = emotion?.content;

  return (
    <div className="page page-narrow">
      <header
        className="gradient-header"
        style={{ background: emotion ? `linear-gradient(135deg, ${emotion.color} 0%, ${emotion.color}CC 100%)` : 'var(--brand-gradient)' }}>
        <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600 }}>
          <Icon name="arrow-left" size={18} color="rgba(255,255,255,0.9)" /> Volver
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 44 }}>{emotion?.emoji ?? '✨'}</span>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Emoción</div>
            <div style={{ color: '#fff', fontSize: 24, fontWeight: 800 }}>{emotion?.name ?? 'Emoción'}</div>
          </div>
        </div>
      </header>

      <div>
        {data ? (
          <>
            <SectionTitle>¿Qué es esta emoción?</SectionTitle>
            <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-body)', lineHeight: 1.55 }}>{data.description}</p>

            <Divider />
            <SectionTitle>¿Cómo puede verse en el aula?</SectionTitle>
            <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-body)', lineHeight: 1.55 }}>{data.classroom}</p>

            <Divider />
            <SectionTitle>Preguntas para conversar</SectionTitle>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.questions.map((qn) => (
                <div key={qn} style={{ display: 'flex', gap: 8 }}>
                  <span style={{ color, fontSize: 13, fontWeight: 800 }}>•</span>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-body)', lineHeight: 1.45 }}>{qn}</span>
                </div>
              ))}
            </div>

            <Divider />
            <SectionTitle>Actividades recomendadas</SectionTitle>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.activities.map((a) => (
                <div key={a} style={{ borderRadius: 12, padding: 14, background: '#fff', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: emotion?.bg ?? 'var(--nav-bg)' }}>
                    <Icon name="edit" size={14} color={color} />
                  </span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-dark)' }}>{a}</span>
                </div>
              ))}
            </div>

            <Divider />
            <SectionTitle>Historias sugeridas</SectionTitle>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.stories.map((s) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon name="book-open" size={15} color={color} />
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-body)', lineHeight: 1.45 }}>{s}</span>
                </div>
              ))}
            </div>
          </>
        ) : loaded ? (
          <p style={{ fontSize: 13, color: 'var(--text-body)' }}>No encontramos información para esta emoción.</p>
        ) : null}
      </div>
    </div>
  );
}
