import type { Track } from '@/types/music';

export interface MusicServiceOptions {
  /** Lets a caller cancel an in-flight request (e.g. a stale search or a superseded play tap). */
  signal?: AbortSignal;
}

/**
 * Everything a screen needs from "the music backend", kept abstract so the
 * current unofficial API (`MusicApiProvider`) can be swapped for a
 * different one later without touching any screen or store.
 */
export interface MusicProvider {
  search(query: string, options?: MusicServiceOptions): Promise<Track[]>;
  getStream(trackId: string, options?: MusicServiceOptions): Promise<string>;
  /** Resolves to `null` when lyrics simply aren't available for this track (not an error). */
  getLyrics(trackId: string, options?: MusicServiceOptions): Promise<string | null>;
}
