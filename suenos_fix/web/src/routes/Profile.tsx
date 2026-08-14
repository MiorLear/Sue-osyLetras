import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { Masthead } from '@/components/Masthead';
import { Field, LocationAutocomplete, PrimaryButton, SelectOrAdd } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { useSchools } from '@/lib/useSchools';

export default function Profile() {
  const navigate = useNavigate();
  const { setUser, signOut } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: profile, loading, error, reload } = useAsync(() => api.profile.get(), []);
  const schools = useSchools();

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
    try {
      const updated = await api.profile.update({ name, lastname, email, phone, institucion, ubicacion, photo });
      setUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveError(
        e instanceof Error ? e.message : 'No pudimos guardar los cambios. Inténtalo de nuevo.',
      );
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
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, padding: '40px 0' }}>Cargando…</p>
        ) : error ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 0' }}>
            <p style={{ color: 'var(--text-body)', fontSize: 14, textAlign: 'center', margin: 0 }}>
              No pudimos cargar tu perfil. Revisa tu conexión.
            </p>
            <button
              onClick={reload}
              style={{ padding: '9px 18px', borderRadius: 10, background: 'var(--brand)', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>
              Reintentar
            </button>
          </div>
        ) : profile ? (
          <>
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
          </>
        ) : null}

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
