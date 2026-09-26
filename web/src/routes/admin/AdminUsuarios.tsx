import { useEffect, useState } from 'react';
import type { UserProfile, UserStatus } from '@explorarte/shared';
import { Icon } from '@/components/Icon';
import { Masthead } from '@/components/Masthead';
import { AdminBtn } from '@/components/admin/ui';
import { confirmDialog } from '@/components/confirm-store';
import { toast } from '@/components/toast-store';
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

/** 'rejected' is the only state that revokes access — pending and approved both
 * let the teacher into the app. Single source of truth for the tag, the action
 * button and the filter, so the three can't drift apart. */
const sinAcceso = (u: UserProfile) => u.status === 'rejected';

export default function AdminUsuarios() {
  const [filter, setFilter] = useState<FilterId>('approved');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch every teacher once and narrow in memory. Passing ?status= would 400:
  // the API binds the param with Enum.valueOf, which is case-sensitive, and the
  // wire format is lowercase. Filtering locally also makes the tabs instant.
  const load = () => {
    setLoading(true);
    api.admin.users.list()
      .then((list) => setUsers(list.filter((u) => u.role === 'teacher')))
      .catch(() => toast.error('No se pudo cargar la lista de usuarios. Intenta de nuevo.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const shown = users.filter((u) => {
    if (filter === 'all') return true;
    return filter === 'rejected' ? sinAcceso(u) : !sinAcceso(u);
  });

  const decide = async (u: UserProfile, action: 'approve' | 'reject') => {
    setBusy(u.id);
    try {
      await api.admin.users[action](u.id);
      toast.success(action === 'approve' ? `Diste acceso a ${u.name}` : `Quitaste el acceso a ${u.name}`);
      await load();
    } catch {
      toast.error('No se pudo actualizar el acceso. Intenta de nuevo.');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (u: UserProfile) => {
    const accepted = await confirmDialog({
      title: `Eliminar a ${u.name}`,
      message: 'Se borrará su cuenta y perderá el acceso a ExplorArte. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar usuario',
      tone: 'danger',
    });
    if (!accepted) return;
    setBusy(u.id);
    try {
      await api.admin.users.remove(u.id);
      setUsers((current) => current.filter((item) => item.id !== u.id));
      toast.success(`Eliminaste a ${u.name}.`);
    } catch {
      toast.error('No se pudo eliminar el usuario. Intenta de nuevo.');
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

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>Cargando usuarios…</div>
      ) : shown.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🌿</div>
          <p style={{ fontSize: 14 }}>No hay docentes en esta categoría.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {shown.map((u) => {
            const tag = STATUS_TAG[u.status];
            const initials = ((u.name[0] ?? '') + (u.lastname[0] ?? '')).toUpperCase();
            return (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 18, borderRadius: 18, background: '#fff', border: '1px solid var(--border)' }}>
                <span style={{ width: 46, height: 46, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(150deg,var(--clay),var(--clay-dark))', color: '#fff', fontSize: 15, fontWeight: 800, flexShrink: 0 }}>{initials}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-dark)' }}>{u.name} {u.lastname}</span>
                    <span style={{ borderRadius: 8, padding: '2px 9px', fontSize: 10.5, fontWeight: 700, color: tag.color, background: tag.bg }}>{tag.label}</span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="map-pin" size={12} color="var(--text-muted)" />{u.ubicacion}</span>
                    <span>·</span>
                    <span>{u.email}</span>
                  </div>
                </div>
                <div style={{ flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ width: 130 }}>
                  {sinAcceso(u) ? (
                    <AdminBtn label="Dar acceso" onClick={() => decide(u, 'approve')} disabled={busy === u.id} />
                  ) : (
                    <AdminBtn label="Quitar acceso" variant="outline" onClick={() => decide(u, 'reject')} disabled={busy === u.id} />
                  )}
                  </div>
                  <button
                    onClick={() => void remove(u)}
                    disabled={busy === u.id}
                    aria-label={`Eliminar a ${u.name}`}
                    title="Eliminar usuario"
                    style={{ width: 42, height: 42, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF5F3', border: '1px solid #F1CFC6', opacity: busy === u.id ? 0.5 : 1 }}>
                    <Icon name="trash" size={17} color="var(--danger)" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
