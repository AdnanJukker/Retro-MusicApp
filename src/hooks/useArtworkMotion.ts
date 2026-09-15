import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { usePlayerStore } from '@/store/playerStore';

/** User preference also respects the device's Reduce Motion setting. */
export function useArtworkMotion(): boolean {
  const animateArtwork = usePlayerStore((state) => state.animateArtwork);
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  return animateArtwork && !reduceMotion;
}
