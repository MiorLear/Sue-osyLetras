import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Emotion, Topic, UserProfile } from '@explorarte/shared';
import { Masthead } from '@/components/Masthead';
import { api } from '@/lib/api';

interface Group {
  label: string;
  count: number;
}

interface Stats {
  teachers: number;
  emotions: number;
  topics: number;
  byZona: Group[];
  byInstitucion: Group[];
}

const MODULES = [
  { emoji: '✅', title: 'Usuarios', desc: 'Gestiona el acceso de las docentes.', href: '/admin/usuarios', bg: 'linear-gradient(150deg,#EAF3E8,#FFFCF6)', border: '#D6E7D2' },
  { emoji: '💛', title: 'Emociones', desc: 'Edita la biblioteca de emociones y su contenido.', href: '/admin/emociones', bg: 'linear-gradient(150deg,#FBF1DA,#F8E8DE)', border: '#F0DEC8' },
  { emoji: '🧰', title: 'Herramientas', desc: 'Administra descargables y bibliografía.', href: '/admin/herramientas', bg: 'linear-gradient(150deg,#E7F4F2,#FFFCF6)', border: '#DCEDEA' },
  { emoji: '🌱', title: 'Aprendiendo', desc: 'Gestiona los temas de bienestar emocional.', href: '/admin/aprendiendo', bg: 'linear-gradient(150deg,#EEEAF7,#FFFCF6)', border: '#DDD4EE' },
  { emoji: '🎬', title: 'Videos de introducción', desc: 'Sube y actualiza los videos de introducción de cada pantalla.', href: '/admin/videos-intro', bg: 'linear-gradient(150deg,#F3E9EA,#FFFCF6)', border: '#EAD6D8' },
];

/** Agrupa por valor y devuelve los conteos ordenados de mayor a menor. */
function groupCount(values: string[]): Group[] {
  const map = new Map<string, number>();
  for (const v of values) {
    const key = v?.trim() || 'Sin especificar';
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    Promise.all([
      api.admin.users.list(),
      api.emotions.list(),
      api.learning.topics(),
    ]).then(([users, emotions, topics]: [UserProfile[], Emotion[], Topic[]]) => {
      const teachers = users.filter((u) => u.role === 'teacher' && u.status === 'approved');
      setStats({
        teachers: teachers.length,
        emotions: emotions.length,
        topics: topics.length,
        byZona: groupCount(teachers.map((t) => t.ubicacion)),
        byInstitucion: groupCount(teachers.map((t) => t.institucion)),
      });
    });
  }, []);

  return (
    <div className="page">
      <Masthead
        eyebrow="Panel de administración"
        title="Gestiona"
        accent="ExplorArte"
        lede="Revisa de dónde son las docentes y mantén al día el contenido de emociones, herramientas y aprendizaje."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 30 }}>
        <StatCard n={stats?.teachers} label="Docentes" emoji="👩‍🏫" accent="var(--brand)" onClick={() => navigate('/admin/usuarios')} />
        <StatCard n={stats?.emotions} label="Emociones" emoji="💛" accent="var(--gold)" onClick={() => navigate('/admin/emociones')} />
        <StatCard n={stats?.topics} label="Temas" emoji="🌱" accent="#8067C0" onClick={() => navigate('/admin/aprendiendo')} />
      </div>

      <div className="section-head" style={{ gap: 12 }}>
        <h2 className="section-title">¿De dónde son las docentes?</h2>
        <span className="section-rule" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 30 }}>
        <BreakdownCard title="Docentes por zona" emoji="📍" groups={stats?.byZona} />
        <BreakdownCard title="Docentes por institución" emoji="🏫" groups={stats?.byInstitucion} />
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

function BreakdownCard({ title, emoji, groups }: { title: string; emoji: string; groups?: Group[] }) {
  const max = groups && groups.length ? Math.max(...groups.map((g) => g.count)) : 0;
  return (
    <div style={{ borderRadius: 20, padding: 22, background: '#fff', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 18 }}>{emoji}</span>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 600, color: 'var(--text-dark)' }}>{title}</span>
      </div>

      {!groups ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cargando…</div>
      ) : groups.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aún no hay docentes registradas.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {groups.map((g) => (
            <div key={g.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 5 }}>
                <span style={{ fontSize: 13, color: 'var(--text-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)', flexShrink: 0 }}>{g.count}</span>
              </div>
              <div style={{ height: 6, borderRadius: 6, background: 'var(--nav-bg)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${max ? (g.count / max) * 100 : 0}%`, borderRadius: 6, background: 'var(--brand)' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
