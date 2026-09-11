import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Colors } from '@/constants/theme';
import { formatDuration } from '@/utils/format';

interface ProgressBarProps {
  progress: number;
  duration: number;
  onSeek: (seconds: number) => void;
  height?: number;
}

export function ProgressBar({ progress, duration, onSeek, height = 8 }: ProgressBarProps) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const startX = useRef(0);
  const [preview, setPreview] = useState<number | null>(null);

  const handleLayout = (event: LayoutChangeEvent) => {
    widthRef.current = event.nativeEvent.layout.width;
    setWidth(event.nativeEvent.layout.width);
  };

  const seekFromX = (x: number, commit: boolean) => {
    if (widthRef.current <= 0 || duration <= 0) return;
    const ratio = Math.min(1, Math.max(0, x / widthRef.current));
    if (commit) { onSeek(ratio * duration); setPreview(null); }
    else setPreview(ratio);
  };

  // Keep the pan responder's callbacks in sync with the latest seek logic
  // without recreating the responder itself on every render.
  const seekFromXRef = useRef(seekFromX);
  useEffect(() => {
    seekFromXRef.current = seekFromX;
  });

  // Handlers read the latest seek logic via `seekFromXRef` at touch-time, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        startX.current = event.nativeEvent.locationX;
        seekFromXRef.current(startX.current, false);
      },
      onPanResponderMove: (_event, gesture) => seekFromXRef.current(startX.current + gesture.dx, false),
      onPanResponderRelease: (_event, gesture) => seekFromXRef.current(startX.current + gesture.dx, true),
      onPanResponderTerminate: () => setPreview(null),
    })
  );

  const ratio = preview ?? (duration > 0 ? Math.max(0, Math.min(1, progress / duration)) : 0);

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Playback position"
      accessibilityState={{ disabled: duration <= 0 }}
      accessibilityValue={{ min: 0, max: Math.max(0, duration), now: Math.min(progress, duration), text: `${formatDuration(progress)} of ${formatDuration(duration)}` }}
      accessibilityActions={[{ name: 'increment', label: 'Forward 10 seconds' }, { name: 'decrement', label: 'Back 10 seconds' }]}
      onAccessibilityAction={(event) => onSeek(Math.max(0, Math.min(duration, progress + (event.nativeEvent.actionName === 'increment' ? 10 : -10))))}
      onLayout={handleLayout}
      style={{ height: 44, justifyContent: 'center' }}
      {...panResponder.panHandlers}>
      <View pointerEvents="none" style={[styles.track, { height }]}>
      <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
      {width > 0 ? (
        <View style={[styles.thumb, { left: Math.max(0, Math.min(width - 6, ratio * width - 3)) }]} />
      ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: Colors.well,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hairlineStrong,
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.accent,
  },
  thumb: {
    position: 'absolute',
    width: 6,
    top: -3,
    bottom: -3,
    backgroundColor: Colors.ink,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
});
