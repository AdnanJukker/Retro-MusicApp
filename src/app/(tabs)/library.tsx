import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlaylistCard } from '@/components/PlaylistCard';
import { RetroButton } from '@/components/RetroButton';
import { TrackRow } from '@/components/TrackRow';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors, Spacing, Type } from '@/constants/theme';
import { mockPlaylists } from '@/data';
import { useCurrentTrack, usePlayerStore } from '@/store/playerStore';
import type { Track } from '@/types/music';

type LibraryTab = 'liked' | 'playlists' | 'recent';

const TABS: { id: LibraryTab; label: string }[] = [
  { id: 'liked', label: 'Liked' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'recent', label: 'Recent' },
];

function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.emptyState}>
      <Feather name={icon} size={28} color={Colors.textSecondary} />
      <Text style={Type.headlineMd}>{title}</Text>
      <Text style={[Type.bodyMd, styles.emptyText]}>{message}</Text>
      {actionLabel && onAction ? <RetroButton label={actionLabel} icon="search" onPress={onAction} /> : null}
    </View>
  );
}

function TrackList({
  tracks,
  isFavoriteList,
}: {
  tracks: Track[];
  isFavoriteList?: boolean;
}) {
  const current = useCurrentTrack();
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const favorites = usePlayerStore((s) => s.favorites);
  const toggleFavorite = usePlayerStore((s) => s.toggleFavorite);

  return (
    <View>
      {tracks.map((track, index) => (
        <TrackRow
          key={`${track.id}-${index}`}
          track={track}
          index={index + 1}
          isActive={current?.id === track.id}
          isPlaying={isPlaying}
          onPress={() => playTrack(track, tracks)}
          isFavorite={isFavoriteList || favorites.some((t) => t.id === track.id)}
          onToggleFavorite={() => toggleFavorite(track)}
        />
      ))}
    </View>
  );
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<LibraryTab>('liked');

  const likedTracks = usePlayerStore((s) => s.favorites);
  const history = usePlayerStore((s) => s.history);
  const saveHistory = usePlayerStore((s) => s.saveHistory);
  const playQueue = usePlayerStore((s) => s.playQueue);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{ paddingTop: insets.top + Spacing.sm, paddingBottom: Spacing.xxxl }}
      showsVerticalScrollIndicator={false}>
      <ScreenHeader title="Your collection" subtitle="The records you keep coming back to." eyebrow="Your library / On this device" />

      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <Pressable key={t.id} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => setTab(t.id)} style={[styles.tabItem, active && styles.tabItemActive]}>
              <Text style={[Type.bodyMdSemiBold, active ? styles.tabLabelActive : styles.tabLabel]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.content}>
        {tab === 'liked' ? (
          likedTracks.length === 0 ? (
            <EmptyState
              icon="heart"
              title="No liked songs yet"
              message="Tap the heart while listening to save tracks here."
              actionLabel="Discover Music"
              onAction={() => router.navigate('/search')}
            />
          ) : (
            <View>
              <View style={styles.likedSummary}>
                <View style={styles.likedIcon}><Feather name="heart" size={24} color={Colors.accent} /></View>
                <View style={styles.likedCopy}>
                  <Text style={Type.headlineMd}>Your favorites</Text>
                  <Text style={[Type.bodySm, styles.countLabel]}>{likedTracks.length} {likedTracks.length === 1 ? 'song' : 'songs'} worth keeping</Text>
                </View>
                <RetroButton label="Play all" icon="play" onPress={() => playQueue(likedTracks)} />
              </View>
              <TrackList tracks={likedTracks} isFavoriteList />
            </View>
          )
        ) : null}

        {tab === 'playlists' ? (
          <View style={styles.grid}>
            {mockPlaylists.map((playlist) => (
              <View key={playlist.id} style={styles.gridHalf}>
                <PlaylistCard
                  playlist={playlist}
                  trackCount={playlist.trackIds.length}
                  onPress={() => router.push(`/playlist/${playlist.id}`)}
                />
              </View>
            ))}
          </View>
        ) : null}

        {tab === 'recent' ? (
          history.length === 0 ? (
            <EmptyState
              icon="clock"
              title={saveHistory ? 'Nothing played yet' : 'History is paused'}
              message={saveHistory ? 'Songs you play will show up here.' : 'Turn on recent plays in Settings to keep your listening history.'}
              actionLabel={saveHistory ? 'Discover Music' : 'Open settings'}
              onAction={() => router.navigate(saveHistory ? '/search' : '/settings')}
            />
          ) : (
            <View>
              {!saveHistory ? <Text style={[Type.bodySm, styles.historyNote]}>History is paused. New plays aren’t being saved.</Text> : null}
              <TrackList tracks={history} />
            </View>
          )
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    padding: Spacing.xs,
    gap: Spacing.xs,
    backgroundColor: Colors.well,
    borderRadius: 12,
    marginBottom: Spacing.xl,
  },
  tabItem: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  tabItemActive: { backgroundColor: Colors.ink },
  tabLabel: { color: Colors.textSecondary },
  tabLabelActive: { color: Colors.surfaceRaised },
  content: { paddingHorizontal: Spacing.lg },
  countLabel: { color: Colors.textSecondary },
  historyNote: { color: Colors.textSecondary, marginBottom: Spacing.md },
  likedSummary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, backgroundColor: Colors.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.hairline, borderRadius: 14, marginBottom: Spacing.lg },
  likedIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: Colors.accentSoft },
  likedCopy: { flex: 1, minWidth: 100, gap: Spacing.xs },
  emptyState: {
    paddingVertical: Spacing.xxxl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyText: { color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.md, rowGap: Spacing.lg },
  gridHalf: { width: '47%', flexGrow: 1 },
});
