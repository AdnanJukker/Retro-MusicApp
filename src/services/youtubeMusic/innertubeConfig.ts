/**
 * Central config for the unauthenticated YouTube Music InnerTube integration.
 * Ported from `ytmusicapi`'s `constants.py` / `YTMusicBase.__init__` — WEB_REMIX
 * client, no API key, no auth headers. Nothing here should ever include
 * cookies, OAuth tokens, or account-specific data.
 */

export const INNERTUBE_BASE_URL = 'https://music.youtube.com/youtubei/v1/';

const CLIENT_NAME = 'WEB_REMIX';

/** ytmusicapi/InnerTube web clients compute this as `"1." + todays-date + ".01.00"`. */
function currentClientVersion(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `1.${y}${m}${d}.01.00`;
}

export function buildInnertubeContext(): Record<string, unknown> {
  return {
    context: {
      client: {
        clientName: CLIENT_NAME,
        clientVersion: currentClientVersion(),
        hl: 'en',
        gl: 'US',
      },
    },
  };
}

export function buildInnertubeHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json',
    accept: '*/*',
    origin: 'https://music.youtube.com',
    // Sets the "socs" consent cookie YouTube expects on unauthenticated
    // requests; no session/account cookie is ever sent.
    cookie: 'SOCS=CAI',
  };
}

/**
 * Current `filter="songs"` search params, ported verbatim from
 * `ytmusicapi/parsers/search.py::get_search_params()` (do not hand-derive —
 * this value is opaque protobuf and must come from the reference source).
 */
export const SEARCH_FILTER_SONGS_PARAMS = 'EgWKAQIIAWoMEA4QChADEAQQCRAF';

export const REQUEST_TIMEOUT_MS = 12000;

/**
 * `signatureTimestamp` for the `player` endpoint. ytmusicapi's `get_song`
 * defaults to `get_datestamp() - 1` (days since Unix epoch, UTC, minus one)
 * whenever the caller doesn't supply a freshly-scraped value. That default
 * is what every unauthenticated caller effectively uses in practice, so we
 * port exactly that mechanism rather than scraping YouTube's player JS.
 */
export function getSignatureTimestamp(): number {
  const daysSinceEpoch = Math.floor(Date.now() / 86_400_000);
  return daysSinceEpoch - 1;
}

/**
 * Optional fallback stream resolvers, used only when WEB_REMIX's `player`
 * response has no direct `url` (every `adaptiveFormats` entry is
 * `signatureCipher`-only — this app never deciphers that itself). Each must
 * speak the public Piped API (`GET /streams/{videoId}` -> `audioStreams`).
 *
 * Public instances rotate constantly and are frequently down — set
 * `EXPO_PUBLIC_PIPED_INSTANCES` (comma-separated base URLs) to point at
 * ones you know are alive, e.g. a self-hosted instance, to override the
 * best-effort defaults below.
 */
export function getStreamResolverInstances(): string[] {
  const override = process.env.EXPO_PUBLIC_PIPED_INSTANCES?.trim();
  const list = override
    ? override.split(',')
    : ['https://pipedapi.kavin.rocks', 'https://api.piped.projectsegfau.lt', 'https://piped-api.adminforge.de'];
  return list.map((url) => url.trim().replace(/\/+$/, '')).filter(Boolean);
}

export const STREAM_RESOLVER_TIMEOUT_MS = 6000;

/**
 * Base URL of the `server/` resolver (see `server/README.md`) —
 * a thin wrapper around `yt-dlp`, which stays current with YouTube's
 * cipher/signature changes unlike the public Piped network. Tried first,
 * since it's the one fallback under our control. The production Render URL
 * is the default; the environment variable overrides it for local/staging.
 */
const DEFAULT_STREAM_RESOLVER_URL = 'https://retro-musicapp.onrender.com';

export function getSelfHostedResolverUrl(): string | undefined {
  const url = (process.env.EXPO_PUBLIC_STREAM_RESOLVER_URL?.trim() || DEFAULT_STREAM_RESOLVER_URL).replace(/\/+$/, '');
  return url || undefined;
}

// yt-dlp extraction (fetching + parsing the watch page) genuinely takes a
// few seconds — longer than a Piped instance just returning a cached result.
export const SELF_HOSTED_RESOLVER_TIMEOUT_MS = 60000;
