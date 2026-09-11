import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlbumArt } from '@/components/AlbumArt';
import { MiniPlayer } from '@/components/MiniPlayer';
import { AlbumCard } from '@/components/AlbumCard';
import { RetroButton } from '@/components/RetroButton';
import { SectionHeader } from '@/components/SectionHeader';
import { TrackRow } from '@/components/TrackRow';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { getAlbumsByArtist, getArtistById, getTracksByArtist } from '@/data/selectors';
import { useCurrentTrack, usePlayerStore } from '@/store/playerStore';

export default function ArtistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const following = usePlayerStore((state) => state.followedArtists.includes(id));
  const toggleFollowArtist = usePlayerStore((state) => state.toggleFollowArtist);

  const artist = getArtistById(id);
  const tracks = artist ? getTracksByArtist(artist.id) : [];
  const albums = artist ? getAlbumsByArtist(artist.id) : [];

  const current = useCurrentTrack();
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const favorites = usePlayerStore((s) => s.favorites);
  const toggleFavorite = usePlayerStore((s) => s.toggleFavorite);

  if (!artist) {
    return (
      <View style={[styles.flex, styles.notFound, { paddingTop: insets.top }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace('/library')} style={styles.backButton}>
          <Feather name="chevron-left" size={18} color={Colors.ink} />
        </Pressable>
        <Text style={Type.bodyMd}>This artist is not in the archive.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { paddingBottom: insets.bottom }]}>
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{ paddingBottom: Spacing.xxxl }}
      showsVerticalScrollIndicator={false}>
      <View style={styles.banner}>
        <AlbumArt seed={artist.art} label={artist.name} showInitial size="100%" aspectRatio={1.6} />
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace('/library')}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={[styles.backButton, styles.backButtonFloating, { top: insets.top + Spacing.sm }]}
          hitSlop={8}>
          <Feather name="chevron-left" size={18} color={Colors.ink} />
        </Pressable>
      </View>

      <View style={styles.info}>
        <Text style={[Type.bodySm, styles.genre]}>{artist.genre}</Text>
        <Text style={Type.headlineLg}>{artist.name}</Text>

        <View style={styles.actionsRow}>
          <RetroButton
            label="Find music"
            icon="search"
            size="lg"
            onPress={() => router.navigate({ pathname: '/search', params: { q: artist.name } })}
            style={styles.playButton}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: following }}
            onPress={() => toggleFollowArtist(id)}
            style={[styles.followButton, following && styles.followButtonActive]}>
            <Text style={[Type.labelCaps, { color: following ? Colors.background : Colors.ink }]}>
              {following ? 'Following' : 'Follow'}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Popular Tracks" />
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
      </View>

      {albums.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Albums" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hScroll}>
            {albums.map((album) => (
              <AlbumCard
                key={album.id}
                id={album.id}
                title={album.title}
                subtitle={String(album.year)}
                art={album.art}
                onPress={() => router.navigate({ pathname: '/search', params: { q: `${album.artist} ${album.title}` } })}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="About" />
        <Text style={[Type.bodyMd, styles.bio]}>{artist.bio}</Text>
      </View>
    </ScrollView>
    <MiniPlayer />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  notFound: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg },
  banner: { position: 'relative' },
  backButton: {
    width: 44,
    height: 44,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  backButtonFloating: { position: 'absolute', left: Spacing.lg },
  info: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, marginBottom: Spacing.xxl },
  genre: { color: Colors.accent, marginBottom: 4 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.lg },
  playButton: { flexGrow: 1 },
  followButton: {
    borderWidth: 1,
    borderColor: Colors.hairline,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  followButtonActive: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  section: { marginBottom: Spacing.xxl, paddingHorizontal: Spacing.lg },
  hScroll: { gap: Spacing.md, paddingTop: Spacing.md },
  bio: { color: Colors.textSecondary, marginTop: Spacing.md, lineHeight: 21 },
});
