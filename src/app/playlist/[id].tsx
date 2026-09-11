import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlbumArt } from '@/components/AlbumArt';
import { MiniPlayer } from '@/components/MiniPlayer';
import { RetroButton } from '@/components/RetroButton';
import { TrackRow } from '@/components/TrackRow';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { getPlaylistById, getTracksByIds } from '@/data/selectors';
import { useCurrentTrack, usePlayerStore } from '@/store/playerStore';

export default function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const playlist = getPlaylistById(id);
  const tracks = playlist ? getTracksByIds(playlist.trackIds) : [];

  const current = useCurrentTrack();
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const favorites = usePlayerStore((s) => s.favorites);
  const toggleFavorite = usePlayerStore((s) => s.toggleFavorite);

  if (!playlist) {
    return (
      <View style={[styles.flex, styles.notFound, { paddingTop: insets.top }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace('/library')} style={styles.backButton}>
          <Feather name="chevron-left" size={18} color={Colors.ink} />
        </Pressable>
        <Text style={Type.bodyMd}>This playlist could not be found.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { paddingBottom: insets.bottom }]}>
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{ paddingTop: insets.top + Spacing.sm, paddingBottom: Spacing.xxxl }}
      showsVerticalScrollIndicator={false}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace('/library')} style={styles.backButton}>
        <Feather name="chevron-left" size={18} color={Colors.ink} />
      </Pressable>

      <View style={styles.hero}>
        <AlbumArt seed={playlist.art} label={playlist.title} size={180} catalogId={playlist.id} style={styles.art} />
        <Text style={[Type.headlineLg, styles.title]}>{playlist.title}</Text>
        <Text style={[Type.bodyMd, styles.description]}>{playlist.description}</Text>
        <Text style={[Type.bodySm, styles.meta]}>{tracks.length} tracks</Text>

        <View style={styles.actionsRow}>
          <RetroButton
            label="Find similar music"
            icon="search"
            size="lg"
            onPress={() => router.navigate({ pathname: '/search', params: { q: tracks[0]?.genre ?? 'Retro' } })}
            style={styles.playButton}
          />
        </View>
      </View>

      <View>
        {tracks.map((track, index) => (
          <TrackRow
            key={track.id}
            track={track}
            index={index + 1}
            showArt={false}
            isActive={current?.id === track.id}
            isPlaying={isPlaying}
            onPress={() => playTrack(track, tracks)}
            isFavorite={favorites.some((t) => t.id === track.id)}
            onToggleFavorite={() => toggleFavorite(track)}
          />
        ))}
      </View>
    </ScrollView>
    <MiniPlayer />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  notFound: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: Radius.full,
  },
  hero: { alignItems: 'center', paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  art: { borderRadius: Radius.md },
  title: { textAlign: 'center', marginTop: Spacing.md },
  description: { color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm },
  meta: { color: Colors.textSecondary, marginTop: Spacing.xs },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.lg },
  playButton: { flexGrow: 1 },
});
