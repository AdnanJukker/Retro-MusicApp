import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlaylistCard } from '@/components/PlaylistCard';
import { RetroButton } from '@/components/RetroButton';
import { TrackRow } from '@/components/TrackRow';
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

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{ paddingTop: insets.top + Spacing.sm, paddingBottom: Spacing.xxxl }}
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={Type.headlineLg}>Your Library</Text>
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <Pressable key={t.id} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => setTab(t.id)} style={styles.tabItem}>
              <Text style={[Type.bodyMdSemiBold, active ? styles.tabLabelActive : styles.tabLabel]}>{t.label}</Text>
              {active ? <View style={styles.tabIndicator} /> : null}
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
              <Text style={[Type.bodySm, styles.countLabel]}>{likedTracks.length} liked songs</Text>
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
              title="Nothing played yet"
              message="Songs you play will show up here."
              actionLabel="Discover Music"
              onAction={() => router.navigate('/search')}
            />
          ) : (
            <TrackList tracks={history} />
          )
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hairline,
    marginBottom: Spacing.lg,
  },
  tabItem: { minHeight: 44, paddingBottom: Spacing.sm, justifyContent: 'center' },
  tabLabel: { color: Colors.textSecondary },
  tabLabelActive: { color: Colors.ink },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.accent,
  },
  content: { paddingHorizontal: Spacing.lg },
  countLabel: { color: Colors.textSecondary, marginBottom: Spacing.md },
  emptyState: {
    paddingVertical: Spacing.xxxl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyText: { color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.md, rowGap: Spacing.lg },
  gridHalf: { width: '47%', flexGrow: 1 },
});
