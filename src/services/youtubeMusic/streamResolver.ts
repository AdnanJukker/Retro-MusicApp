import {
  getSelfHostedResolverUrl,
  getStreamResolverInstances,
  SELF_HOSTED_RESOLVER_TIMEOUT_MS,
  STREAM_RESOLVER_TIMEOUT_MS,
} from '@/services/youtubeMusic/innertubeConfig';
import type {
  AudioStream,
  PipedAudioStream,
  PipedStreamsResponse,
  SelfHostedResolverResponse,
} from '@/services/youtubeMusic/innertubeTypes';

function devLog(...args: unknown[]): void {
  if (__DEV__) console.log('[youtubeMusic:streamResolver]', ...args);
}

function selectBestPipedStream(streams: PipedAudioStream[]): AudioStream | null {
  const playable = streams.filter(
    (s): s is PipedAudioStream & { url: string } => typeof s.url === 'string' && s.url.length > 0 && s.videoOnly !== true
  );
  if (playable.length === 0) return null;

  const TARGET_BITRATE = 160_000;
  const score = (s: PipedAudioStream) => {
    const containerScore = s.mimeType?.startsWith('audio/mp4') ? 0 : s.mimeType?.startsWith('audio/webm') ? 1 : 2;
    const bitrateScore = Math.abs((s.bitrate ?? 0) - TARGET_BITRATE);
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
    bitrate: best.bitrate,
    contentLength: best.contentLength,
  };
}

async function fetchFromInstance(baseUrl: string, videoId: string, signal?: AbortSignal): Promise<AudioStream> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STREAM_RESOLVER_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  try {
    const response = await fetch(`${baseUrl}/streams/${encodeURIComponent(videoId)}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = (await response.json()) as PipedStreamsResponse;
    const stream = selectBestPipedStream(json.audioStreams ?? []);
    if (!stream) throw new Error('no audio streams in response');
    devLog(baseUrl, 'resolved', stream.mimeType, stream.bitrate);
    return stream;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

async function fetchFromSelfHostedResolver(baseUrl: string, videoId: string, signal?: AbortSignal): Promise<AudioStream> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SELF_HOSTED_RESOLVER_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  try {
    const response = await fetch(`${baseUrl}/resolve/${encodeURIComponent(videoId)}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = (await response.json()) as SelfHostedResolverResponse;
    if (!json.url) throw new Error('resolver returned no url');
    devLog('self-hosted resolver', 'resolved', json.mimeType, json.bitrate);
    return { url: json.url, mimeType: json.mimeType, bitrate: json.bitrate };
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

/**
 * Best-effort fallback used only when InnerTube's own response has no direct
 * URL. Tries your self-hosted resolver first (see `server/README.md`) if
 * `EXPO_PUBLIC_STREAM_RESOLVER_URL` is set — it's the one fallback under your
 * own control and stays current since it's backed by `yt-dlp`. Falls back to
 * racing public Piped instances (frequently down) if that's unset or fails.
 * Resolves to `null` (never throws) if everything fails, so the caller can
 * surface a clean `NO_AUDIO_STREAM` error instead of an unhelpful proxy one.
 */
export async function resolveViaStreamProxy(videoId: string, signal?: AbortSignal): Promise<AudioStream | null> {
  const selfHosted = getSelfHostedResolverUrl();
  if (selfHosted) {
    try {
      return await fetchFromSelfHostedResolver(selfHosted, videoId, signal);
    } catch (err) {
      devLog('self-hosted resolver failed, falling back to public instances', err instanceof Error ? err.message : err);
    }
  }

  const instances = getStreamResolverInstances();
  if (instances.length === 0) return null;

  devLog('trying', instances.length, 'public instance(s) for', videoId);
  const attempts = instances.map((base) => fetchFromInstance(base, videoId, signal));

  try {
    return await Promise.any(attempts);
  } catch {
    devLog('all instances failed for', videoId);
    return null;
  }
}
