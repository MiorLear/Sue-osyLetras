import { usePathname, useRouter } from 'expo-router';
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
  const pathname = usePathname();
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
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Pressable
            key={item.href + item.label}
            onPress={() => {
              if (!active) router.replace(item.href as never);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 48,
              paddingVertical: 9,
              paddingHorizontal: 6,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              backgroundColor: active ? colors.navBg : '#fff',
              borderWidth: 1.5,
              borderColor: active ? 'rgba(61,191,184,0.28)' : 'transparent',
              opacity: pressed ? 0.82 : 1,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}>
            <Icon name={item.icon} size={21} color={active ? colors.brandDark : colors.textMuted} />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              style={{
                fontSize: 10.5,
                fontWeight: active ? '800' : '700',
                color: active ? colors.textDark : colors.textMuted,
                textAlign: 'center',
                maxWidth: '100%',
              }}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
