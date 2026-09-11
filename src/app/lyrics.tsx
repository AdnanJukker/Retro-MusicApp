import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { useLyrics } from '@/hooks/useLyrics';
import { useCurrentTrack } from '@/store/playerStore';

export default function LyricsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const track = useCurrentTrack();
  const { state, lyrics, errorMessage, retry } = useLyrics(track?.id);

  return (
    <View style={[styles.flex, { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.md }]}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close lyrics" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.chevronButton}>
          <Feather name="chevron-down" size={18} color={Colors.ink} />
        </Pressable>
        <View style={styles.titlePill}>
          <Feather name="align-left" size={12} color={Colors.accent} />
          <Text style={[Type.labelCaps, styles.titlePillText]}>Lyrics</Text>
        </View>
        <View style={styles.chevronButton} />
      </View>

      {track ? (
        <View style={styles.trackHeader}>
          <Text style={Type.headlineMd} numberOfLines={1}>
            {track.title}
          </Text>
          {track.artist ? <Text style={[Type.bodyMdSemiBold, styles.trackArtist]} numberOfLines={1}>{track.artist}</Text> : null}
        </View>
      ) : null}

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>
        {!track ? (
          <View style={styles.centerState}>
            <Feather name="disc" size={28} color={Colors.textSecondary} />
            <Text style={[Type.bodyMd, styles.centerText]}>Nothing is playing yet.</Text>
          </View>
        ) : state === 'loading' ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="small" color={Colors.accent} />
            <Text style={[Type.bodyMd, styles.centerText]}>Loading lyrics…</Text>
          </View>
        ) : state === 'unavailable' ? (
          <View style={styles.centerState}>
            <Feather name="mic-off" size={28} color={Colors.textSecondary} />
            <Text style={[Type.bodyMd, styles.centerText]}>Lyrics unavailable for this track.</Text>
          </View>
        ) : state === 'error' ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Retry loading lyrics" onPress={retry} style={styles.centerState}>
            <Feather name="alert-triangle" size={28} color={Colors.accent} />
            <Text style={[Type.bodyMd, styles.centerTextAccent]}>
              {errorMessage ?? "Couldn't load lyrics."}
            </Text>
            <Text style={[Type.labelCaps, styles.centerTextAccent]}>Tap to retry</Text>
          </Pressable>
        ) : (
          <Text style={[Type.bodyLg, styles.lyricsText]}>{lyrics}</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  chevronButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  titlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  titlePillText: { fontSize: 11 },
  trackHeader: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hairline,
  },
  trackArtist: { color: Colors.accent, marginTop: 2 },
  body: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    flexGrow: 1,
  },
  lyricsText: {
    lineHeight: 26,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xxxl,
  },
  centerText: {
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  centerTextAccent: {
    color: Colors.accent,
    textAlign: 'center',
  },
});
