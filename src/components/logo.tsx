import { Image } from 'expo-image';
import { View } from 'react-native';

import { logo } from '@/constants/theme';

// Logo dentro de una tarjeta blanca redondeada, como en los mockups.
export function Logo({ size = 44, radius = 12 }: { size?: number; radius?: number }) {
  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: radius + 4,
        padding: size > 50 ? 8 : 6,
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        borderWidth: 1,
        borderColor: '#E0F5F3',
      }}>
      <Image
        source={logo}
        style={{ width: size, height: size, borderRadius: radius }}
        contentFit="cover"
      />
    </View>
  );
}
