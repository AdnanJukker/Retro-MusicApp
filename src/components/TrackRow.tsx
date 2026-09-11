import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { AlbumArt } from '@/components/AlbumArt';
import { EqualizerBars } from '@/components/EqualizerBars';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { usePlayerStore } from '@/store/playerStore';
import type { Track } from '@/types/music';
import { formatDuration } from '@/utils/format';

interface TrackRowProps {
  track: Track;
  index?: number;
  showArt?: boolean;
  isActive?: boolean;
  isPlaying?: boolean;
  onPress?: () => void;
  /** Shows a heart in place of the play icon; reflects and toggles favorite state. */
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  subtitle?: string;
}

export function TrackRow({
  track,
  index,
  showArt = true,
  isActive = false,
  isPlaying = false,
  onPress,
  isFavorite,
  onToggleFavorite,
  subtitle,
}: TrackRowProps) {
  const router = useRouter();
  const togglePlayPause = usePlayerStore((state) => state.togglePlayPause);
  const isDemo = track.source !== 'youtube-music';
  const activate = isDemo ? () => router.navigate({ pathname: '/search', params: { q: track.artist ?? track.genre ?? track.title } }) : isActive ? togglePlayPause : onPress;
  const favoriteAction = !isDemo && onToggleFavorite;
  // No artist/year on a live search result isn't an error — just don't
  // claim to know something we don't, rather than padding the row with a
  // repeated "Unknown Artist" on every result.
  const subtitleText = subtitle ?? [track.artist, track.year].filter(Boolean).join(' • ');

  return (
    <View style={[styles.row, isActive && styles.active]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${isDemo ? 'Find music like' : isActive && isPlaying ? 'Pause' : 'Play'} ${track.title}${track.artist ? ` by ${track.artist}` : ''}`} accessibilityState={{ selected: isActive }} onPress={activate} style={({ pressed }) => [styles.trackButton, pressed && styles.pressed]}>
      {index !== undefined ? (
        <View style={styles.indexSlot}>
          {isActive && isPlaying ? (
            <EqualizerBars size={13} color={Colors.accent} />
          ) : (
            <Text style={[Type.techLg, styles.index, isActive && styles.indexActive]}>
              {String(index).padStart(2, '0')}
            </Text>
          )}
        </View>
      ) : null}
      {showArt ? (
        <AlbumArt
          seed={track.art}
          artworkUrl={track.artwork}
          label={track.title}
          size={42}
          catalogId={track.id}
          style={styles.art}
        />
      ) : null}
      <View style={styles.info}>
        <Text
          style={[Type.bodyMdSemiBold, isActive && styles.titleActive]}
          numberOfLines={1}>
          {track.title}
        </Text>
        {subtitleText ? (
          <Text style={[Type.bodySm, styles.subtitle]} numberOfLines={1}>
            {subtitleText}
          </Text>
        ) : null}
      </View>
      {track.duration != null ? <Text style={[Type.techMd, styles.duration]}>{formatDuration(track.duration)}</Text> : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={favoriteAction ? `${isFavorite ? 'Unlike' : 'Like'} ${track.title}` : `${isDemo ? 'Find music like' : isActive && isPlaying ? 'Pause' : 'Play'} ${track.title}`}
        accessibilityState={favoriteAction ? { selected: isFavorite } : undefined}
        onPress={favoriteAction || activate}
        style={[styles.trailingButton, isFavorite && styles.trailingButtonActive]}>
        <Feather
          name={favoriteAction ? 'heart' : isDemo ? 'search' : isActive && isPlaying ? 'pause' : 'play'}
          size={14}
          color={isFavorite ? Colors.background : Colors.ink}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  trackButton: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 52 },
  active: { backgroundColor: Colors.accentSoft, borderLeftWidth: 3, borderLeftColor: Colors.accent },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hairline,
  },
  pressed: {
    backgroundColor: Colors.overlayInk,
  },
  indexSlot: {
    width: 22,
    alignItems: 'flex-start',
  },
  index: {
    color: Colors.textSecondary,
  },
  indexActive: {
    color: Colors.accent,
  },
  art: {
    borderRadius: Radius.sm,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  titleActive: {
    color: Colors.accent,
  },
  subtitle: {
    color: Colors.textSecondary,
  },
  duration: {
    color: Colors.textSecondary,
  },
  trailingButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailingButtonActive: {
    backgroundColor: Colors.accent,
  },
});
