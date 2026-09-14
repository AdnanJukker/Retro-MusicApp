import type { MusicServiceOptions } from '@/services/MusicProvider';
import { MusicApiError } from '@/services/errors';
import {
  getStreamUrlCached as getYouTubeStream,
  invalidateStreamUrl as invalidateYouTubeStream,
  getLyrics as getYouTubeLyrics,
} from '@/services/youtubeMusic/YouTubeMusicProvider';
import type { Track } from '@/types/music';

// This is the same FastAPI deployment used by the existing YouTube resolver.
// Screens know only Track metadata and the backend's playback contract.
const BACKEND_URL = (process.env.EXPO_PUBLIC_STREAM_RESOLVER_URL?.trim()
  || 'https://retro-musicapp.onrender.com').replace(/\/+$/, '');
const SONG_ID = /^saavn:([A-Za-z0-9_-]{8})$/;
const REQUEST_TIMEOUT_MS = 55000; // Allow a free Render service to wake up.

function catalogId(trackId: string): string | undefined {
  const id = SONG_ID.exec(trackId)?.[1];
  if (!id && trackId.startsWith('saavn:')) throw new MusicApiError('Invalid song id.', 'invalid_response');
  return id;
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) throw new MusicApiError('Request was cancelled.', 'aborted');
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  const timeout = setTimeout(onAbort, REQUEST_TIMEOUT_MS);
  signal?.addEventListener('abort', onAbort);
  try {
    const response = await fetch(`${BACKEND_URL}/music${path}`, { signal: controller.signal });
    if (!response.ok) {
      throw new MusicApiError(response.status === 404
        ? 'This song is unavailable. Search for another version.'
        : 'The music service is unavailable. Please retry.', 'http');
    }
    return await response.json() as T;
  } catch (error) {
    if (signal?.aborted) throw new MusicApiError('Request was cancelled.', 'aborted');
    if (error instanceof MusicApiError) throw error;
    throw new MusicApiError('Could not reach the music service. Please retry.', controller.signal.aborted ? 'timeout' : 'network');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function searchTracks(query: string, options?: MusicServiceOptions): Promise<Track[]> {
  if (!query.trim()) return [];
  const result = await request<{ tracks?: Track[] }>(`/search?q=${encodeURIComponent(query.trim())}`, options?.signal);
  if (!result || !Array.isArray(result.tracks)) throw new MusicApiError('Invalid music search response.', 'invalid_response');
  return result.tracks.filter((track) => track && track.source === 'jiosaavn'
    && typeof track.id === 'string' && SONG_ID.test(track.id) && typeof track.title === 'string' && track.title.trim());
}

// Keep saved YouTube IDs intact. Never silently substitute a cover or another song.
export async function getStreamUrlCached(trackId: string, options?: MusicServiceOptions & { forceRefresh?: boolean }): Promise<string> {
  const songId = catalogId(trackId);
  if (!songId) return getYouTubeStream(trackId, options);
  const metadata = await request<{ mimeType?: string }>(`/resolve/${songId}${options?.forceRefresh ? '?refresh=true' : ''}`, options?.signal);
  if (!metadata || !['audio/mp4', 'audio/mpeg', 'audio/aac', 'video/mp4'].includes(metadata.mimeType ?? '')) {
    throw new MusicApiError('This song has no supported audio stream.', 'invalid_response');
  }
  if (__DEV__) console.log('[music] stream ready', trackId, metadata.mimeType);
  // Resolve on each play; only the server caches expiring upstream URLs briefly.
  return `${BACKEND_URL}/music/stream/${songId}`;
}

export function invalidateStreamUrl(trackId: string): void {
  if (!SONG_ID.test(trackId)) invalidateYouTubeStream(trackId);
}

export async function getLyrics(trackId: string, options?: MusicServiceOptions): Promise<string | null> {
  const songId = catalogId(trackId);
  if (!songId) return getYouTubeLyrics(trackId, options);
  const result = await request<{ lyrics?: string | null }>(`/lyrics/${songId}`, options?.signal);
  return typeof result?.lyrics === 'string' ? result.lyrics : null;
}

const discoveryCache = new Map<string, { tracks: Track[]; fetchedAt: number }>();
export async function getDiscoveryTracks(query: string, options?: MusicServiceOptions): Promise<Track[]> {
  const key = query.trim().toLowerCase();
  const cached = discoveryCache.get(key);
  if (!options?.signal && cached && Date.now() - cached.fetchedAt < 300000) return cached.tracks;
  const tracks = await searchTracks(query, options);
  if (!options?.signal?.aborted) discoveryCache.set(key, { tracks, fetchedAt: Date.now() });
  return tracks;
}
