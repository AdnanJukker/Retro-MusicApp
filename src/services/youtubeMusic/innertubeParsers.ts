import { YouTubeMusicError } from '@/services/youtubeMusic/errors';
import type {
  AdaptiveFormat,
  AudioStream,
  BrowseLyricsResponse,
  MusicResponsiveListItemRenderer,
  NextResponse,
  PlayerResponse,
  Run,
  SearchResponse,
} from '@/services/youtubeMusic/innertubeTypes';
import type { Track } from '@/types/music';

// --- Search parsing --------------------------------------------------------
// Ported from ytmusicapi's parsers/search.py (song branch) + parsers/songs.py
// `parse_song_runs`: flexColumns[1]'s runs alternate content/separator; each
// content run is classified by its navigationEndpoint pageType.

// Search-result thumbnails only ever come back at list-row resolution
// (observed: 60x60 and 120x120) — the two sizes differ only by the
// `=w{n}-h{n}-...` suffix Google's thumbnail CDN reads off the same URL, so
// requesting a larger size is a plain CDN param, not an InnerTube behavior.
// Without this, e.g. a 208px hero image gets a 120px source stretched to fit.
const THUMBNAIL_SIZE_RE = /=w\d+-h\d+/;
const THUMBNAIL_TARGET_SIZE = 720;

function upscaleThumbnail(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return THUMBNAIL_SIZE_RE.test(url)
    ? url.replace(THUMBNAIL_SIZE_RE, `=w${THUMBNAIL_TARGET_SIZE}-h${THUMBNAIL_TARGET_SIZE}`)
    : url;
}

function bestThumbnail(item: MusicResponsiveListItemRenderer): string | undefined {
  const thumbs = item.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
  if (!thumbs || thumbs.length === 0) return undefined;
  const largest = thumbs.reduce((best, t) => ((t.width ?? 0) > (best.width ?? 0) ? t : best), thumbs[0]);
  return upscaleThumbnail(largest.url);
}

function videoIdOf(item: MusicResponsiveListItemRenderer): string | undefined {
  const overlayId = item.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer
    ?.playNavigationEndpoint?.watchEndpoint?.videoId;
  if (overlayId) return overlayId;
  return item.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint
    ?.watchEndpoint?.videoId;
}

const DURATION_RE = /^\d{1,2}(:\d{2}){1,2}$/;

