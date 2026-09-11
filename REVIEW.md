# Mobile review and polish

Reviewed against the project's Expo SDK 57 requirements. Existing work and the warm analog design have been preserved.

## Findings addressed

| Priority | Finding | Change |
| --- | --- | --- |
| High | Previous audio continued while a new track resolved; delayed events could affect the wrong selection. | Cancel requests, release replaced players, isolate status events by player, limit automatic retries, and time out loading. |
| High | Favorites disappeared after restart. | Persist favorites, the last 40 unique played tracks, artist follows, shuffle, and repeat. Do not restore autoplay, transient errors, or expiring URLs. Serialize and deduplicate storage writes. |
| High | Home and archive playback used fabricated track IDs. | Feature live discovery and real history; identify demo collections and route their controls to relevant live searches. Guard the stream resolver against demo IDs. |
| High | A font error could leave the splash screen visible indefinitely. | Finish startup on font success or failure; restore the library before displaying interactive screens. Add the router error boundary. |
| Medium | Background audio was not configured at runtime. | Configure the SDK 57 audio session and lock-screen metadata. Disable unnecessary microphone and recording permissions. |
| Medium | Profile and player claimed unmeasured listening stats, storage, bitrates, lossless quality, and offline support. | Display actual collection counts and describe supported streaming and local metadata storage. |
| Medium | Small screens could clip transport controls; icon buttons were small or unlabeled. | Make the player scrollable, scale artwork, add a visible queue, enlarge key touch targets, add accessible names/states, and strengthen accent contrast. |
| Medium | Nested touch controls could activate their containing row. | Separate mini-player, track, and playlist actions into sibling controls. |
| Medium | Search rendered every result and canceled requests could still update state. | Virtualize results, ignore canceled responses, deduplicate results, hide discovery shortcuts during searches, and support prefilled searches from archive screens. |
| Medium | Scrubbing sent repeated seeks and used unstable touch coordinates. | Preview dragging and seek on release; support accessible 10-second adjustments. |
| Medium | Lyrics requests had no cancellation or retry action. | Cancel stale requests and provide a retry state. |
| Low | Detail screens lacked a playback dock; some direct-entry back actions had no destination. | Keep mini-player controls on artist/playlist pages and add fallback navigation. |

## Verification

- `npm run typecheck`
- `npm run lint`
- `npm test`: playback, cancellation, retry limits, queue boundaries, local persistence, storage-write deduplication, timeout, seeking, and duration regressions.
- `npx expo install --check`: dependencies match SDK 57.
- `npx expo export --platform all --output-dir dist-review`: Android, iOS, and web bundles; this checks bundling, not native compilation or device behavior.

## Remaining validation and service dependency

The configured host, `musicapi.x007.workers.dev`, could not be resolved from this environment, including an attempt with network access enabled. Live search and streaming could not be verified. This does not establish whether the service is unavailable in every environment. A compatible replacement can be configured with `EXPO_PUBLIC_MUSIC_API_BASE_URL`; see `.env.example`.

There is no connected browser or mobile device in this session. Visual layout, screen-reader behavior, real audio output, lock-screen controls, calls/audio interruptions, headphone disconnection, and background playback still need device verification. Test at small screen sizes and with larger accessibility text. The native audio plugin changes require a new native build.

The library stores track metadata, not audio downloads. Demo archive collections remain intentionally labeled as samples. There is no account sync or offline streaming.

## Versioned references

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
- [SDK 57 audio and background playback](https://docs.expo.dev/versions/v57.0.0/sdk/audio/)
- [SDK 57 splash screen](https://docs.expo.dev/versions/v57.0.0/sdk/splash-screen/)
