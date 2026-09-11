import { API_TIMEOUT_MS, DEFAULT_SEARCH_ENGINE, MUSIC_API_BASE_URL } from '@/constants/api';
import { MusicApiError } from '@/services/errors';
import type { MusicProvider, MusicServiceOptions } from '@/services/MusicProvider';
import type { ApiFetchResponse, ApiLyricsResponse, ApiSearchResponse, ApiSearchResultItem } from '@/types/api';
import type { Track } from '@/types/music';
import { stripHtml } from '@/utils/html';
import { normalizeHttpUrl } from '@/utils/url';

function devLog(...args: unknown[]): void {
  if (__DEV__) console.log('[musicApi]', ...args);
}

function buildUrl(path: string, params: Record<string, string>): string {
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return `${MUSIC_API_BASE_URL}${path}${query ? `?${query}` : ''}`;
}

/**
 * Fetches JSON from the music API with a hard timeout, merged with an
 * optional caller-provided AbortSignal (used to cancel stale requests —
 * e.g. a search that's been superseded by a newer keystroke, or a `/fetch`
 * for a track the user has already tapped away from).
 */
async function apiFetch<T>(path: string, params: Record<string, string>, externalSignal?: AbortSignal): Promise<T> {
  if (externalSignal?.aborted) {
    throw new MusicApiError('Request was cancelled.', 'aborted');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort);

  try {
    let response: Response;
    try {
      response = await fetch(buildUrl(path, params), { signal: controller.signal });
    } catch {
      if (externalSignal?.aborted) {
        throw new MusicApiError('Request was cancelled.', 'aborted');
      }
      if (controller.signal.aborted) {
        throw new MusicApiError("Couldn't reach the music service. Tap to retry.", 'timeout');
      }
      throw new MusicApiError("Couldn't reach the music service. Tap to retry.", 'network');
    }

    if (!response.ok) {
      throw new MusicApiError(`Music service returned an error (${response.status}).`, 'http');
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new MusicApiError('Received an invalid response from the music service.', 'invalid_response');
    }
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

function mapSearchItem(item: unknown): Track | null {
  if (!item || typeof item !== 'object') return null;
  const raw = item as Partial<ApiSearchResultItem>;
  if (typeof raw.id !== 'string' || raw.id.length === 0) return null;
  if (typeof raw.title !== 'string' || raw.title.length === 0) return null;

  return {
    id: raw.id,
    title: stripHtml(raw.title).trim(),
    // Missing/malformed artwork isn't fatal — AlbumArt falls back to a
    // generated placeholder rather than a broken image.
    artwork: normalizeHttpUrl(raw.img),
    source: 'music-api',
  };
}

export class MusicApiProvider implements MusicProvider {
  async search(query: string, options?: MusicServiceOptions): Promise<Track[]> {
    devLog('search started', query);
    const envelope = await apiFetch<Partial<ApiSearchResponse>>(
      '/search',
      { q: query, searchEngine: DEFAULT_SEARCH_ENGINE },
      options?.signal
    );

    if (!envelope || envelope.status !== 200) {
      throw new MusicApiError(envelope?.message || "Couldn't reach the music service.", 'invalid_response');
    }
    if (!Array.isArray(envelope.response)) {
      // Some queries legitimately come back with no results rather than an empty array.
      devLog('search results', 0);
      return [];
    }

    const tracks = Array.from(new Map(envelope.response.map(mapSearchItem)
      .filter((track): track is Track => track !== null && track.title.length > 0)
      .map((track) => [track.id, track])).values());
    devLog('search results', tracks.length);
    return tracks;
  }

  async getStream(trackId: string, options?: MusicServiceOptions): Promise<string> {
    if (!trackId) {
      throw new MusicApiError('Missing track id.', 'invalid_response');
    }

    devLog('stream resolving', trackId);
    const envelope = await apiFetch<Partial<ApiFetchResponse>>('/fetch', { id: trackId }, options?.signal);

    if (!envelope || envelope.status !== 200) {
      throw new MusicApiError(envelope?.message || "Couldn't load this track.", 'invalid_response');
    }

    const streamUrl = normalizeHttpUrl(envelope.response);
    if (!streamUrl) {
      throw new MusicApiError('This track is not available right now.', 'invalid_response');
    }

    devLog('stream loaded', trackId);
    return streamUrl;
  }

  async getLyrics(trackId: string, options?: MusicServiceOptions): Promise<string | null> {
    if (!trackId) return null;

    const envelope = await apiFetch<Partial<ApiLyricsResponse>>('/lyrics', { id: trackId }, options?.signal);

    // A non-200 body status here means "no lyrics for this track" (the API's
    // lyrics endpoint is explicitly beta / gaama-only) rather than a hard
    // failure — genuine network/timeout/HTTP errors already threw above.
    if (!envelope || envelope.status !== 200) {
      devLog('lyrics unavailable', trackId);
      return null;
    }

    const raw = envelope.response;
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      devLog('lyrics unavailable', trackId);
      return null;
    }
    devLog('lyrics loaded', trackId);

    return stripHtml(raw);
  }
}

export const musicProvider: MusicProvider = new MusicApiProvider();

export function searchTracks(query: string, options?: MusicServiceOptions): Promise<Track[]> {
  return musicProvider.search(query, options);
}

export function getStreamUrl(trackId: string, options?: MusicServiceOptions): Promise<string> {
  return musicProvider.getStream(trackId, options);
}

export function getLyrics(trackId: string, options?: MusicServiceOptions): Promise<string | null> {
  return musicProvider.getLyrics(trackId, options);
}

// --- Session-cached discovery search -------------------------------------
// Home has no trending/recommendation endpoint, so it uses a canned
// `/search` query (see constants/discovery.ts) instead. Cached per query so
// re-visiting Home never re-fetches within the same app session.

const discoveryCache = new Map<string, Track[]>();

export async function getDiscoveryTracks(query: string, options?: MusicServiceOptions): Promise<Track[]> {
  const key = query.trim().toLowerCase();
  const cached = discoveryCache.get(key);
  if (cached && !options?.signal) return cached;

  const tracks = await searchTracks(query, options);
  discoveryCache.set(key, tracks);
  return tracks;
}

// --- Runtime stream URL cache -------------------------------------------------
// trackId -> resolved stream URL, so replaying a track or going back to one
// already in the queue doesn't re-hit /fetch. URLs can expire, so the player
// store invalidates an entry and retries once when playback actually fails.

const streamUrlCache = new Map<string, string>();

export async function getStreamUrlCached(
  trackId: string,
  options?: MusicServiceOptions & { forceRefresh?: boolean }
): Promise<string> {
  if (!options?.forceRefresh) {
    const cached = streamUrlCache.get(trackId);
    if (cached) return cached;
  }
  const url = await getStreamUrl(trackId, options);
  streamUrlCache.set(trackId, url);
  return url;
}

export function invalidateStreamUrl(trackId: string): void {
  streamUrlCache.delete(trackId);
}
