import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlbumArt } from '@/components/AlbumArt';
import { PlayerControls } from '@/components/PlayerControls';
import { ProgressBar } from '@/components/ProgressBar';
import { TechBadge } from '@/components/TechBadge';
import { VinylDisc } from '@/components/VinylDisc';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { useCurrentTrack, useIsFavorite, usePlayerStore } from '@/store/playerStore';
import { formatDuration } from '@/utils/format';

export default function PlayerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const artworkSize = Math.max(160, Math.min(268, width - 96, height * 0.32));
  const close = () => router.canGoBack() ? router.back() : router.replace('/');
  const track = useCurrentTrack();
  const isFavorite = useIsFavorite(track?.id);

  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const error = usePlayerStore((s) => s.error);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const queue = usePlayerStore((s) => s.queue);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const previousTrack = usePlayerStore((s) => s.previousTrack);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const toggleRepeat = usePlayerStore((s) => s.toggleRepeat);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const toggleFavorite = usePlayerStore((s) => s.toggleFavorite);
  const retryPlayback = usePlayerStore((s) => s.retryPlayback);

  const metaLine = [track?.album?.toUpperCase(), track?.year].filter(Boolean).join(' • ');

  if (!track) {
    return (
      <View style={[styles.flex, styles.emptyWrap, { paddingTop: insets.top }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close player" onPress={close} style={styles.chevronButton}>
          <Feather name="chevron-down" size={18} color={Colors.ink} />
        </Pressable>
        <View style={styles.emptyCenter}>
          <Feather name="disc" size={32} color={Colors.textSecondary} />
          <Text style={[Type.bodyMd, styles.emptyText]}>Nothing loaded on the deck yet.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.xl, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close player" onPress={close} style={styles.chevronButton}>
          <Feather name="chevron-down" size={18} color={Colors.ink} />
        </Pressable>
        <View style={styles.nowPlayingPill}>
          <Feather name="activity" size={12} color={Colors.accent} />
          <Text style={[Type.labelCaps, styles.nowPlayingText]}>{error ? 'Playback paused' : isLoading ? 'Tuning in' : isPlaying ? 'Now playing' : 'On the deck'}</Text>
          <View style={[styles.pulseDot, !isPlaying && styles.inactiveDot]} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Show lyrics" onPress={() => router.push('/lyrics')} style={styles.chevronButton}>
          <Feather name="align-left" size={16} color={Colors.ink} />
        </Pressable>
      </View>

      <View style={styles.badgeRow}>
        <TechBadge label={track.source === 'jiosaavn' ? 'JIOSAAVN' : 'YOUTUBE MUSIC'} tone="accent" />
        <TechBadge label={`TRACK ${currentIndex + 1} / ${queue.length}`} />
      </View>

      {(isLoading || error) && (
        <Pressable
          accessibilityRole={error ? 'button' : undefined}
          accessibilityLabel={error ? `${error} Retry playback` : 'Loading track'}
          disabled={!error}
          onPress={retryPlayback}
          style={styles.statusRow}>
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : (
            <Feather name="refresh-cw" size={12} color={Colors.accent} />
          )}
          <Text style={[Type.bodySm, styles.statusText]} accessibilityLiveRegion="polite">
            {isLoading ? 'Loading track…' : `${error} Tap to retry.`}
          </Text>
        </Pressable>
      )}

      {/* Artwork */}
      <View style={styles.artworkSection}>
        <View style={{ marginRight: -artworkSize * 0.87 }}>
          <VinylDisc size={artworkSize * 1.1} spinning={isPlaying} seed={track.art} />
        </View>
        <AlbumArt
          seed={track.art}
          artworkUrl={track.artwork}
          label={track.title}
          size={artworkSize}
          catalogId={track.id}
          showCatalog
        />
      </View>

      {/* Metadata */}
      <View style={styles.metaRow}>
        <View style={styles.metaText}>
          <Text style={Type.headlineLg} numberOfLines={2}>
            {track.title}
          </Text>
          {track.artist ? (
            <Text style={[Type.bodyMdSemiBold, styles.metaArtist]} numberOfLines={1}>
              {track.artist}
            </Text>
          ) : null}
          {metaLine ? (
            <Text style={[Type.techSm, styles.metaAlbum]} numberOfLines={1}>
              {metaLine}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? 'Remove from liked tracks' : 'Add to liked tracks'}
          accessibilityState={{ selected: isFavorite }}
          onPress={() => toggleFavorite(track)}
          hitSlop={10}
          style={[styles.favoriteButton, isFavorite && styles.favoriteButtonActive]}>
          <Feather
            name="heart"
            size={18}
            color={isFavorite ? Colors.background : Colors.accent}
          />
        </Pressable>
      </View>

      {/* Progress */}
      <View style={styles.progressSection}>
        <ProgressBar progress={position} duration={isLoading ? 0 : duration} onSeek={seekTo} />
        <View style={styles.timeRow}>
          <Text style={[Type.techMd, styles.timeText]}>{formatDuration(position)}</Text>
          <Text style={[Type.techSm, styles.trackLabel]}>TRACK {String(currentIndex + 1).padStart(2, '0')}</Text>
          <Text style={[Type.techMd, styles.timeText]}>{formatDuration(duration)}</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsSection}>
        <PlayerControls
          isPlaying={isPlaying}
          isLoading={isLoading}
          shuffle={shuffle}
          repeat={repeat}
          onPlayPause={togglePlayPause}
          onPrev={previousTrack}
          onNext={nextTrack}
          onToggleShuffle={toggleShuffle}
          onToggleRepeat={toggleRepeat}
        />
      </View>

      {queue.length > 1 ? <View style={styles.queueSection}>
        <View style={styles.queueHeader}>
          <View style={{ flex: 1, gap: 3 }}><Text style={Type.headlineMd}>On the deck</Text><Text style={[Type.bodySm, { color: Colors.textSecondary }]}>{queue.length} songs in this session</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Open playback settings" onPress={() => router.push('/settings')} style={styles.chevronButton}><Feather name="sliders" size={18} color={Colors.ink} /></Pressable>
        </View>
        {queue.map((item, index) => (
          <Pressable key={`${item.id}-${index}`} accessibilityRole="button" accessibilityLabel={`Play ${item.title}`} accessibilityState={{ selected: index === currentIndex }} onPress={() => playTrack(item, queue)} style={[styles.queueRow, index === currentIndex && { backgroundColor: Colors.accentSoft }]}>
            <Text style={[Type.techMd, { color: Colors.accent }]}>{String(index + 1).padStart(2, '0')}</Text>
            <AlbumArt size={38} label={item.title} artworkUrl={item.artwork} seed={item.art} showInitial={false} />
            <View style={styles.queueCopy}><Text style={Type.bodyMdSemiBold} numberOfLines={1}>{item.title}</Text>{item.artist ? <Text style={[Type.bodySm, { color: Colors.textSecondary }]} numberOfLines={1}>{item.artist}</Text> : null}</View>
            <Feather name={index === currentIndex ? 'disc' : 'play'} size={16} color={Colors.accent} />
          </Pressable>
        ))}
      </View> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  queueSection: { marginHorizontal: Spacing.lg, padding: Spacing.md, backgroundColor: Colors.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.hairline, borderRadius: 14, gap: Spacing.sm },
  queueHeader: { flexDirection: 'row', alignItems: 'center', padding: Spacing.xs },
  queueCopy: { flex: 1, gap: 2 },
  queueRow: { minHeight: 62, padding: Spacing.sm, gap: Spacing.sm, flexDirection: 'row', alignItems: 'center', borderRadius: Radius.md },
  flex: { flex: 1, backgroundColor: Colors.background },
  emptyWrap: { paddingHorizontal: Spacing.lg },
  emptyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  emptyText: { color: Colors.textSecondary },
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
  nowPlayingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  nowPlayingText: { fontSize: 11 },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent },
  inactiveDot: { backgroundColor: Colors.well },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  statusText: {
    color: Colors.accent,
    flexShrink: 1,
    textAlign: 'center',
  },
  artworkSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.xl,
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hairline,
  },
  discLayer: {
    marginRight: -202,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  metaText: { flex: 1, gap: 2 },
  metaArtist: { color: Colors.accent },
  metaAlbum: { color: Colors.textSecondary },
  favoriteButton: {
    width: 48,
    height: 48,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  favoriteButtonActive: {
    backgroundColor: Colors.accent,
  },
  progressSection: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  timeText: { color: Colors.textSecondary },
  trackLabel: { color: Colors.olive },
  controlsSection: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
});
