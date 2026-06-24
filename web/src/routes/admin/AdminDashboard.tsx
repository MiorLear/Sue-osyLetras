import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Emotion, Topic, UserProfile } from '@explorarte/shared';
import { Masthead } from '@/components/Masthead';
import { api } from '@/lib/api';

interface Counts {
  pending: number;
  teachers: number;
  emotions: number;
  topics: number;
}

const MODULES = [
  { emoji: '✅', title: 'Usuarios', desc: 'Aprueba o rechaza el acceso de las docentes.', href: '/admin/usuarios', bg: 'linear-gradient(150deg,#EAF3E8,#FFFCF6)', border: '#D6E7D2' },
  { emoji: '💛', title: 'Emociones', desc: 'Edita la biblioteca de emociones y su contenido.', href: '/admin/emociones', bg: 'linear-gradient(150deg,#FBF1DA,#F8E8DE)', border: '#F0DEC8' },
  { emoji: '🧰', title: 'Herramientas', desc: 'Administra descargables y bibliografía.', href: '/admin/herramientas', bg: 'linear-gradient(150deg,#E7F4F2,#FFFCF6)', border: '#DCEDEA' },
  { emoji: '🌱', title: 'Aprendiendo', desc: 'Gestiona los temas de bienestar emocional.', href: '/admin/aprendiendo', bg: 'linear-gradient(150deg,#EEEAF7,#FFFCF6)', border: '#DDD4EE' },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    Promise.all([
      api.admin.users.list(),
      api.emotions.list(),
      api.learning.topics(),
    ]).then(([users, emotions, topics]: [UserProfile[], Emotion[], Topic[]]) => {
      setCounts({
        pending: users.filter((u) => u.status === 'pending').length,
        teachers: users.filter((u) => u.role === 'teacher' && u.status === 'approved').length,
        emotions: emotions.length,
        topics: topics.length,
      });
    });
  }, []);

  return (
    <div className="page">
      <Masthead
        eyebrow="Panel de administración"
        title="Gestiona"
        accent="ExplorArte"
        lede="Aprueba a las docentes y mantén al día el contenido de emociones, herramientas y aprendizaje."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 30 }}>
        <StatCard n={counts?.pending} label="Pendientes" emoji="⏳" accent="var(--clay)" onClick={() => navigate('/admin/usuarios')} />
        <StatCard n={counts?.teachers} label="Docentes activas" emoji="👩‍🏫" accent="var(--brand)" />
        <StatCard n={counts?.emotions} label="Emociones" emoji="💛" accent="var(--gold)" onClick={() => navigate('/admin/emociones')} />
        <StatCard n={counts?.topics} label="Temas" emoji="🌱" accent="#8067C0" onClick={() => navigate('/admin/aprendiendo')} />
      </div>

      <div className="section-head" style={{ gap: 12 }}>
        <h2 className="section-title">Módulos</h2>
        <span className="section-rule" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {MODULES.map((m) => (
          <button
            key={m.href}
            className="pressable"
            onClick={() => navigate(m.href)}
            style={{ textAlign: 'left', borderRadius: 20, padding: 24, background: m.bg, border: `1px solid ${m.border}`, display: 'flex', gap: 16, alignItems: 'center' }}>
            <span style={{ width: 52, height: 52, borderRadius: 15, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>{m.emoji}</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontFamily: 'var(--font-serif)', fontSize: 19, fontWeight: 600, color: 'var(--text-dark)' }}>{m.title}</span>
              <span style={{ display: 'block', marginTop: 3, fontSize: 13, color: '#6A7C78', lineHeight: 1.5 }}>{m.desc}</span>
            </span>
            <span style={{ fontSize: 20, color: 'var(--gold-label)' }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StatCard({ n, label, emoji, accent, onClick }: {
  n?: number;
  label: string;
  emoji: string;
  accent: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={onClick ? 'pressable' : undefined}
      disabled={!onClick}
      style={{ textAlign: 'left', borderRadius: 20, padding: 22, background: '#fff', border: '1px solid var(--border)', cursor: onClick ? 'pointer' : 'default' }}>
      <span style={{ fontSize: 24 }}>{emoji}</span>
      <span style={{ display: 'block', fontFamily: 'var(--font-serif)', fontSize: 34, color: accent, marginTop: 8, lineHeight: 1 }}>
        {n ?? '—'}
      </span>
      <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6 }}>{label}</span>
    </button>
  );
}
