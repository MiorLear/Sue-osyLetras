import { useEffect, useState } from 'react';
import type { UserProfile, UserStatus } from '@explorarte/shared';
import { Icon } from '@/components/Icon';
import { Masthead } from '@/components/Masthead';
import { AdminBtn } from '@/components/admin/ui';
import { api } from '@/lib/api';

type FilterId = 'approved' | 'rejected' | 'all';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'approved', label: '✅ Con acceso' },
  { id: 'rejected', label: '🚫 Sin acceso' },
  { id: 'all', label: 'Todas' },
];

const STATUS_TAG: Record<UserStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Con acceso', color: '#1E7E78', bg: '#E1F1EF' },
  approved: { label: 'Con acceso', color: '#1E7E78', bg: '#E1F1EF' },
  rejected: { label: 'Sin acceso', color: 'var(--danger)', bg: '#FBEAE6' },
};

export default function AdminUsuarios() {
  const [filter, setFilter] = useState<FilterId>('approved');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = (f: FilterId) => {
    const status = f === 'all' ? undefined : (f as UserStatus);
    api.admin.users.list(status).then((list) => setUsers(list.filter((u) => u.role === 'teacher')));
  };

  useEffect(() => {
    load(filter);
  }, [filter]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const decide = async (u: UserProfile, action: 'approve' | 'reject') => {
    setBusy(u.id);
    try {
      await api.admin.users[action](u.id);
      showToast(action === 'approve' ? `Diste acceso a ${u.name}` : `Quitaste el acceso a ${u.name}`);
      load(filter);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page page-narrow">
      <Masthead
        eyebrow="Usuarios"
        title="Directorio de"
        accent="docentes"
        lede="Consulta a las docentes registradas y gestiona quién tiene acceso a ExplorArte."
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{ padding: '8px 15px', borderRadius: 22, fontSize: 12.5, fontWeight: 700, border: `1px solid ${active ? 'var(--brand)' : 'var(--border-warm)'}`, background: active ? 'var(--brand)' : '#fff', color: active ? '#fff' : '#5A6E6A' }}>
              {f.label}
            </button>
          );
        })}
      </div>

      {users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🌿</div>
          <p style={{ fontSize: 14 }}>No hay docentes en esta categoría.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {users.map((u) => {
            const tag = STATUS_TAG[u.status];
            const initials = ((u.name[0] ?? '') + (u.lastname[0] ?? '')).toUpperCase();
            const sinAcceso = u.status === 'rejected';
            return (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 18, borderRadius: 18, background: '#fff', border: '1px solid var(--border)' }}>
                <span style={{ width: 46, height: 46, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(150deg,var(--clay),var(--clay-dark))', color: '#fff', fontSize: 15, fontWeight: 800, flexShrink: 0 }}>{initials}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-dark)' }}>{u.name} {u.lastname}</span>
                    <span style={{ borderRadius: 8, padding: '2px 9px', fontSize: 10.5, fontWeight: 700, color: tag.color, background: tag.bg }}>{tag.label}</span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="map-pin" size={12} color="var(--text-muted)" />{u.institucion}</span>
                    <span>·</span>
                    <span>{u.ubicacion}</span>
                    <span>·</span>
                    <span>{u.email}</span>
                  </div>
                </div>
                <div style={{ flexShrink: 0, width: 130 }}>
                  {sinAcceso ? (
                    <AdminBtn label="Dar acceso" onClick={() => decide(u, 'approve')} disabled={busy === u.id} />
                  ) : (
                    <AdminBtn label="Quitar acceso" variant="outline" onClick={() => decide(u, 'reject')} disabled={busy === u.id} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {toast ? (
        <div className="toast">
          <Icon name="check-circle" size={16} color="#fff" />
          {toast}
        </div>
      ) : null}
    </div>
  );
}
