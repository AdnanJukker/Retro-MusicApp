import type { ArtMotif, ArtPalette, ArtSeed } from '@/types/music';

/** Small deterministic string hash — used to derive stable pseudo-random display values from ids. */
export function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Deterministic vintage-style catalog code, e.g. "ARC-7402-A", derived from an id. */
export function catalogCode(id: string): string {
  const hash = hashString(id);
  const year = 1968 + (hash % 27);
  const suffix = String.fromCharCode(65 + (hash % 6));
  const num = (hash % 90) + 10;
  return `ARC-${year.toString().slice(2)}${num}-${suffix}`;
}

const FALLBACK_PALETTES: ArtPalette[] = ['accent', 'gold', 'olive', 'ink'];
const FALLBACK_MOTIFS: ArtMotif[] = ['sun', 'stripe', 'ring', 'grid', 'peak'];

/**
 * Deterministic placeholder art seed for tracks that don't carry a curated
 * `art` field (i.e. anything that came back from the live search API).
 */
export function seedFromId(id: string): ArtSeed {
  const hash = hashString(id);
  return {
    palette: FALLBACK_PALETTES[hash % FALLBACK_PALETTES.length],
    motif: FALLBACK_MOTIFS[Math.floor(hash / FALLBACK_PALETTES.length) % FALLBACK_MOTIFS.length],
  };
}
