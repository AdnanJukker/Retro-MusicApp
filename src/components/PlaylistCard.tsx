import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AlbumArt } from '@/components/AlbumArt';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import type { Playlist } from '@/types/music';

interface PlaylistCardProps {
  playlist: Playlist;
  trackCount: number;
  onPress?: () => void;
}

export function PlaylistCard({ playlist, trackCount, onPress }: PlaylistCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${playlist.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.artWrap}>
        <AlbumArt seed={playlist.art} label={playlist.title} catalogId={playlist.id} style={styles.art} />
      </View>
      <Text style={Type.bodyMdSemiBold} numberOfLines={1}>
        {playlist.title}
      </Text>
      <Text style={[Type.bodySm, styles.meta]} numberOfLines={1}>
        {trackCount} tracks
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
  },
  pressed: {
    opacity: 0.8,
  },
  artWrap: {
    marginBottom: Spacing.sm,
  },
  art: {
    borderRadius: Radius.sm,
  },
  meta: {
    color: Colors.textSecondary,
    marginTop: 1,
  },
});
