import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { usePlayerStore } from '@/store/playerStore';

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={[Type.labelCaps, styles.groupTitle]}>{title}</Text>
      <View>{children}</View>
    </View>
  );
}

function SettingsRow({
  label,
  value,
  onPress,
  destructive,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && onPress ? styles.rowPressed : null]}>
      <Text style={[Type.bodyMd, destructive && styles.destructiveText]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={[Type.bodySm, styles.rowValue]}>{value}</Text> : null}
        {onPress ? <Feather name="chevron-right" size={16} color={Colors.textSecondary} /> : null}
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const clearHistory = usePlayerStore((state) => state.clearHistory);
  const clearFavorites = usePlayerStore((state) => state.clearFavorites);
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const confirmClearHistory = () => {
    Alert.alert('Clear recent plays?', 'This removes your recently played history from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearHistory },
    ]);
  };

  const confirmClearFavorites = () => {
    Alert.alert('Clear liked songs?', 'This removes every song you have liked on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearFavorites },
    ]);
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.xxxl }}
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={styles.backButton}
          hitSlop={8}>
          <Feather name="chevron-left" size={20} color={Colors.ink} />
        </Pressable>
        <Text style={Type.headlineLg}>Settings</Text>
      </View>

      <SettingsGroup title="Playback">
        <SettingsRow label="Audio quality" value="Auto" />
        <SettingsRow label="Playback" value="Streaming" />
      </SettingsGroup>

      <SettingsGroup title="Library">
        <SettingsRow label="Clear recent plays" onPress={confirmClearHistory} />
        <SettingsRow label="Clear liked songs" onPress={confirmClearFavorites} />
      </SettingsGroup>

      <SettingsGroup title="App">
        <SettingsRow label="Appearance" value="Warm" />
        <SettingsRow label="About" value="Hi-Fi Archive" />
        <SettingsRow label="Version" value={version} />
      </SettingsGroup>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    marginBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing.sm,
    borderRadius: Radius.md,
  },
  group: {
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  groupTitle: {
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hairline,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  rowValue: {
    color: Colors.textSecondary,
  },
  destructiveText: {
    color: Colors.accent,
  },
});
