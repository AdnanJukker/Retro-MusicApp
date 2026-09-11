import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Type } from '@/constants/theme';

interface SectionHeaderProps {
  title: string;
  meta?: string;
  dotColor?: string;
}

export function SectionHeader({ title, meta, dotColor = Colors.ink }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.titleRow}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={Type.headlineMd}>{title}</Text>
      </View>
      {meta ? <Text style={[Type.techSm, styles.meta]}>{meta}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hairline,
    paddingBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dot: {
    width: 7,
    height: 7,
  },
  meta: {
    color: Colors.textSecondary,
  },
});
