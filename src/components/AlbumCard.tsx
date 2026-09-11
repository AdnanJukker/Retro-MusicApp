import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AlbumArt } from '@/components/AlbumArt';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import type { ArtSeed } from '@/types/music';

interface AlbumCardProps {
  id: string;
  title: string;
  subtitle: string;
  /** Optional — AlbumArt derives a deterministic placeholder when omitted. */
  art?: ArtSeed;
  artworkUrl?: string;
  width?: number;
  onPress?: () => void;
}

export function AlbumCard({ id, title, subtitle, art, artworkUrl, width = 148, onPress }: AlbumCardProps) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [{ width }, pressed && styles.pressed]}>
      <View style={styles.artWrap}>
        <AlbumArt seed={art} artworkUrl={artworkUrl} label={title} catalogId={id} style={styles.art} />
      </View>
      <Text style={Type.bodyMdSemiBold} numberOfLines={1}>
        {title}
      </Text>
      {subtitle.trim() ? (
        <Text style={[Type.bodySm, styles.subtitle]} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.85,
  },
  artWrap: {
    marginBottom: Spacing.sm,
  },
  art: {
    borderRadius: Radius.sm,
  },
  subtitle: {
    color: Colors.textSecondary,
    marginTop: 1,
  },
});
