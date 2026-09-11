/**
 * Central config for the music API integration. UI/screens must never
 * hardcode this URL or talk to the network directly — go through
 * `src/services/musicApi.ts`.
 */
export const MUSIC_API_BASE_URL =
  process.env.EXPO_PUBLIC_MUSIC_API_BASE_URL?.trim().replace(/\/+$/, '') || 'https://musicapi.x007.workers.dev';

/** Only engine we're wired for; the API also accepts seevn/hunjama/mtmusic/wunk. */
export const DEFAULT_SEARCH_ENGINE = 'gaama';

export const API_TIMEOUT_MS = 10000;

export const SEARCH_DEBOUNCE_MS = 500;
export const SEARCH_MIN_QUERY_LENGTH = 2;
