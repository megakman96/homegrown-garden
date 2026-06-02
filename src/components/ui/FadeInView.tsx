import React, { useEffect } from 'react';
import { ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Spring } from '@/constants/theme';

interface Props {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
  from?: 'bottom' | 'top' | 'scale' | 'fade';
}

export function FadeInView({ children, delay = 0, style, from = 'bottom' }: Props) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(from === 'bottom' ? 24 : from === 'top' ? -24 : 0);
  const scale = useSharedValue(from === 'scale' ? 0.88 : 1);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 380 }));
    if (from === 'bottom' || from === 'top') {
      translateY.value = withDelay(delay, withSpring(0, Spring.gentle));
    }
    if (from === 'scale') {
      scale.value = withDelay(delay, withSpring(1, Spring.gentle));
    }
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>;
}
