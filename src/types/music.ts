/** Palette used to generate deterministic placeholder sleeve/tape artwork. */
export type ArtPalette = 'accent' | 'gold' | 'olive' | 'ink';

/** Abstract geometric motif drawn on generated placeholder artwork. */
export type ArtMotif = 'sun' | 'stripe' | 'ring' | 'grid' | 'peak';

export interface ArtSeed {
  palette: ArtPalette;
  motif: ArtMotif;
}

/**
 * A playable track. Curated/mock tracks (Home, Library, Playlist, Artist
 * screens) populate every field; tracks that come back from the live
 * search API only ever give us `id`, `title`, and usually `artwork` — the
 * rest is legitimately unknown, so it stays optional rather than faked.
 * `duration` in particular should be treated as a hint only: once a track
 * is actually loaded, the player store's real `duration` (from the audio
 * engine) is the source of truth for progress UI.
 */
export interface Track {
  id: string;
  title: string;
  artist?: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  /** Generated placeholder sleeve art — used when there's no real `artwork`, or it fails to load. */
  art?: ArtSeed;
  /** Remote artwork URL, e.g. from the search API's `img` field. */
  artwork?: string;
  duration?: number;
  genre?: string;
  year?: number;
  format?: string;
  /** Where this track came from — lets code tell curated content from a live search result if it ever needs to. */
  source?: 'mock' | 'music-api' | 'youtube-music';
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  year: number;
  art: ArtSeed;
  trackIds: string[];
}

export interface Artist {
  id: string;
  name: string;
  bio: string;
  art: ArtSeed;
  genre: string;
}

export interface Playlist {
  id: string;
  title: string;
  description: string;
  art: ArtSeed;
  trackIds: string[];
  tapeType: string;
}

export interface Genre {
  id: string;
  name: string;
  spine: string;
  count: string;
  palette: ArtPalette;
}
