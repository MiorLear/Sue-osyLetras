import { useEffect, useState } from 'react';
import type { Invitation, InvitationStatus } from '@explorarte/shared';
import { ApiError } from '@explorarte/shared';
import { Icon } from '@/components/Icon';
import { Masthead } from '@/components/Masthead';
import { AdminBtn } from '@/components/admin/ui';
import { confirmDialog } from '@/components/confirm-store';
import { toast } from '@/components/toast-store';
import { api } from '@/lib/api';

type FilterId = 'pending' | 'accepted' | 'all';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'pending', label: '✉️ Pendientes' },
  { id: 'accepted', label: '✅ Aceptadas' },
  { id: 'all', label: 'Todas' },
];

const STATUS_TAG: Record<InvitationStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pendiente', color: '#8A6A12', bg: '#FBF1DA' },
  accepted: { label: 'Aceptada', color: '#1E7E78', bg: '#E1F1EF' },
  expired: { label: 'Vencida', color: '#6B6B6B', bg: '#EDEDED' },
  revoked: { label: 'Revocada', color: 'var(--danger)', bg: '#FBEAE6' },
};

/** Una invitación sigue viva solo mientras está pendiente: las demás no se
 *  pueden reenviar ni revocar, y por eso los botones desaparecen. */
const sigueViva = (i: Invitation) => i.status === 'pending';

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** El mensaje del servidor cuando lo trae; si no, uno genérico. */
function motivo(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    try {
      const body = JSON.parse(err.body) as { detail?: string };
      if (body.detail) return body.detail;
    } catch {
      // Cuerpo no-JSON: cae al genérico.
    }
  }
  return fallback;
}

export default function AdminInvitaciones() {
  const [filter, setFilter] = useState<FilterId>('pending');
  const [invitaciones, setInvitaciones] = useState<Invitation[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.admin.invitations.list()
      .then(setInvitaciones)
      .catch(() => toast.error('No se pudo cargar la lista de invitaciones. Intenta de nuevo.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const shown = invitaciones.filter((i) => {
    if (filter === 'all') return true;
    if (filter === 'accepted') return i.status === 'accepted';
    return i.status === 'pending';
  });

  const invitar = async () => {
    const value = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      toast.error('Ingresa un correo electrónico válido.');
      return;
    }
    setEnviando(true);
    try {
      await api.admin.invitations.create(value);
      setEmail('');
      toast.success(`Invitación enviada a ${value}.`);
      load();
    } catch (err) {
      toast.error(motivo(err, 'No se pudo enviar la invitación. Revisa el correo e intenta de nuevo.'));
    } finally {
      setEnviando(false);
    }
  };

  const reenviar = async (i: Invitation) => {
    setBusy(i.id);
    try {
      await api.admin.invitations.resend(i.id);
      toast.success(`Volvimos a enviar la invitación a ${i.email}.`);
      load();
    } catch (err) {
      toast.error(motivo(err, 'No se pudo reenviar la invitación. Intenta de nuevo.'));
    } finally {
      setBusy(null);
    }
  };

  const revocar = async (i: Invitation) => {
    const accepted = await confirmDialog({
      title: `Revocar la invitación de ${i.email}`,
      message: 'El enlace que recibió dejará de funcionar. Puedes volver a invitarla cuando quieras.',
      confirmLabel: 'Revocar invitación',
      tone: 'danger',
    });
    if (!accepted) return;
    setBusy(i.id);
    try {
      await api.admin.invitations.revoke(i.id);
      toast.success(`Revocaste la invitación de ${i.email}.`);
      load();
    } catch (err) {
      toast.error(motivo(err, 'No se pudo revocar la invitación. Intenta de nuevo.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page page-narrow">
      <Masthead
        eyebrow="Invitaciones"
        title="Invita a nuevas"
        accent="docentes"
        lede="Envía un enlace por correo para que creen su cuenta, y consulta cuáles siguen pendientes."
      />

      <section style={{ marginBottom: 22, padding: 18, borderRadius: 18, background: '#fff', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ width: 36, height: 36, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E8F8F7' }}>
            <Icon name="mail" size={18} color="var(--brand-dark)" />
          </span>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-dark)' }}>Invitar docente</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Recibirá un enlace para crear su cuenta. Vence en 14 días y solo sirve una vez.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') void invitar(); }}
            placeholder="docente@colegio.edu"
            aria-label="Correo de la docente"
            style={{ flex: '1 1 260px' }}
          />
          <button
            onClick={() => void invitar()}
            disabled={enviando}
            style={{ padding: '10px 18px', borderRadius: 11, background: 'var(--brand-dark)', color: '#fff', fontSize: 13, fontWeight: 700, opacity: enviando ? 0.6 : 1 }}>
            {enviando ? 'Enviando…' : 'Enviar invitación'}
          </button>
        </div>
      </section>

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
        <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>Cargando invitaciones…</div>
      ) : shown.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>✉️</div>
          <p style={{ fontSize: 14 }}>No hay invitaciones en esta categoría.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {shown.map((i) => {
            const tag = STATUS_TAG[i.status];
            return (
              <div
                key={i.id}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 18, borderRadius: 18, background: '#fff', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <span style={{ width: 46, height: 46, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E8F8F7', flexShrink: 0 }}>
                  <Icon name="mail" size={19} color="var(--brand-dark)" />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-dark)', wordBreak: 'break-all' }}>{i.email}</span>
                    <span style={{ borderRadius: 8, padding: '2px 9px', fontSize: 10.5, fontWeight: 700, color: tag.color, background: tag.bg }}>{tag.label}</span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12.5, color: 'var(--text-muted)' }}>
                    {i.status === 'accepted' && i.acceptedAt
                      ? `Aceptada el ${fecha(i.acceptedAt)}`
                      : `Enviada el ${fecha(i.createdAt)} · vence el ${fecha(i.expiresAt)}`}
                  </div>
                </div>
                {sigueViva(i) ? (
                  <div style={{ flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ width: 120 }}>
                      <AdminBtn label="Reenviar" variant="outline" onClick={() => void reenviar(i)} disabled={busy === i.id} />
                    </div>
                    <button
                      onClick={() => void revocar(i)}
                      disabled={busy === i.id}
                      aria-label={`Revocar la invitación de ${i.email}`}
                      title="Revocar invitación"
                      style={{ width: 42, height: 42, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF5F3', border: '1px solid #F1CFC6', opacity: busy === i.id ? 0.5 : 1 }}>
                      <Icon name="trash" size={17} color="var(--danger)" />
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
