/**
 * Raw shapes returned by https://musicapi.x007.workers.dev.
 * Kept separate from `Track`/app-facing types on purpose — API-specific
 * quirks are mapped away inside `services/musicApi.ts` and must never
 * leak into components.
 */

export type SearchEngine = 'gaama' | 'seevn' | 'hunjama' | 'mtmusic' | 'wunk';

/** Every endpoint wraps its payload in this envelope. */
export interface MusicApiEnvelope<T> {
  status: number;
  response: T;
  message: string;
}

export interface ApiSearchResultItem {
  id: string;
  title: string;
  img: string;
}

export type ApiSearchResponse = MusicApiEnvelope<ApiSearchResultItem[]>;

/** `/fetch` response payload is a bare stream URL (HLS for gaama, direct file for others). */
export type ApiFetchResponse = MusicApiEnvelope<string>;

/** `/lyrics` response payload is an HTML-formatted lyrics string. */
export type ApiLyricsResponse = MusicApiEnvelope<string>;
