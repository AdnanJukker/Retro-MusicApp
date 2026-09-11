import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { AlbumArt } from '@/components/AlbumArt';
import { Colors, MiniPlayerHeight, Radius, Spacing, Type } from '@/constants/theme';
import { useCurrentTrack, usePlayerStore } from '@/store/playerStore';

export function MiniPlayer() {
  const router = useRouter();
  const track = useCurrentTrack();
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const error = usePlayerStore((s) => s.error);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const retryPlayback = usePlayerStore((s) => s.retryPlayback);
  const nextTrack = usePlayerStore((s) => s.nextTrack);

  if (!track) return null;

  const ratio = duration > 0 ? Math.min(1, position / duration) : 0;
  // No artist metadata on a live search result just means we don't show a
  // second line — an error always takes priority when there is one.
  const subtitle = error ?? track.artist ?? null;

  return (
    <View style={[styles.wrap, { height: MiniPlayerHeight }]}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
      </View>
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open player for ${track.title}`} style={styles.trackButton} onPress={() => router.push('/player')}>
        <AlbumArt
          seed={track.art}
          artworkUrl={track.artwork}
          label={track.title}
          size={38}
          catalogId={track.id}
          showInitial={false}
          style={styles.art}
        />
        <View style={styles.info}>
          <Text style={Type.bodyMdSemiBold} numberOfLines={1}>
            {track.title}
          </Text>
          {subtitle ? (
            <Text style={[Type.bodySm, styles.artist, error && styles.errorText]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isLoading ? 'Cancel loading' : error ? 'Retry playback' : isPlaying ? 'Pause' : 'Play'}
          onPress={error ? retryPlayback : togglePlayPause}
          style={[styles.playButton, isLoading && styles.playButtonBusy]}>
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.background} />
          ) : (
            <Feather name={error ? 'refresh-cw' : isPlaying ? 'pause' : 'play'} size={16} color={Colors.background} />
          )}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Next track" onPress={nextTrack} style={styles.iconButton}>
          <Feather name="skip-forward" size={16} color={Colors.ink} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  trackButton: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 48 },
  wrap: {
    backgroundColor: Colors.surfaceRaised,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.hairlineStrong,
  },
  progressTrack: {
    height: 2,
    backgroundColor: Colors.well,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
  },
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  info: {
    flex: 1,
    gap: 1,
  },
  art: {
    borderRadius: Radius.sm,
  },
  artist: {
    color: Colors.textSecondary,
  },
  errorText: {
    color: Colors.accent,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonBusy: {
    opacity: 0.8,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
