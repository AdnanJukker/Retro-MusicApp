import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GenreChip } from '@/components/GenreChip';
import { SectionHeader } from '@/components/SectionHeader';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TrackRow } from '@/components/TrackRow';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { mockGenres } from '@/data';
import { useMusicSearch } from '@/hooks/useMusicSearch';
import { useCurrentTrack, usePlayerStore } from '@/store/playerStore';

const SUGGESTED_SEARCHES = ['Arijit Singh', 'Bollywood', '90s Hindi', 'Romantic Hits'];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const initialQuery = typeof q === 'string' ? q : '';
  const [input, setInput] = useState({ seed: initialQuery, value: initialQuery });
  const query = input.seed === initialQuery ? input.value : initialQuery;
  const setQuery = (value: string) => setInput({ seed: initialQuery, value });
  const { state, results, errorMessage, retry } = useMusicSearch(query);
  const current = useCurrentTrack();
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const normalizedQuery = query.trim().toLowerCase();

  return <FlatList
    style={styles.flex}
    contentContainerStyle={{ paddingTop: insets.top + Spacing.sm, paddingBottom: Spacing.xxxl }}
    data={state === 'success' ? results : []}
    keyExtractor={(track) => track.id}
    extraData={[current?.id, isPlaying]}
    initialNumToRender={12}
    windowSize={7}
    keyboardShouldPersistTaps="handled"
    keyboardDismissMode="on-drag"
    showsVerticalScrollIndicator={false}
    renderItem={({ item: track }) => (
      <TrackRow track={track} isActive={current?.id === track.id} isPlaying={isPlaying}
        onPress={() => current?.id === track.id ? togglePlayPause() : playTrack(track, results)} />
    )}
    ListHeaderComponent={<>
      <ScreenHeader title="Find your sound" subtitle="Songs, artists, and a little discovery." eyebrow="Discover / JioSaavn" />
      <View style={styles.section}>
        <View style={styles.searchField}>
          <Feather name="search" size={18} color={Colors.textSecondary} />
          <TextInput accessibilityLabel="Search music" value={query} onChangeText={setQuery}
            placeholder="Search songs, artists..." placeholderTextColor={Colors.textSecondary}
            style={styles.input} returnKeyType="search" autoCorrect={false} autoCapitalize="none" />
          {query.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} style={styles.clearButton}>
            <Feather name="x-circle" size={18} color={Colors.textSecondary} />
          </Pressable> : null}
        </View>
      </View>
      {state === 'idle' ? <>
        <View style={styles.section}>
          <Text style={[Type.labelCaps, styles.groupLabel]}>Browse</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {mockGenres.map((genre) => <GenreChip key={genre.id} genre={genre} selected={normalizedQuery === genre.name.toLowerCase()} onPress={() => setQuery(genre.name)} />)}
          </ScrollView>
        </View>
        <View style={styles.section}>
          <Text style={[Type.labelCaps, styles.groupLabel]}>Try searching</Text>
          <View style={styles.suggestionList}>
            {SUGGESTED_SEARCHES.map((term, index) => <Pressable key={term} accessibilityRole="button" accessibilityLabel={`Search ${term}`} onPress={() => setQuery(term)} style={({ pressed }) => [styles.suggestionRow, pressed && styles.suggestionPressed]}>
              <Text style={[Type.techSm, styles.suggestionNumber]}>{String(index + 1).padStart(2, '0')}</Text>
              <Text style={[Type.bodyMdSemiBold, { flex: 1 }]}>{term}</Text>
              <Feather name="arrow-up-left" size={14} color={Colors.textSecondary} />
            </Pressable>)}
          </View>
        </View>
      </> : <View style={styles.resultsHeader}>
        <SectionHeader title="Results" meta={state === 'success' ? `${results.length}` : undefined} />
      </View>}
    </>}
    ListEmptyComponent={state === 'idle' ? null : <View style={styles.section}>
      {state === 'loading' ? <View style={styles.centerState} accessibilityLiveRegion="polite">
        <ActivityIndicator color={Colors.accent} />
      </View> : state === 'error' ? <Pressable accessibilityRole="button" accessibilityLabel="Retry search" onPress={retry} style={styles.centerState}>
        <Feather name="wifi-off" size={26} color={Colors.textSecondary} />
        <Text style={[Type.bodyMd, styles.errorText]}>{errorMessage ?? "Couldn't reach the music service."}</Text>
        <Text style={[Type.labelCaps, styles.retryText]}>Try again</Text>
      </Pressable> : <View style={styles.centerState}>
        <Feather name="search" size={26} color={Colors.textSecondary} />
        <Text style={Type.headlineMd}>No results found</Text>
        <Text style={[Type.bodyMd, styles.centerText]}>Try a different title or artist.</Text>
      </View>}
    </View>}
  />;
}

const styles = StyleSheet.create({
  resultsHeader: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  clearButton: { minHeight: 44, minWidth: 36, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, backgroundColor: Colors.background },
  section: { marginBottom: Spacing.xl, paddingHorizontal: Spacing.lg },
  searchField: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hairline,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.sm,
    fontFamily: Type.bodyMd.fontFamily,
    fontSize: 15,
    color: Colors.ink,
  },
  groupLabel: {
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  chipRow: {
    gap: Spacing.sm,
  },
  suggestionList: {
    gap: Spacing.sm,
  },
  suggestionRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hairline,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
  },
  suggestionNumber: { color: Colors.accent },
  suggestionPressed: { backgroundColor: Colors.accentSoft },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  centerText: {
    color: Colors.textSecondary,
  },
  errorText: {
    color: Colors.ink,
    textAlign: 'center',
  },
  retryText: {
    color: Colors.accent,
  },
});
