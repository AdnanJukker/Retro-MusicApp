import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';

export function ScreenHeader({ title, subtitle, eyebrow }: { title: string; subtitle: string; eyebrow?: string }) {
  const router = useRouter();
  return <View style={styles.header}>
    <View style={styles.copy}>
      {eyebrow ? <Text style={[Type.techSm, styles.eyebrow]}>{eyebrow}</Text> : null}
      <Text accessibilityRole="header" style={Type.headlineLg}>{title}</Text>
      <Text style={[Type.bodySm, styles.subtitle]}>{subtitle}</Text>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Open settings" onPress={() => router.push('/settings')}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Feather name="sliders" size={19} color={Colors.ink} />
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, marginBottom: Spacing.xl },
  copy: { flex: 1, gap: Spacing.xs },
  eyebrow: { color: Colors.accent, marginBottom: 2 },
  subtitle: { color: Colors.textSecondary },
  button: { width: 46, height: 46, borderRadius: Radius.full, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.hairline, backgroundColor: Colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: Colors.accentSoft },
});
