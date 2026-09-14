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

const RESOLVER_HEALTH_TIMEOUT_MS = 4000;

async function resolverHasProxy(baseUrl: string, signal?: AbortSignal): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RESOLVER_HEALTH_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  try {
    const response = await fetch(`${baseUrl}/health`, { signal: controller.signal });
    if (!response.ok) return false;
    const health = await response.json() as { youtubeProxyConfigured?: boolean };
    // Old resolver versions did not expose this field, so preserve their
    // previous behavior. Current deployments explicitly report true/false.
    return health.youtubeProxyConfigured !== false;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onExternalAbort);
  }
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
    // /resolve only confirms playability and returns metadata — the raw
    // googlevideo URL it finds is IP-locked to the resolver server itself
    // (verified: fetching it from a different IP gets a plain 403), so it's
    // never usable by the phone directly. The phone instead always plays
    // from /stream on our own resolver domain, which proxies the audio
    // bytes through using the resolver's own (matching) IP.
    const response = await fetch(`${baseUrl}/resolve/${encodeURIComponent(videoId)}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = (await response.json()) as SelfHostedResolverResponse;
    devLog('self-hosted resolver', 'resolved', json.mimeType, json.bitrate);
    return { url: `${baseUrl}/stream/${encodeURIComponent(videoId)}`, mimeType: json.mimeType, bitrate: json.bitrate };
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

/**
 * Best-effort fallback used only when InnerTube's own response has no direct
 * URL. Tries your self-hosted resolver first (see `server/README.md`) if
 * `EXPO_PUBLIC_STREAM_RESOLVER_URL` is set and reports a configured YouTube
 * proxy — it's the one fallback under your own control and stays current since
 * it's backed by `yt-dlp`. Falls back to racing public Piped instances
 * (frequently down) if that's unset, unproxied, or fails.
 * Resolves to `null` (never throws) if everything fails, so the caller can
 * surface a clean `NO_AUDIO_STREAM` error instead of an unhelpful proxy one.
 */
export async function resolveViaStreamProxy(videoId: string, signal?: AbortSignal): Promise<AudioStream | null> {
  const selfHosted = getSelfHostedResolverUrl();
  if (selfHosted) {
    if (await resolverHasProxy(selfHosted, signal)) {
      try {
        return await fetchFromSelfHostedResolver(selfHosted, videoId, signal);
      } catch (err) {
        devLog('self-hosted resolver failed, falling back to public instances', err instanceof Error ? err.message : err);
      }
    } else {
      devLog('self-hosted resolver has no working proxy; skipping extraction');
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
