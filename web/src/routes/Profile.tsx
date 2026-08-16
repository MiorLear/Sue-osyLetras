import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UserProfile } from '@explorarte/shared';
import { Icon } from '@/components/Icon';
import { Masthead } from '@/components/Masthead';
import { Field, LocationAutocomplete, PrimaryButton, SelectOrAdd } from '@/components/ui';
import { toast } from '@/components/toast-store';
import { useAuth } from '@/context/AuthContext';
import { CacheAgeNote, ContentState } from '@/components/ContentState';
import { api } from '@/lib/api';
import { cacheKeys } from '@/lib/cache-keys';
import { writeCache } from '@/lib/offline-cache';
import { isDeadSession } from '@/lib/offline-errors';
import { enqueueProfileUpdate } from '@/lib/outbox';
import { usePendingIndex } from '@/lib/use-outbox';
import { useIsOnline } from '@/lib/useNetworkStatus';
import { useOfflineAsync } from '@/lib/useOfflineAsync';
import { useRefetchOnDrain } from '@/lib/useRefetchOnDrain';
import { useSchools } from '@/lib/useSchools';

export default function Profile() {
  const navigate = useNavigate();
  const { setUser, signOut } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    data: profile,
    status,
    ageMs,
    reload,
  } = useOfflineAsync(cacheKeys.profile(), () => api.profile.get(), []);
  const schools = useSchools();
  const online = useIsOnline();
  const pending = usePendingIndex();
  useRefetchOnDrain(reload);

  const [photo, setPhoto] = useState<string | null>(null);
  const [name, setName] = useState('María Reneé');
  const [lastname, setLastname] = useState('García López');
  const [email, setEmail] = useState('maria@ejemplo.com');
  const [phone, setPhone] = useState('+503 7000 1234');
  const [institucion, setInstitucion] = useState('Colegio Americano');
  const [ubicacion, setUbicacion] = useState('San Salvador');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setLastname(profile.lastname);
    setEmail(profile.email);
    setPhone(profile.phone);
    setInstitucion(profile.institucion);
    setUbicacion(profile.ubicacion);
    setPhoto(profile.photo ?? null);
  }, [profile]);

  const initials = ((name.charAt(0) || '') + (lastname.charAt(0) || '')).toUpperCase();

  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Sin conexión no hay nada que encolar: no existe a dónde subir los bytes,
    // y guardar una URL local en la cola sería mandarle al servidor una
    // dirección que solo existe en esta pestaña. Aquí está la línea: la foto
    // necesita red al elegirla, los campos de texto no la necesitan nunca.
    if (!online) {
      toast.info(
        'La foto necesita conexión para subirse. Guarda tus datos ahora y cambia la foto cuando vuelvas a tener internet.',
        { title: 'Sin conexión' },
      );
      e.target.value = '';
      return;
    }
    setSaveError(null);
    setUploadingPhoto(true);
    try {
      const media = await api.media.upload(file, file.name, 'profile');
      setPhoto(media.url);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'No pudimos subir la foto. Inténtalo de nuevo.',
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    setSaveError(null);
    setSaving(true);
    const textInput = { name, lastname, email, phone, institucion, ubicacion };
    // La foto solo entra en la cola si de verdad se subió: solo entonces es una
    // URL alojada que el servidor puede aceptar tal cual. Si no cambió,
    // reenviarla es un no-op que además pisaría un cambio hecho desde otro
    // dispositivo.
    const fotoSubida =
      photo && photo !== (profile?.photo ?? null) && /^https?:/.test(photo) ? { photo } : {};

    const encolar = async () => {
      await enqueueProfileUpdate({ ...textInput, ...fotoSubida });
      // La caché también: sin esto, recargar sin conexión revive el perfil
      // viejo y el cambio parece haberse perdido aunque siga en la cola.
      void writeCache(cacheKeys.profile(), { ...(profile ?? {}), ...textInput, ...fotoSubida });
      // Y AuthContext, que es de donde sacan el nombre la barra lateral y la
      // superior: si no, la cabecera se queda con el nombre viejo.
      if (profile) setUser({ ...profile, ...textInput, ...fotoSubida } as UserProfile);
      toast.info('Tus cambios se enviarán cuando haya conexión.', {
        title: 'Guardado sin conexión',
      });
    };

    try {
      if (online) {
        const updated = await api.profile.update({ ...textInput, photo });
        setUser(updated);
        // El verde solo en el camino directo: "Perfil actualizado
        // correctamente" sería mentira mientras el cambio siga en la cola.
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        await encolar();
      }
    } catch (e) {
      if (isDeadSession(e)) return;
      try {
        await encolar();
      } catch {
        setSaveError(
          e instanceof Error ? e.message : 'No pudimos guardar los cambios. Inténtalo de nuevo.',
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const logout = () => {
    signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="page page-narrow">
      <Masthead
        eyebrow="Mi perfil"
        title={name || 'María'}
        accent={lastname || 'Reneé'}
        lede="Gestiona tu cuenta, tus grupos y tus preferencias."
        showDate={false}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!profile ? (
          <ContentState status={status} onRetry={reload} what="tu perfil" />
        ) : (
          <>
            <CacheAgeNote status={status} ageMs={ageMs} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20, borderRadius: 20, background: '#fff', border: '1px solid var(--border)' }}>
              <div style={{ position: 'relative' }}>
                {photo ? (
                  <img src={photo} alt="" style={{ width: 76, height: 76, borderRadius: 22, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 76, height: 76, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(150deg,var(--clay),var(--clay-dark))', fontSize: 26, fontWeight: 800, color: '#fff' }}>{initials}</div>
                )}
                {uploadingPhoto ? (
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', fontSize: 10, fontWeight: 700, color: '#fff' }}>Subiendo…</div>
                ) : null}
                <button onClick={() => fileRef.current?.click()} disabled={uploadingPhoto} style={{ position: 'absolute', bottom: -4, right: -4, width: 30, height: 30, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid var(--border)', boxShadow: '0 2px 6px rgba(0,0,0,0.12)', cursor: uploadingPhoto ? 'default' : 'pointer', opacity: uploadingPhoto ? 0.6 : 1 }}>
                  <Icon name="camera" size={14} color="var(--brand)" />
                </button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--text-dark)' }}>{name} {lastname}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>{email}</div>
              </div>
            </div>
            {saved ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, background: '#F0FFF8', border: '1px solid #C6F6D5' }}>
                <Icon name="check-circle" size={16} color="var(--success)" />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#276749' }}>Perfil actualizado correctamente</span>
              </div>
            ) : null}
            {saveError ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, background: '#FFF5F5', border: '1px solid #FEB2B2' }}>
                <Icon name="x" size={16} color="#C53030" />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#C53030' }}>{saveError}</span>
              </div>
            ) : null}

            <SectionLabel>Información personal</SectionLabel>
            <Field label="Nombre" icon="user" value={name} onChangeText={setName} placeholder="Tu nombre" />
            <Field label="Apellido" icon="user" value={lastname} onChangeText={setLastname} placeholder="Tu apellido" />

            <SectionLabel>Contacto</SectionLabel>
            <Field label="Correo electrónico" icon="mail" value={email} onChangeText={setEmail} type="email" autoCapitalize="none" placeholder="correo@ejemplo.com" />
            <Field label="Teléfono" icon="phone" value={phone} onChangeText={setPhone} placeholder="+502 1234 5678" />

            <SectionLabel>Institución</SectionLabel>
            <SelectOrAdd label="Institución" icon="map-pin" value={institucion} options={schools} onChange={setInstitucion} newPlaceholder="Nombre de la institución" />
            <LocationAutocomplete label="Ubicación" value={ubicacion} onChange={setUbicacion} />

            <PrimaryButton label={saving ? 'Guardando…' : 'Guardar cambios'} onClick={handleSave} disabled={saving} />
            {pending.profile ? (
              <p className="pending-note">
                <Icon name="clock" size={14} color="currentColor" />
                Tus cambios están guardados en esta tablet y se enviarán cuando haya conexión.
              </p>
            ) : null}
          </>
        )}

        <button onClick={() => navigate('/sobre')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12, background: '#fff', border: '1.5px solid var(--border)' }}>
          <Icon name="help-circle" size={18} color="var(--brand)" />
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: 'var(--text-dark)', textAlign: 'left' }}>Sobre ExplorArte</span>
          <Icon name="chevron-right" size={16} color="var(--text-muted)" />
        </button>

        <button onClick={logout} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 12, background: '#FFF5F5', border: '1.5px solid #FEB2B2', color: '#C53030', fontSize: 14, fontWeight: 700 }}>
          <Icon name="log-out" size={16} color="#C53030" /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4, marginBottom: -4 }}>{children}</div>;
}
