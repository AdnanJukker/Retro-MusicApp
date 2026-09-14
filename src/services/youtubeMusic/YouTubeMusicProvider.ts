import { postInnertube } from '@/services/youtubeMusic/innertubeClient';
import { getSignatureTimestamp, SEARCH_FILTER_SONGS_PARAMS } from '@/services/youtubeMusic/innertubeConfig';
import { YouTubeMusicError } from '@/services/youtubeMusic/errors';
import {
  parseLyricsBrowseId,
  parseLyricsText,
  parsePlayerResponse,
  parseSearchSongs,
  selectBestAudioStream,
} from '@/services/youtubeMusic/innertubeParsers';
import { resolveViaStreamProxy } from '@/services/youtubeMusic/streamResolver';
import type { AudioStream, BrowseLyricsResponse, NextResponse, PlayerResponse, SearchResponse } from '@/services/youtubeMusic/innertubeTypes';
import type { MusicProvider, MusicServiceOptions } from '@/services/MusicProvider';
import type { Track } from '@/types/music';

function devLog(...args: unknown[]): void {
  if (__DEV__) console.log('[youtubeMusic]', ...args);
}

/** Statuses observed for embeddable, unauthenticated playback. Anything else is rejected. */
const PLAYABLE_STATUS = 'OK';

export async function searchSongs(query: string, options?: MusicServiceOptions): Promise<Track[]> {
  devLog('search started', query);
  const response = await postInnertube<SearchResponse>(
    'search',
    { query, params: SEARCH_FILTER_SONGS_PARAMS },
    options?.signal
  );
  const tracks = parseSearchSongs(response);
  devLog('search results', tracks.length);
  return tracks;
}

export async function getAudioStream(videoId: string, options?: MusicServiceOptions): Promise<AudioStream> {
  if (!videoId) {
    throw new YouTubeMusicError('Missing track id.', 'INVALID_RESPONSE');
  }

  devLog('player request', videoId);
  const response = await postInnertube<PlayerResponse>(
    'player',
    {
      video_id: videoId,
      playbackContext: { contentPlaybackContext: { signatureTimestamp: getSignatureTimestamp() } },
    },
    options?.signal
  ).catch((error) => {
    if (options?.signal?.aborted) throw error;
    devLog('player request failed; trying backend resolver', videoId);
    return {} as PlayerResponse;
  });

  const { status, reason, formats } = response.playabilityStatus?.status
    ? parsePlayerResponse(response)
    : { status: 'UNKNOWN', reason: undefined, formats: [] };
  devLog('playability', videoId, status, 'formats:', formats.length);

  if (status === PLAYABLE_STATUS) {
    const direct = selectBestAudioStream(formats);
    if (direct) {
      devLog('stream selected (direct)', videoId, direct.mimeType, direct.bitrate);
      return direct;
    }
  }

  // Either every adaptiveFormat is signatureCipher-only (status OK, no direct
  // url — this app never deciphers that itself), or the unauthenticated
  // WEB_REMIX `player` call itself reported non-OK playability. That second
  // case is not necessarily a real playability problem: verified live that
  // WEB_REMIX can report a video UNPLAYABLE while the resolver's independent
  // yt-dlp extraction (its own PO token, different clients) still succeeds.
  // So always try the resolver before giving up — never take WEB_REMIX's
  // playability verdict as final. Only a resolved audio URL counts as success.
  devLog('no direct-url audio-only format available, trying stream proxy fallback', videoId, 'status:', status);
  const proxied = await resolveViaStreamProxy(videoId, options?.signal);
  if (proxied) {
    devLog('stream selected (proxy fallback)', videoId, proxied.mimeType, proxied.bitrate);
    return proxied;
  }

  devLog('no playable YouTube stream', videoId, status, reason);
  throw new YouTubeMusicError(
    'YouTube playback is unavailable. Search this song again in the current catalog.',
    'NO_AUDIO_STREAM'
  );
}

export async function getLyrics(videoId: string, options?: MusicServiceOptions): Promise<string | null> {
  if (!videoId) return null;

  const next = await postInnertube<NextResponse>(
    'next',
    {
      videoId,
      playlistId: `RDAMVM${videoId}`,
      enablePersistentPlaylistPanel: true,
      isAudioOnly: true,
      tunerSettingValue: 'AUTOMIX_SETTING_NORMAL',
    },
    options?.signal
  );
  const browseId = parseLyricsBrowseId(next);
  if (!browseId) {
    devLog('lyrics unavailable', videoId);
    return null;
  }

  const browse = await postInnertube<BrowseLyricsResponse>('browse', { browseId }, options?.signal);
  const lyrics = parseLyricsText(browse);
  devLog(lyrics ? 'lyrics loaded' : 'lyrics unavailable', videoId);
  return lyrics;
}

export class YouTubeMusicProvider implements MusicProvider {
  async search(query: string, options?: MusicServiceOptions): Promise<Track[]> {
    return searchSongs(query, options);
  }

  async getStream(trackId: string, options?: MusicServiceOptions): Promise<string> {
    const stream = await getAudioStream(trackId, options);
    return stream.url;
  }

  async getLyrics(trackId: string, options?: MusicServiceOptions): Promise<string | null> {
    return getLyrics(trackId, options);
  }
}

export const musicProvider: MusicProvider = new YouTubeMusicProvider();

export function searchTracks(query: string, options?: MusicServiceOptions): Promise<Track[]> {
  return musicProvider.search(query, options);
}

export function getStreamUrl(trackId: string, options?: MusicServiceOptions): Promise<string> {
  return musicProvider.getStream(trackId, options);
}

// --- Session-cached discovery search -------------------------------------
// Same purpose as the legacy provider's: Home has no trending/recommendation
// endpoint, so it reuses a canned search query, cached per-session.

const discoveryCache = new Map<string, Track[]>();

export async function getDiscoveryTracks(query: string, options?: MusicServiceOptions): Promise<Track[]> {
  const key = query.trim().toLowerCase();
  const cached = discoveryCache.get(key);
  if (cached && !options?.signal) return cached;

  const tracks = await searchTracks(query, options);
  discoveryCache.set(key, tracks);
  return tracks;
}

// --- Runtime stream cache ---------------------------------------------------
// videoId -> resolved AudioStream (+ fetchedAt). Never persisted — InnerTube
// stream URLs expire and are tied to a signed session. On playback failure
// the player store invalidates the entry and retries once with a fresh
// Player request (never repeatedly).

interface CachedStream {
  stream: AudioStream;
  fetchedAt: number;
}

const streamCache = new Map<string, CachedStream>();

export async function getStreamUrlCached(
  trackId: string,
  options?: MusicServiceOptions & { forceRefresh?: boolean }
): Promise<string> {
  if (options?.signal?.aborted) throw new Error('Request was cancelled.');
  if (!options?.forceRefresh) {
    const cached = streamCache.get(trackId);
    if (cached && Date.now() - cached.fetchedAt < 120000) return cached.stream.url;
  }
  const stream = await getAudioStream(trackId, options);
  streamCache.set(trackId, { stream, fetchedAt: Date.now() });
  return stream.url;
}

export function invalidateStreamUrl(trackId: string): void {
  streamCache.delete(trackId);
}
