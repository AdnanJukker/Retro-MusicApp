import React, { useEffect, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Colors, Spacing, Type } from '@/constants/theme';
import * as audioEngine from '@/services/audioEngine';

export function YouTubeFallbackPlayer() {
  const playback = useSyncExternalStore(
    audioEngine.subscribeEmbeddedPlayback,
    audioEngine.getEmbeddedPlayback,
    () => null
  );
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.max(200, Math.min(480, windowWidth));
  const height = Math.max(200, Math.round(width * 9 / 16));
  const videoId = playback?.videoId;

  useEffect(() => {
    if (videoId) audioEngine.reportEmbeddedReady(0);
  }, [videoId]);

  if (!playback) return null;

  return (
    <View style={styles.panel} accessibilityLabel="YouTube playback fallback">
      <View style={styles.labelRow}>
        <Text style={[Type.labelCaps, styles.label]}>Playing with YouTube</Text>
        <Text style={[Type.techSm, styles.detail]}>Device fallback</Text>
      </View>
      {React.createElement('iframe', {
        key: videoId,
        src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(playback.videoId)}?autoplay=1&controls=1&playsinline=1`,
        width,
        height,
        allow: 'autoplay; encrypted-media; picture-in-picture',
        allowFullScreen: true,
        title: 'YouTube player',
        style: { border: 0, display: 'block' },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { width: '100%', alignItems: 'center', backgroundColor: Colors.ink },
  labelRow: {
    width: '100%', minHeight: 32, paddingHorizontal: Spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  label: { color: Colors.background },
  detail: { color: Colors.textSecondary },
});
