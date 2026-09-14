import { useEffect, useState } from 'react';

import { SEARCH_DEBOUNCE_MS, SEARCH_MIN_QUERY_LENGTH } from '@/constants/api';
import { searchTracks } from '@/services/musicService';
import type { Track } from '@/types/music';

export type SearchState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

interface UseMusicSearchResult {
  state: SearchState;
  results: Track[];
  errorMessage: string | null;
  retry: () => void;
}

interface SearchOutcome {
  /** The (trimmed query, retry attempt) this outcome answers — used to detect staleness without refs. */
  query: string;
  nonce: number;
  state: 'success' | 'empty' | 'error';
  results: Track[];
  errorMessage: string | null;
}

/** Debounced, cancel-safe search against the live music API. */
export function useMusicSearch(query: string): UseMusicSearchResult {
  const trimmed = query.trim();
  const isQueryable = trimmed.length >= SEARCH_MIN_QUERY_LENGTH;

  const [outcome, setOutcome] = useState<SearchOutcome | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (!isQueryable) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchTracks(trimmed, { signal: controller.signal })
        .then((tracks) => {
          if (controller.signal.aborted) return;
          setOutcome({
            query: trimmed,
            nonce: retryNonce,
            state: tracks.length === 0 ? 'empty' : 'success',
            results: tracks,
            errorMessage: null,
          });
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setOutcome({
            query: trimmed,
            nonce: retryNonce,
            state: 'error',
            results: [],
            errorMessage: err instanceof Error ? err.message : "Couldn't reach the music service.",
          });
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, isQueryable, retryNonce]);

  const retry = () => setRetryNonce((n) => n + 1);

  if (!isQueryable) {
    return { state: 'idle', results: [], errorMessage: null, retry };
  }

  // An outcome that doesn't match the current (query, retry attempt) is
  // either stale or simply hasn't arrived yet — either way, still loading.
  if (outcome?.query !== trimmed || outcome.nonce !== retryNonce) {
    return { state: 'loading', results: [], errorMessage: null, retry };
  }

  return { state: outcome.state, results: outcome.results, errorMessage: outcome.errorMessage, retry };
}