function parseDurationSeconds(text: string): number | undefined {
  if (!DURATION_RE.test(text)) return undefined;
  const parts = text.split(':').map(Number);
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function classifyRun(run: Run): { kind: 'artist' | 'album' | 'duration' | 'other'; text: string; id?: string } {
  const text = run.text ?? '';
  const browse = run.navigationEndpoint?.browseEndpoint;
  // Page type isn't in the minimal Run shape (kept intentionally tiny) —
  // any browseEndpoint on a search-result run is either an artist or an
  // album link; duration/plain text runs never carry one.
  if (browse?.browseId) {
    return { kind: browse.browseId.startsWith('MPRE') ? 'album' : 'artist', text, id: browse.browseId };
  }
  if (parseDurationSeconds(text) !== undefined) return { kind: 'duration', text };
  return { kind: 'other', text };
}

function parseSongRuns(runs: Run[]): { artists: { id?: string; name: string }[]; album?: { id?: string; title: string }; durationSeconds?: number } {
  const artists: { id?: string; name: string }[] = [];
  let album: { id?: string; title: string } | undefined;
  let durationSeconds: number | undefined;

  // Even indices are content runs; odd indices are separators (", ", " & ", " • ").
  for (let i = 0; i < runs.length; i += 2) {
    const parsed = classifyRun(runs[i]);
    if (parsed.kind === 'artist' && parsed.text) artists.push({ id: parsed.id, name: parsed.text });
    else if (parsed.kind === 'album' && parsed.text) album = { id: parsed.id, title: parsed.text };
    else if (parsed.kind === 'duration') durationSeconds = parseDurationSeconds(parsed.text);
  }

  return { artists, album, durationSeconds };
}

function mapSearchItem(item: MusicResponsiveListItemRenderer): Track | null {
  const videoId = videoIdOf(item);
  const title = item.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
  if (!videoId || !title) return null;

  const runs = item.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? [];
  const { artists, album, durationSeconds } = parseSongRuns(runs);

  return {
    id: videoId,
    title,
    artist: artists.map((a) => a.name).join(', ') || undefined,
    artistId: artists[0]?.id,
    album: album?.title,
    albumId: album?.id,
    artwork: bestThumbnail(item),
    duration: durationSeconds,
    source: 'youtube-music',
  };
}

export function parseSearchSongs(response: SearchResponse): Track[] {
  const sections =
    response.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer
      ?.contents ?? [];

  const shelfItems = sections.find((s) => s.musicShelfRenderer)?.musicShelfRenderer?.contents ?? [];

  const tracks: Track[] = [];
  const seen = new Set<string>();
  for (const entry of shelfItems) {
    const renderer = entry.musicResponsiveListItemRenderer;
    if (!renderer) continue;
    const track = mapSearchItem(renderer);
    if (track && !seen.has(track.id)) {
      seen.add(track.id);
      tracks.push(track);
    }
  }
  return tracks;
}

// --- Player response parsing ------------------------------------------------

export interface PlayabilityResult {
  status: string;
  reason?: string;
  formats: AdaptiveFormat[];
}

export function parsePlayerResponse(response: PlayerResponse): PlayabilityResult {
  const status = response.playabilityStatus?.status;
  if (!status) {
    throw new YouTubeMusicError('Unexpected response from YouTube Music.', 'PARSER_ERROR');
  }
  return {
    status,
    reason: response.playabilityStatus?.reason,
    formats: response.streamingData?.adaptiveFormats ?? [],
  };
}

/**
 * Picks the best playable audio stream out of `adaptiveFormats`.
 *
 * Priority: a direct `url` (never a `signatureCipher`-only format — this app
 * does not implement YouTube's signature-cipher deobfuscation) > audio-only
 * mimeType > a broadly-compatible container (audio/mp4 over audio/webm) >
 * a reasonable bitrate rather than blindly the highest one available.
 */
export function selectBestAudioStream(formats: AdaptiveFormat[]): AudioStream | null {
  const playable = formats.filter((f): f is AdaptiveFormat & { url: string } =>
    typeof f.url === 'string' && f.url.length > 0 && typeof f.mimeType === 'string' && f.mimeType.startsWith('audio/')
  );
  if (playable.length === 0) return null;

  const TARGET_BITRATE = 160_000;
  const score = (f: AdaptiveFormat) => {
    const containerScore = f.mimeType?.startsWith('audio/mp4') ? 0 : f.mimeType?.startsWith('audio/webm') ? 1 : 2;
    const bitrate = f.bitrate ?? f.averageBitrate ?? 0;
    const bitrateScore = Math.abs(bitrate - TARGET_BITRATE);
    return [containerScore, bitrateScore] as const;
  };

  const best = playable.reduce((a, b) => {
    const [ac, ab] = score(a);
    const [bc, bb] = score(b);
    if (ac !== bc) return ac < bc ? a : b;
    return ab < bb ? a : b;
  });

  return {
    url: best.url,
    mimeType: best.mimeType,
    bitrate: best.bitrate ?? best.averageBitrate,
    contentLength: best.contentLength ? Number(best.contentLength) : undefined,
    audioQuality: best.audioQuality,
  };
}

// --- Lyrics parsing ----------------------------------------------------------

const LYRICS_PAGE_TYPE = 'MUSIC_PAGE_TYPE_TRACK_LYRICS';

export function parseLyricsBrowseId(response: NextResponse): string | null {
  const tabs =
    response.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer
      ?.tabs ?? [];
  for (const tab of tabs) {
    const renderer = tab.tabRenderer;
    if (!renderer || renderer.unselectable) continue;
    const browse = renderer.endpoint?.browseEndpoint;
    if (browse?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType === LYRICS_PAGE_TYPE) {
      return browse.browseId ?? null;
    }
  }
  return null;
}

export function parseLyricsText(response: BrowseLyricsResponse): string | null {
  const shelf = response.contents?.sectionListRenderer?.contents?.[0]?.musicDescriptionShelfRenderer;
  const text = shelf?.description?.runs?.[0]?.text;
  return text && text.trim().length > 0 ? text : null;
}
