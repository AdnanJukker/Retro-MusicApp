import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Colors, Type } from '@/constants/theme';
import type { RepeatMode } from '@/store/playerStore';

interface PlayerControlsProps {
  isPlaying: boolean;
  isLoading?: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
}

function SideButton({
  icon,
  label,
  accessibilityLabel,
  active,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  accessibilityLabel: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.side, pressed && styles.pressed]}>
      <Feather name={icon} size={19} color={active ? Colors.accent : Colors.ink} />
      <Text style={[Type.techSm, styles.sideLabel, active && { color: Colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

export function PlayerControls({
  isPlaying,
  isLoading = false,
  shuffle,
  repeat,
  onPlayPause,
  onPrev,
  onNext,
  onToggleShuffle,
  onToggleRepeat,
}: PlayerControlsProps) {
  return (
    <View style={styles.row}>
      <SideButton icon="shuffle" label="RND" accessibilityLabel={`Shuffle ${shuffle ? 'on' : 'off'}`} active={shuffle} onPress={onToggleShuffle} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous track"
        onPress={onPrev}
        style={({ pressed }) => [styles.transport, pressed && styles.pressed]}>
        <Feather name="skip-back" size={24} color={Colors.ink} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isLoading ? 'Cancel loading' : isPlaying ? 'Pause' : 'Play'}
        onPress={onPlayPause}
        style={({ pressed }) => [styles.playButton, pressed && styles.playPressed]}>
        {isLoading ? <ActivityIndicator color={Colors.background} /> : <Feather name={isPlaying ? 'pause' : 'play'} size={30} color={Colors.background} />}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next track"
        onPress={onNext}
        style={({ pressed }) => [styles.transport, pressed && styles.pressed]}>
        <Feather name="skip-forward" size={24} color={Colors.ink} />
      </Pressable>
      <SideButton
        icon="repeat"
        label={repeat === 'one' ? '1' : 'RPT'}
        accessibilityLabel={`Repeat ${repeat}`}
        active={repeat !== 'off'}
        onPress={onToggleRepeat}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  side: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  sideLabel: {
    color: Colors.textSecondary,
    fontSize: 8,
    lineHeight: 9,
  },
  transport: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPressed: {
    transform: [{ scale: 0.96 }],
  },
  pressed: {
    transform: [{ translateY: 1 }],
  },
});
