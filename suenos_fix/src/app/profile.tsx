import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav, MAIN_TABS } from '@/components/bottom-nav';
import { Icon } from '@/components/icon';
import { Field, LocationAutocomplete, PrimaryButton, SelectOrAdd } from '@/components/ui';
import { brandGradient, colors } from '@/constants/theme';
import { api, setAuthToken } from '@/lib/api';
import { syncAllContent } from '@/lib/media-sync';
import { enqueueProfileUpdate } from '@/lib/mutation-queue';
import { showNotice } from '@/lib/notice';
import { writeCache } from '@/lib/offline-cache';
import { useIsMetered, useIsOnline } from '@/lib/useNetworkStatus';
import { useOfflineAsync } from '@/lib/useOfflineAsync';
import { useSchools } from '@/lib/useSchools';

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '700',
        color: colors.brand,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginTop: 4,
        marginBottom: -4,
      }}>
      {children}
    </Text>
  );
}

// Descarga de contenido para uso sin conexión (SCALE-03).
//
// Bajar los vídeos y PDFs son megabytes; hacerlo solo porque la tablet cambió
// de wifi a datos gastaba el plan de la profesora sin que ella lo pidiera. Ahora
// la app sincroniza sola el JSON (kilobytes) y la descarga pesada vive aquí,
// detrás de un botón, con aviso explícito cuando la conexión es de pago.
function OfflineContentRow() {
  const online = useIsOnline();
  const metered = useIsMetered();
  const [downloading, setDownloading] = useState(false);

  const start = async () => {
    if (!online) {
      showNotice('Sin conexión', 'Conéctate a internet para descargar el contenido.');
      return;
    }
    setDownloading(true);
    try {
      await syncAllContent();
      showNotice('Contenido descargado', 'Ya puedes abrir los materiales sin conexión.');
    } catch {
      showNotice('No se pudo descargar todo', 'Vuelve a intentarlo cuando tengas mejor conexión.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Pressable
      onPress={start}
      disabled={downloading}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: colors.border,
        opacity: downloading ? 0.6 : 1,
      }}>
      <Icon name="download" size={18} color={colors.brand} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13.5, fontWeight: '600', color: colors.textDark }}>
          {downloading ? 'Descargando contenido…' : 'Descargar contenido sin conexión'}
        </Text>
        <Text style={{ marginTop: 2, fontSize: 11.5, color: colors.textMuted }}>
          {metered
            ? 'Estás usando datos móviles: puede consumir tu plan.'
            : 'Guarda vídeos y documentos para usarlos sin internet.'}
        </Text>
      </View>
      {downloading ? <ActivityIndicator size="small" color={colors.brand} /> : null}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: profile, loading, error, reload } = useOfflineAsync('profile:me', () => api.profile.get(), []);
  const schools = useSchools();
  const online = useIsOnline();

  const [photo, setPhoto] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [institucion, setInstitucion] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Seed the editable form fields once the profile finishes loading.
  useEffect(() => {
    if (!profile) return;
    setPhoto(profile.photo ?? null);
    setName(profile.name);
    setLastname(profile.lastname);
    setEmail(profile.email);
    setPhone(profile.phone);
    setInstitucion(profile.institucion);
    setUbicacion(profile.ubicacion);
  }, [profile]);

  const initials = ((name.charAt(0) || '') + (lastname.charAt(0) || '')).toUpperCase();

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  };

  const handleSave = async () => {
    setSaving(true);
    const textInput = { name, lastname, email, phone, institucion, ubicacion };
    const hasNewPhoto = !!(photo && photo.startsWith('file'));
    // Optimistic cache so the profile shows the edit immediately, even offline.
    const cacheMerged = { ...(profile ?? {}), ...textInput };
    try {
      if (online) {
        // A picked photo starts as a local file:// URI — upload it first so it
        // becomes a real hosted URL visible to others (e.g. the admin list).
        let uploadedPhoto = photo;
        if (hasNewPhoto) {
          const blob = await fetch(photo!).then((r) => r.blob());
          const uploaded = await api.media.upload(blob, 'profile.jpg', 'profile');
          uploadedPhoto = uploaded.url;
        }
        await api.profile.update({ ...textInput, photo: uploadedPhoto });
        void writeCache('profile:me', { ...cacheMerged, photo: uploadedPhoto });
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        // Offline: queue the text fields (a new photo needs a connection to upload).
        await enqueueProfileUpdate(textInput);
        void writeCache('profile:me', cacheMerged);
        showNotice(
          'Guardado sin conexión',
          hasNewPhoto
            ? 'Tus datos se sincronizarán al reconectar. La foto nueva necesita conexión para subirse.'
            : 'Tus cambios se sincronizarán cuando vuelvas a tener conexión.',
        );
      }
    } catch {
      // Online attempt failed mid-way → keep the text edit as a queued change.
      try {
        await enqueueProfileUpdate(textInput);
        void writeCache('profile:me', cacheMerged);
        showNotice('Guardado sin conexión', 'Tus cambios se sincronizarán cuando haya conexión.');
      } catch {
        showNotice('Error', 'No se pudo guardar el perfil. Intenta de nuevo.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await setAuthToken(null);
    router.replace('/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient
        colors={brandGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 16, paddingBottom: 24, paddingHorizontal: 20, overflow: 'hidden' }}>
        <View
          style={{
            position: 'absolute',
            top: -24,
            right: -24,
            width: 96,
            height: 96,
            borderRadius: 48,
            opacity: 0.2,
            backgroundColor: '#fff',
          }}
        />
        <Text
          style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: 12,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.7,
            marginBottom: 16,
          }}>
          Mi Perfil
        </Text>
        <View style={{ alignItems: 'center' }}>
          <View>
            {photo ? (
              <Image
                source={{ uri: photo }}
                style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: '#fff' }}
              />
            ) : (
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  borderWidth: 3,
                  borderColor: '#fff',
                }}>
                <Text style={{ fontSize: 32, fontWeight: '800', color: '#fff' }}>{initials}</Text>
              </View>
            )}
            <Pressable
              onPress={pickPhoto}
              style={{
                position: 'absolute',
                bottom: -4,
                right: -4,
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#fff',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              }}>
              <Icon name="camera" size={15} color={colors.brand} />
            </Pressable>
          </View>
          <Text style={{ marginTop: 12, color: '#fff', fontSize: 16, fontWeight: '800' }}>
            {name} {lastname}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{email}</Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, gap: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {profile ? (
          <>
            {saved ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: '#F0FFF8',
                  borderWidth: 1,
                  borderColor: '#C6F6D5',
                }}>
                <Icon name="check-circle" size={16} color={colors.success} />
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#276749' }}>
                  Perfil actualizado correctamente
                </Text>
              </View>
            ) : null}

            <SectionLabel>Información personal</SectionLabel>
            <Field label="Nombre" icon="user" value={name} onChangeText={setName} placeholder="Tu nombre" />
            <Field
              label="Apellido"
              icon="user"
              value={lastname}
              onChangeText={setLastname}
              placeholder="Tu apellido"
            />

            <SectionLabel>Contacto</SectionLabel>
            <Field
              label="Correo electrónico"
              icon="mail"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="correo@ejemplo.com"
            />
            <Field
              label="Teléfono"
              icon="phone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+502 1234 5678"
            />

            <SectionLabel>Institución</SectionLabel>
            <SelectOrAdd
              label="Institución"
              icon="map-pin"
              value={institucion}
              options={schools}
              onChange={setInstitucion}
              newPlaceholder="Nombre de la institución"
            />
            <LocationAutocomplete label="Ubicación" value={ubicacion} onChange={setUbicacion} />

            <PrimaryButton
              label={saving ? 'Guardando…' : 'Guardar cambios'}
              onPress={handleSave}
              disabled={saving}
            />
          </>
        ) : loading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: 32 }} />
        ) : error ? (
          <View style={{ marginTop: 32, alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 13, color: colors.textBody, textAlign: 'center' }}>
              No pudimos cargar tu perfil. Revisa tu conexión.
            </Text>
            <Pressable
              onPress={reload}
              style={{ paddingVertical: 9, paddingHorizontal: 18, borderRadius: 10, backgroundColor: colors.brand }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Reintentar</Text>
            </Pressable>
          </View>
        ) : null}

        <OfflineContentRow />

        <Pressable
          onPress={() => router.push('/sobre')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 12,
            backgroundColor: '#fff',
            borderWidth: 1.5,
            borderColor: colors.border,
          }}>
          <Icon name="help-circle" size={18} color={colors.brand} />
          <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '600', color: colors.textDark }}>
            Sobre ExplorArte
          </Text>
          <Icon name="chevron-right" size={16} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={handleLogout}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: '#FFF5F5',
            borderWidth: 1.5,
            borderColor: '#FEB2B2',
          }}>
          <Icon name="log-out" size={16} color="#C53030" />
          <Text style={{ color: '#C53030', fontSize: 14, fontWeight: '700' }}>Cerrar sesión</Text>
        </Pressable>
      </ScrollView>

      <BottomNav items={MAIN_TABS} />
    </View>
  );
}
