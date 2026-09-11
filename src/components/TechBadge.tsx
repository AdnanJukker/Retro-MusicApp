import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Spacing, Type } from '@/constants/theme';

interface TechBadgeProps {
  label: string;
  tone?: 'default' | 'accent' | 'gold' | 'olive';
  style?: StyleProp<ViewStyle>;
}

const TONES: Record<NonNullable<TechBadgeProps['tone']>, { border: string; bg: string; text: string }> = {
  default: { border: Colors.hairlineStrong, bg: Colors.surface, text: Colors.textSecondary },
  accent: { border: Colors.accent, bg: Colors.accentSoft, text: Colors.accent },
  gold: { border: Colors.gold, bg: Colors.goldSoft, text: Colors.ink },
  olive: { border: Colors.olive, bg: Colors.oliveSoft, text: Colors.olive },
};

export function TechBadge({ label, tone = 'default', style }: TechBadgeProps) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { borderColor: t.border, backgroundColor: t.bg }, style]}>
      <Text style={[Type.techSm, { color: t.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
});
