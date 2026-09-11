import { useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Type } from '@/constants/theme';
import type { ArtSeed } from '@/types/music';

const PALETTES: Record<ArtSeed['palette'], string> = {
  accent: Colors.accent,
  gold: Colors.gold,
  olive: Colors.olive,
  ink: Colors.ink,
};

interface VinylDiscProps {
  size: number;
  spinning: boolean;
  seed?: ArtSeed;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function VinylDisc({ size, spinning, seed, label = 'SIDE A', style }: VinylDiscProps) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (spinning) {
      rotation.value = withRepeat(
        withTiming(rotation.value + 360, { duration: 6000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      cancelAnimation(rotation);
    }
    return () => cancelAnimation(rotation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const labelColor = seed ? PALETTES[seed.palette] : Colors.accent;
  const ringSizes = [1, 0.82, 0.66, 0.5];

  return (
    <Animated.View style={[{ width: size, height: size, borderRadius: size / 2 }, styles.disc, animatedStyle, style]}>
      {ringSizes.map((s, i) => (
        <View
          key={i}
          style={[
            styles.ring,
            {
              width: size * s,
              height: size * s,
              borderRadius: (size * s) / 2,
              borderColor: i % 2 === 0 ? 'rgba(243,233,210,0.10)' : 'rgba(243,233,210,0.04)',
            },
          ]}
        />
      ))}
      <View style={[styles.center, { width: size * 0.34, height: size * 0.34, borderRadius: (size * 0.34) / 2, backgroundColor: labelColor }]}>
        <Text style={[Type.techSm, styles.centerText]} numberOfLines={1}>
          {label}
        </Text>
        <View style={styles.spindle} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  disc: {
    backgroundColor: '#1B1815',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#100E0C',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  centerText: {
    color: Colors.background,
    fontSize: 8,
    lineHeight: 10,
  },
  spindle: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.background,
    marginTop: 2,
  },
});
