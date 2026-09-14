import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import YoutubePlayer, { PLAYER_STATES, type YoutubeIframeRef } from 'react-native-youtube-iframe';

import { Colors, Spacing, Type } from '@/constants/theme';
import { getSelfHostedResolverUrl } from '@/services/youtubeMusic/innertubeConfig';
import * as audioEngine from '@/services/audioEngine';

const POLL_INTERVAL_MS = 500;

export function YouTubeFallbackPlayer() {
  const playback = useSyncExternalStore(
    audioEngine.subscribeEmbeddedPlayback,
    audioEngine.getEmbeddedPlayback,
    () => null
  );
  const playerRef = useRef<YoutubeIframeRef>(null);
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.max(200, Math.min(480, windowWidth));
  const height = Math.max(200, Math.round(width * 9 / 16));
  const videoId = playback?.videoId;
  const playing = playback?.playing ?? false;

  useEffect(() => {
    if (!videoId) return;
    const controller = { seekTo: (seconds: number) => playerRef.current?.seekTo(seconds, true) };
    audioEngine.setEmbeddedPlayerController(controller);
    return () => audioEngine.setEmbeddedPlayerController(null);
  }, [videoId]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const ref = playerRef.current;
      if (!ref) return;
      void Promise.all([ref.getCurrentTime(), ref.getDuration()])
        .then(([position, duration]) => audioEngine.reportEmbeddedProgress(position, duration))
        .catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [playing, videoId]);

  const onReady = useCallback(() => {
    void playerRef.current?.getDuration()
      .then((duration) => audioEngine.reportEmbeddedReady(duration))
      .catch(() => audioEngine.reportEmbeddedReady(0));
  }, []);

  const onChangeState = useCallback((state: PLAYER_STATES) => {
    if (state === PLAYER_STATES.PLAYING) audioEngine.reportEmbeddedState('playing');
    else if (state === PLAYER_STATES.PAUSED) audioEngine.reportEmbeddedState('paused');
    else if (state === PLAYER_STATES.BUFFERING) audioEngine.reportEmbeddedState('buffering');
    else if (state === PLAYER_STATES.ENDED) audioEngine.reportEmbeddedState('ended');
  }, []);

  if (!playback) return null;

  return (
    <View style={styles.panel} accessibilityLabel="YouTube playback fallback">
      <View style={styles.labelRow}>
        <Text style={[Type.labelCaps, styles.label]}>Playing with YouTube</Text>
        <Text style={[Type.techSm, styles.detail]}>Device fallback</Text>
      </View>
      <YoutubePlayer
        ref={playerRef}
        height={height}
        width={width}
        videoId={videoId}
        play={playing}
        onReady={onReady}
        onChangeState={onChangeState}
        onError={() => audioEngine.reportEmbeddedError("YouTube couldn't play this track.")}
        initialPlayerParams={{ controls: true, preventFullScreen: false, rel: false }}
        useLocalHTML
        baseUrlOverride={getSelfHostedResolverUrl()}
        webViewStyle={styles.webView}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: Colors.ink,
  },
  labelRow: {
    width: '100%',
    minHeight: 32,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: { color: Colors.background },
  detail: { color: Colors.textSecondary },
  webView: { backgroundColor: '#000' },
});
