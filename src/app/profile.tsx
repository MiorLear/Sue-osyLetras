import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav, MAIN_TABS } from '@/components/bottom-nav';
import { Icon } from '@/components/icon';
import { Field, LocationAutocomplete, PrimaryButton, SelectOrAdd } from '@/components/ui';
import { brandGradient, colors, INSTITUCIONES } from '@/constants/theme';

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

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [photo, setPhoto] = useState<string | null>(null);
  const [name, setName] = useState('María Reneé');
  const [lastname, setLastname] = useState('García López');
  const [email, setEmail] = useState('maria@ejemplo.com');
  const [phone, setPhone] = useState('+503 7000 1234');
  const [institucion, setInstitucion] = useState('Colegio Americano');
  const [ubicacion, setUbicacion] = useState('San Salvador');
  const [saved, setSaved] = useState(false);

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

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
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
          options={INSTITUCIONES}
          onChange={setInstitucion}
          newPlaceholder="Nombre de la institución"
        />
        <LocationAutocomplete label="Ubicación" value={ubicacion} onChange={setUbicacion} />

        <PrimaryButton label="Guardar cambios" onPress={handleSave} />

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
          onPress={() => router.replace('/login')}
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
