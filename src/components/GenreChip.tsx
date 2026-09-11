import { Pressable, StyleSheet, Text } from 'react-native';

import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import type { Genre } from '@/types/music';

interface GenreChipProps {
  genre: Genre;
  selected?: boolean;
  onPress?: () => void;
}

export function GenreChip({ genre, selected = false, onPress }: GenreChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Search ${genre.name}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipSelected : null,
        pressed && styles.pressed,
      ]}>
      <Text style={[Type.bodyMdSemiBold, selected && styles.labelSelected]}>{genre.name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hairline,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
  },
  chipSelected: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  pressed: {
    opacity: 0.75,
  },
  labelSelected: {
    color: Colors.background,
  },
});
