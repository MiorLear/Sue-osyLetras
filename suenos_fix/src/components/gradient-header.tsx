import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { useWindowDimensions, View, ViewStyle } from 'react-native';

import { brandGradient } from '@/constants/theme';

interface Props {
  children: ReactNode;
  paddingTop?: number;
  paddingBottom?: number;
  style?: ViewStyle;
}

// Header con degradado de marca y círculos decorativos translúcidos.
export function GradientHeader({ children, paddingTop = 24, paddingBottom = 24, style }: Props) {
  const { width } = useWindowDimensions();
  const horizontalPadding = Math.min(28, Math.max(16, Math.round(width * 0.055)));

  return (
    <LinearGradient
      colors={brandGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        {
          paddingTop,
          paddingBottom,
          paddingHorizontal: horizontalPadding,
          overflow: 'hidden',
        },
        style,
      ]}>
      <View
        style={{
          position: 'absolute',
          top: -32,
          right: -32,
          width: 112,
          height: 112,
          borderRadius: 56,
          opacity: 0.2,
          backgroundColor: '#fff',
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: -24,
          left: -24,
          width: 80,
          height: 80,
          borderRadius: 40,
          opacity: 0.1,
          backgroundColor: '#fff',
        }}
      />
      {children}
    </LinearGradient>
  );
}
