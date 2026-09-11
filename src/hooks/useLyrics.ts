import { useEffect, useState } from 'react';

import { getLyrics } from '@/services/youtubeMusic';

export type LyricsState = 'idle' | 'loading' | 'success' | 'unavailable' | 'error';

interface UseLyricsResult {
  state: LyricsState;
  lyrics: string | null;
  errorMessage: string | null;
  retry: () => void;
}

interface LyricsOutcome {
  attempt: number;
  /** Which track this outcome answers — used to detect staleness without refs. */
  trackId: string;
  lyrics: string | null;
  errorMessage: string | null;
}

// Session-scoped cache: trackId -> resolved lyrics (null means "known to be
// unavailable"). Shared across hook instances so re-opening lyrics for the
// same track never re-hits the network.
const lyricsCache = new Map<string, string | null>();

/** Lazily fetches (and session-caches) lyrics for a track id. Pass `null`/`undefined` to skip. */
export function useLyrics(trackId: string | null | undefined): UseLyricsResult {
  const [outcome, setOutcome] = useState<LyricsOutcome | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = () => setAttempt((value) => value + 1);

  useEffect(() => {
    if (!trackId || lyricsCache.has(trackId)) return;

    const controller = new AbortController();
    getLyrics(trackId, { signal: controller.signal })
      .then((text) => {
        if (controller.signal.aborted) return;
        lyricsCache.set(trackId, text);
        setOutcome({ trackId, attempt, lyrics: text, errorMessage: null });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setOutcome({ trackId, attempt, lyrics: null, errorMessage: err instanceof Error ? err.message : "Couldn't load lyrics." });
      });
    return () => controller.abort();
  }, [trackId, attempt]);

  if (!trackId) {
    return { state: 'idle', lyrics: null, errorMessage: null, retry };
  }

  if (lyricsCache.has(trackId)) {
    const cached = lyricsCache.get(trackId) ?? null;
    return { state: cached ? 'success' : 'unavailable', lyrics: cached, errorMessage: null, retry };
  }

  if (outcome?.trackId !== trackId || outcome.attempt !== attempt) {
    return { state: 'loading', lyrics: null, errorMessage: null, retry };
  }
  if (outcome.errorMessage) {
    return { state: 'error', lyrics: null, errorMessage: outcome.errorMessage, retry };
  }
  return { state: outcome.lyrics ? 'success' : 'unavailable', lyrics: outcome.lyrics, errorMessage: null, retry };
}
