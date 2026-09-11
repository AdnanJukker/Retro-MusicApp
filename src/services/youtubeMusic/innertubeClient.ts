import {
  buildInnertubeContext,
  buildInnertubeHeaders,
  INNERTUBE_BASE_URL,
  REQUEST_TIMEOUT_MS,
} from '@/services/youtubeMusic/innertubeConfig';
import { YouTubeMusicError } from '@/services/youtubeMusic/errors';

export type InnertubeEndpoint = 'search' | 'player' | 'next' | 'browse';

function devLog(...args: unknown[]): void {
  if (__DEV__) console.log('[youtubeMusic]', ...args);
}

/**
 * Single reusable POST helper for every InnerTube endpoint this app uses.
 * Owns base URL, client context, headers, timeout, and error mapping so
 * every call site (search/player/next/browse) behaves identically.
 */
export async function postInnertube<T>(
  endpoint: InnertubeEndpoint,
  body: Record<string, unknown>,
  externalSignal?: AbortSignal
): Promise<T> {
  if (externalSignal?.aborted) {
    throw new DOMException('Request was cancelled.', 'AbortError');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort);

  const requestBody = { ...buildInnertubeContext(), ...body };
  const startedAt = __DEV__ ? Date.now() : 0;

  try {
    let response: Response;
    try {
      response = await fetch(`${INNERTUBE_BASE_URL}${endpoint}?alt=json`, {
        method: 'POST',
        headers: buildInnertubeHeaders(),
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (err) {
      if (externalSignal?.aborted) {
        throw new DOMException('Request was cancelled.', 'AbortError');
      }
      if (controller.signal.aborted) {
        devLog(endpoint, 'TIMEOUT');
        throw new YouTubeMusicError("Couldn't reach YouTube Music. Tap to retry.", 'TIMEOUT');
      }
      devLog(endpoint, 'NETWORK', err instanceof Error ? err.message : err);
      throw new YouTubeMusicError("Couldn't reach YouTube Music. Tap to retry.", 'NETWORK');
    }

    if (response.status === 429) {
      devLog(endpoint, 'status', 429);
      throw new YouTubeMusicError('Too many requests right now. Please try again shortly.', 'RATE_LIMITED');
    }
    if (!response.ok) {
      devLog(endpoint, 'status', response.status);
      throw new YouTubeMusicError(`YouTube Music returned an error (${response.status}).`, 'UNAVAILABLE');
    }

    let json: T;
    try {
      json = (await response.json()) as T;
    } catch {
      devLog(endpoint, 'INVALID_RESPONSE (bad json)');
      throw new YouTubeMusicError('Received an invalid response from YouTube Music.', 'INVALID_RESPONSE');
    }

    devLog(endpoint, 'ok', `${Date.now() - startedAt}ms`);
    return json;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}
