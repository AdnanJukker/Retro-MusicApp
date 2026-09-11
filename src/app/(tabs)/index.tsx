import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlbumArt } from '@/components/AlbumArt';
import { AlbumCard } from '@/components/AlbumCard';
import { RetroButton } from '@/components/RetroButton';
import { SectionHeader } from '@/components/SectionHeader';
import { VinylDisc } from '@/components/VinylDisc';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { HOME_DISCOVERY_QUERY } from '@/constants/discovery';
import { getDiscoveryTracks } from '@/services/youtubeMusic';
import { useCurrentTrack, usePlayerStore } from '@/store/playerStore';
import type { Track } from '@/types/music';
import { greetingForHour } from '@/utils/format';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const history = usePlayerStore((s) => s.history);
  const recentlyPlayed = useMemo(() => history.slice(0, 8), [history]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [discoveryError, setDiscoveryError] = useState(false);
  const [picks, setPicks] = useState<Track[] | null>(null);
  const [picksLoading, setPicksLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    getDiscoveryTracks(HOME_DISCOVERY_QUERY, { signal: controller.signal })
      .then((tracks) => {
        if (controller.signal.aborted) return;
        setPicks(tracks.slice(0, 10));
        setDiscoveryError(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setDiscoveryError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPicksLoading(false);
      });
    return () => controller.abort();
  }, [refreshKey]);

  const quickPicks = picks ?? [];
  const refresh = () => {
    setPicksLoading(true);
    setRefreshKey((value) => value + 1);
  };

  const current = useCurrentTrack();
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const previousTrack = usePlayerStore((s) => s.previousTrack);

  const heroTrack = current ?? recentlyPlayed[0] ?? quickPicks[0];
  const greeting = greetingForHour(new Date().getHours());

  const handleHeroPlayPause = () => {
    if (!current && heroTrack) playTrack(heroTrack, recentlyPlayed.length ? recentlyPlayed : quickPicks);
    else togglePlayPause();
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{ paddingTop: insets.top + Spacing.sm, paddingBottom: Spacing.xxxl }}
      refreshControl={<RefreshControl refreshing={picksLoading && refreshKey > 0} onRefresh={refresh} tintColor={Colors.accent} />}
      showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.greetingRow}>
            <View style={styles.greetingDot} />
            <Text style={Type.headlineLg}>{greeting}</Text>
          </View>
          <Text style={[Type.bodySm, styles.subGreeting]}>What do you want to hear?</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => router.push('/settings')}
          style={styles.iconButton}
          hitSlop={8}>
          <Feather name="settings" size={19} color={Colors.ink} />
        </Pressable>
      </View>

      {/* Hero: Now Playing */}
      {heroTrack ? (
        <View style={styles.heroSection}>
          <SectionHeader title={current ? 'Now Playing' : 'Recently Playing'} />
          <View style={styles.heroArtRow}>
            <View style={styles.discWrap}>
              <VinylDisc size={168} spinning={Boolean(current) && isPlaying} seed={heroTrack.art} />
            </View>
            <AlbumArt
              seed={heroTrack.art}
              artworkUrl={heroTrack.artwork}
              label={heroTrack.title}
              size={208}
              catalogId={heroTrack.id}
            />
          </View>

          <View style={styles.heroInfo}>
            <Text style={Type.headlineMd} numberOfLines={1}>
              {heroTrack.title}
            </Text>
            {heroTrack.artist ? (
              <Text style={[Type.bodyLg, styles.heroArtist]} numberOfLines={1}>
                {heroTrack.artist}
              </Text>
            ) : null}
          </View>

          <View style={styles.heroControls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous track"
              disabled={!current}
              onPress={() => (current ? previousTrack() : undefined)}
              style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}>
              <Feather name="skip-back" size={18} color={Colors.ink} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isLoading ? 'Cancel loading' : current && isPlaying ? 'Pause' : 'Play'}
              onPress={handleHeroPlayPause}
              style={({ pressed }) => [styles.heroPlayButton, pressed && styles.pressed]}>
              {isLoading ? <ActivityIndicator color={Colors.background} /> : <Feather name={current && isPlaying ? 'pause' : 'play'} size={22} color={Colors.background} />}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next track"
              onPress={() => (current ? nextTrack() : playTrack(quickPicks[1] ?? heroTrack, quickPicks))}
              style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}>
              <Feather name="skip-forward" size={18} color={Colors.ink} />
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.welcomeSection}>
          <Feather name="search" size={28} color={Colors.accent} />
          <Text style={Type.headlineMd}>Find something to play</Text>
          <Text style={[Type.bodyMd, styles.welcomeText]}>Search millions of tracks.</Text>
          <RetroButton label="Find Music" icon="arrow-right" onPress={() => router.navigate('/search')} />
        </View>
      )}

      {/* Recently Played */}
      {recentlyPlayed.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Recently Played" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {recentlyPlayed.map((track) => (
              <AlbumCard
                key={track.id}
                id={track.id}
                title={track.title}
                subtitle={track.artist ?? ' '}
                art={track.art}
                artworkUrl={track.artwork}
                onPress={() => playTrack(track, recentlyPlayed)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Quick Picks */}
      <View style={styles.section}>
        <SectionHeader title="Quick Picks" />
        {picksLoading && quickPicks.length === 0 ? (
          <View style={styles.centerHint}>
            <ActivityIndicator size="small" color={Colors.accent} />
          </View>
        ) : discoveryError && quickPicks.length === 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Retry" onPress={refresh} style={styles.centerHint}>
            <Text style={[Type.bodyMd, styles.errorText]}>Couldn&apos;t load music. Tap to retry.</Text>
          </Pressable>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {quickPicks.map((track) => (
              <AlbumCard
                key={track.id}
                id={track.id}
                title={track.title}
                subtitle={track.artist ?? ' '}
                art={track.art}
                artworkUrl={track.artwork}
                onPress={() => playTrack(track, quickPicks)}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  greetingDot: { width: 6, height: 6, backgroundColor: Colors.accent },
  subGreeting: { color: Colors.textSecondary, marginTop: 2 },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  heroSection: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xxl },
  heroArtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  discWrap: {
    marginRight: -58,
  },
  heroInfo: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: 2,
  },
  heroArtist: { color: Colors.textSecondary },
  heroControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  heroButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPlayButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  welcomeSection: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xxl,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  welcomeText: { color: Colors.textSecondary, marginBottom: Spacing.sm },
  section: { marginBottom: Spacing.xxl, paddingHorizontal: Spacing.lg },
  hScroll: { gap: Spacing.md, paddingTop: Spacing.md },
  centerHint: { paddingTop: Spacing.lg, alignItems: 'center' },
  errorText: { color: Colors.accent },
});
