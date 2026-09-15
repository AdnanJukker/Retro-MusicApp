import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { useArtworkMotion } from '@/hooks/useArtworkMotion';

interface EqualizerBarsProps {
  active?: boolean;
  color?: string;
  size?: number;
}

const HEIGHTS = [0.5, 1, 0.7];
const DELAYS = [0, 120, 60];

function Bar({ active, color, height, delay }: { active: boolean; color: string; height: number; delay: number }) {
  const scale = useSharedValue(height);

  useEffect(() => {
    if (active) {
      scale.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 380, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.25, { duration: 380, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
        )
      );
    } else {
      cancelAnimation(scale);
      scale.value = withTiming(height, { duration: 200 });
    }
    return () => cancelAnimation(scale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: scale.value }] }));

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />
    </View>
  );
}

export function EqualizerBars({ active = true, color = Colors.accent, size = 14 }: EqualizerBarsProps) {
  const motionEnabled = useArtworkMotion();
  return (
    <View style={[styles.row, { height: size }]}>
      {HEIGHTS.map((h, i) => (
        <Bar key={i} active={active && motionEnabled} color={color} height={h} delay={DELAYS[i]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  track: {
    width: 3,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    height: '100%',
  },
});
