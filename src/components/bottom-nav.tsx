import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, IconName } from '@/components/icon';
import { colors } from '@/constants/theme';

export interface NavItem {
  icon: IconName;
  label: string;
  href: string;
}

// Pestañas principales de la app, compartidas por las pantallas post-login.
export const MAIN_TABS: NavItem[] = [
  { icon: 'home', label: 'Inicio', href: '/main' },
  { icon: 'compass', label: 'Explora', href: '/emociones' },
  { icon: 'message-circle', label: 'Comunidad', href: '/comunidad' },
  { icon: 'user', label: 'Perfil', href: '/profile' },
];

// Barra de navegación inferior con dos accesos, como en los mockups.
export function BottomNav({ items }: { items: NavItem[] }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: Math.max(insets.bottom, 16),
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}>
      {items.map((item) => (
        <Pressable
          key={item.href + item.label}
          onPress={() => router.push(item.href as never)}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: 8,
            borderRadius: 16,
            alignItems: 'center',
            gap: 4,
            backgroundColor: colors.navBg,
            borderWidth: 1.5,
            borderColor: 'rgba(61,191,184,0.2)',
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}>
          <Icon name={item.icon} size={22} color={colors.brand} />
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: colors.textDark,
              textAlign: 'center',
            }}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
