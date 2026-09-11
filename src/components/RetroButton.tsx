import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Colors, Radius, Spacing, Type } from '@/constants/theme';

type FeatherIconName = ComponentProps<typeof Feather>['name'];

interface RetroButtonProps {
  label: string;
  onPress?: () => void;
  icon?: FeatherIconName;
  variant?: 'primary' | 'outline' | 'dark';
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export function RetroButton({
  label,
  onPress,
  icon,
  variant = 'primary',
  size = 'md',
  style,
  disabled,
}: RetroButtonProps) {
  const palette =
    variant === 'primary'
      ? { bg: Colors.accent, fg: Colors.background, border: 'transparent' }
      : variant === 'dark'
        ? { bg: Colors.ink, fg: Colors.background, border: 'transparent' }
        : { bg: Colors.surface, fg: Colors.ink, border: Colors.hairline };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' && styles.baseLg,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <View style={styles.content}>
        {icon ? <Feather name={icon} size={size === 'lg' ? 18 : 15} color={palette.fg} /> : null}
        <Text style={[Type.labelCaps, { color: palette.fg }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseLg: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  pressed: {
    transform: [{ translateY: 1 }],
    opacity: 0.92,
  },
  disabled: {
    opacity: 0.5,
  },
});
