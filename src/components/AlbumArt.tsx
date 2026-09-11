import { useState } from 'react';
import { StyleSheet, Text, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';

import { Colors, Type } from '@/constants/theme';
import type { ArtMotif, ArtSeed } from '@/types/music';
import { catalogCode, seedFromId } from '@/utils/hash';

const PALETTES: Record<ArtSeed['palette'], { bg: string; fg: string }> = {
  accent: { bg: Colors.accent, fg: Colors.background },
  gold: { bg: Colors.gold, fg: Colors.ink },
  olive: { bg: Colors.olive, fg: Colors.background },
  ink: { bg: Colors.ink, fg: Colors.gold },
};

function Motif({ motif, color }: { motif: ArtMotif; color: string }) {
  switch (motif) {
    case 'sun':
      return (
        <View
          pointerEvents="none"
          style={[styles.sun, { borderColor: color, opacity: 0.35 }]}
        />
      );
    case 'ring':
      return (
        <View
          pointerEvents="none"
          style={[styles.ring, { borderColor: color, opacity: 0.4 }]}
        />
      );
    case 'grid':
      return (
        <View pointerEvents="none" style={styles.grid}>
          {[0, 1, 2].map((row) => (
            <View key={row} style={[styles.gridLine, { backgroundColor: color, opacity: 0.3 }]} />
          ))}
        </View>
      );
    case 'stripe':
      return (
        <View
          pointerEvents="none"
          style={[styles.stripe, { backgroundColor: color, opacity: 0.3 }]}
        />
      );
    case 'peak':
      return (
        <View
          pointerEvents="none"
          style={[styles.peak, { borderBottomColor: color, opacity: 0.35 }]}
        />
      );
    default:
      return null;
  }
}

interface AlbumArtProps {
  /** Generated placeholder look. Optional — derived deterministically from catalogId/label when omitted. */
  seed?: ArtSeed;
  /** Real remote artwork (e.g. a search result's `img`). Falls back to the generated placeholder on load failure. */
  artworkUrl?: string;
  label?: string;
  size?: DimensionValue;
  aspectRatio?: number;
  showCatalog?: boolean;
  catalogId?: string;
  showInitial?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AlbumArt({
  seed,
  artworkUrl,
  label,
  size = '100%',
  aspectRatio = 1,
  showCatalog = false,
  catalogId,
  showInitial = true,
  style,
}: AlbumArtProps) {
  const resolvedSeed = seed ?? seedFromId(catalogId ?? label ?? 'x');
  const palette = PALETTES[resolvedSeed.palette];
  const initial = label?.trim().charAt(0).toUpperCase();

  // Never show a broken-image icon: try the remote artwork, and silently
  // fall back to the generated placeholder (already rendered beneath it) if
  // it fails to load. Storing *which* url failed (rather than a plain
  // boolean) means a new artworkUrl is automatically retried without an
  // effect to reset anything.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showRemoteImage = Boolean(artworkUrl) && artworkUrl !== failedUrl;
  // Scale the initial glyph to the box so it never overflows small thumbnails
  // (list-row art) or looks lost inside large hero/banner artwork.
  const numericSize = typeof size === 'number' ? size : undefined;
  const initialFontSize = numericSize ? Math.round(Math.min(64, Math.max(14, numericSize * 0.42))) : 40;
  const showCatalogText = showCatalog && (numericSize === undefined || numericSize >= 90);
  // Below list-row thumbnail scale, the motif shapes just clip into noise — a flat
  // monogram tile reads more cleanly than a giant clipped arc/stripe.
  const showMotif = numericSize === undefined || numericSize >= 56;

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.base,
        { backgroundColor: palette.bg, width: size, aspectRatio },
        style,
      ]}>
      {showMotif ? <Motif motif={resolvedSeed.motif} color={palette.fg} /> : null}
      {showInitial && initial ? (
        <Text
          style={[
            Type.displayHero,
            styles.initial,
            { color: palette.fg, fontSize: initialFontSize, lineHeight: initialFontSize * 1.1 },
          ]}>
          {initial}
        </Text>
      ) : null}
      {showRemoteImage ? (
        <Image
          source={{ uri: artworkUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          recyclingKey={artworkUrl}
          transition={150}
          onError={() => setFailedUrl(artworkUrl ?? null)}
        />
      ) : null}
      {showCatalogText ? (
        <Text style={[Type.techSm, styles.catalog, { color: palette.fg }]}>
          {catalogCode(catalogId ?? label ?? 'x')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hairline,
  },
  initial: {
    opacity: 0.9,
  },
  catalog: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    opacity: 0.85,
  },
  sun: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 10,
    top: -30,
    right: -30,
  },
  ring: {
    position: 'absolute',
    width: '70%',
    height: '70%',
    borderRadius: 999,
    borderWidth: 2,
  },
  grid: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    gap: 5,
  },
  gridLine: {
    height: 2,
    marginHorizontal: 12,
  },
  stripe: {
    position: 'absolute',
    width: '160%',
    height: 22,
    top: '55%',
    left: '-30%',
    transform: [{ rotate: '-18deg' }],
  },
  peak: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    width: 0,
    height: 0,
    borderLeftWidth: 60,
    borderRightWidth: 60,
    borderBottomWidth: 70,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
