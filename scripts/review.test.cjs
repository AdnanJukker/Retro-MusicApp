const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Exercise the actual TypeScript modules with only native audio/network/storage
// replaced. No simulator or extra test framework is needed for these regressions.
function loader(mocks = {}, timers = { setTimeout, clearTimeout }) {
  const cache = new Map();
  function load(name) {
    if (name in mocks) return mocks[name];
    if (!name.startsWith('@/')) return require(name);
    if (cache.has(name)) return cache.get(name).exports;
    const filename = path.join(__dirname, '../src', name.slice(2) + '.ts');
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const module = { exports: {} };
    cache.set(name, module);
    new Function('require', 'module', 'exports', '__DEV__', 'setTimeout', 'clearTimeout', output)(load, module, module.exports, false, timers.setTimeout, timers.clearTimeout);
    return module.exports;
  }
  return load;
}

const tick = () => new Promise((resolve) => setImmediate(resolve));
const a = { id: 'a', title: 'First track', source: 'youtube-music' };
const b = { id: 'b', title: 'Second track', source: 'youtube-music' };
const status = { currentTime: 0, duration: 180, playing: true, isLoaded: true, isBuffering: false, error: null, didJustFinish: false };

function fixture({ deferSeek = false } = {}) {
  const pending = [];
  const played = [];
  const saved = new Map();
  const timers = new Map();
  let listener;
  let active = false;
  let seek = null;
  let writes = 0;
  let finishSeek;
  const audio = {
    setStatusListener: (value) => { listener = value; },
    reset: () => { active = false; },
    loadAndPlay: async (url, track, signal) => { if (!signal.aborted) { played.push(track.id); active = true; } },
    hasPlayer: () => active,
    play: () => { active = true; },
    pause: () => { active = false; },
    seekTo: (value) => { seek = value; return deferSeek ? new Promise((resolve) => { finishSeek = resolve; }) : Promise.resolve(); },
  };
  const storage = {
    getItem: async (key) => saved.get(key) ?? null,
    setItem: async (key, value) => { writes++; saved.set(key, value); },
    removeItem: async (key) => saved.delete(key),
  };
  const load = loader({
    '@/services/audioEngine': audio,
    '@/services/musicService': {
      getStreamUrlCached: (id, options) => new Promise((resolve, reject) => pending.push({ id, options, resolve, reject })),
      invalidateStreamUrl: () => {},
    },
    '@react-native-async-storage/async-storage': storage,
  }, { setTimeout: (fn) => { const key = Symbol(); timers.set(key, fn); return key; }, clearTimeout: (key) => timers.delete(key) });
  const store = load('@/store/playerStore').usePlayerStore;
  return { store, pending, played, saved, timers, finishSeek: () => finishSeek(), emit: (event = {}) => listener({ ...status, ...event }), active: () => active, seek: () => seek, writes: () => writes };
}

test('rapid track selection cancels the old request and only starts the newest track', async () => {
  const f = fixture();
  f.store.getState().playTrack(a);
  f.store.getState().playTrack(b);
  assert.equal(f.pending[0].options.signal.aborted, true);
  f.pending[1].resolve('https://example.test/b');
  await tick();
  f.pending[0].resolve('https://example.test/a');
  await tick();
  assert.deepEqual(f.played, ['b']);
});

test('pause while resolving prevents delayed autoplay and allows a new attempt', async () => {
  const f = fixture();
  f.store.getState().playTrack(a);
  f.store.getState().pauseTrack();
  f.pending[0].resolve('https://example.test/a');
  await tick();
  assert.deepEqual(f.played, []);
  f.store.getState().resumeTrack();
  assert.equal(f.pending.length, 2);
});

test('changing tracks immediately stops the previous audio', async () => {
  const f = fixture();
  f.store.getState().playTrack(a);
  f.pending[0].resolve('https://example.test/a');
  await tick();
  assert.equal(f.active(), true);
  f.store.getState().playTrack(b);
  assert.equal(f.active(), false);
});

test('queue index clamps and a track missing from the supplied queue still plays itself', () => {
  const f = fixture();
  f.store.getState().playQueue([a, b], 99);
  assert.equal(f.store.getState().currentIndex, 1);
  f.store.getState().playQueue([a, b], NaN);
  assert.equal(f.store.getState().currentIndex, 0);
  f.store.getState().playTrack(a, [b]);
  assert.equal(f.store.getState().queue[0].id, 'a');
});

test('demo tracks never reach the streaming service', () => {
  const f = fixture();
  f.store.getState().playTrack({ id: 't1', title: 'Demo' });
  assert.equal(f.pending.length, 0);
  assert.match(f.store.getState().error, /demo archive/);
});

test('native playback errors retry once, then stop with a recoverable error', async () => {
  const f = fixture();
  f.store.getState().playTrack(a);
  f.pending[0].resolve('https://example.test/a');
  await tick();
  f.emit({ error: 'expired' });
  assert.equal(f.pending.length, 2);
  assert.equal(f.pending[1].options.forceRefresh, true);
  f.pending[1].resolve('https://example.test/refreshed');
  await tick();
  f.emit({ error: 'still failed' });
  assert.equal(f.pending.length, 2);
  assert.equal(f.store.getState().isLoading, false);
  assert.match(f.store.getState().error, /Playback failed/);
});

test('history records actual playback, keeps unique tracks, and avoids progress storage writes', async () => {
  const f = fixture();
  f.store.getState().playTrack(a);
  assert.equal(f.store.getState().history.length, 0);
  f.pending[0].resolve('https://example.test/a');
  await tick();
  f.emit();
  await tick();
  const writes = f.writes();
  f.emit({ currentTime: 1 });
  f.emit({ currentTime: 2 });
  await tick();
  assert.equal(f.writes(), writes);
  assert.deepEqual(f.store.getState().history.map((item) => item.id), ['a']);
});

test('favorites and follows rehydrate without restoring playback or temporary errors', async () => {
  const f = fixture();
  f.store.getState().toggleFavorite(a);
  f.store.getState().toggleFollowArtist('artist');
  f.store.getState().playTrack(b);
  await tick();
  const value = JSON.parse(f.saved.get('hifi-library-v1'));
  assert.deepEqual(Object.keys(value.state).sort(), ['favorites', 'followedArtists', 'history', 'repeat', 'shuffle']);
  const restored = fixture();
  restored.saved.set('hifi-library-v1', JSON.stringify(value));
  await restored.store.persist.rehydrate();
  assert.equal(restored.store.getState().favorites[0].id, 'a');
  assert.deepEqual(restored.store.getState().followedArtists, ['artist']);
  assert.equal(restored.store.getState().queue.length, 0);
  assert.equal(restored.store.getState().isPlaying, false);
});

test('seek clamps position and ignores non-finite values', async () => {
  const f = fixture();
  f.store.getState().playTrack(a);
  f.pending[0].resolve('https://example.test/a');
  await tick();
  f.emit();
  f.store.getState().seekTo(999);
  await tick();
  assert.equal(f.seek(), 180);
  f.store.getState().seekTo(NaN);
  assert.equal(f.seek(), 180);
});

test('loading timeout cancels the stream and exposes retry', () => {
  const f = fixture();
  f.store.getState().playTrack(a);
  [...f.timers.values()][0]();
  assert.equal(f.pending[0].options.signal.aborted, true);
  assert.equal(f.store.getState().isLoading, false);
  assert.match(f.store.getState().error, /too long/);
});

test('repeat and shuffle respect queue boundaries', () => {
  const { nextQueueIndex } = loader()('@/utils/queue');
  assert.equal(nextQueueIndex(0, 0, false, 'all'), null);
  assert.equal(nextQueueIndex(1, 0, true, 'off'), null);
  assert.equal(nextQueueIndex(1, 0, false, 'one'), 0);
  assert.equal(nextQueueIndex(3, 2, false, 'off'), null);
  assert.equal(nextQueueIndex(3, 2, false, 'all'), 0);
  assert.equal(nextQueueIndex(3, 1, false, 'one'), 2);
  for (let i = 0; i < 100; i++) assert.notEqual(nextQueueIndex(3, 1, true, 'all'), 1);
});

test('time readouts tolerate unknown durations and never round forward', () => {
  const { formatDuration, formatLongDuration } = loader()('@/utils/format');
  assert.equal(formatDuration(59.9), '0:59');
  assert.equal(formatDuration(Infinity), '0:00');
  assert.equal(formatDuration(-10), '0:00');
  assert.equal(formatLongDuration(0), '0 MIN');
});

test('previous returns to the actual prior selection after shuffle', () => {
  const f = fixture();
  f.store.getState().playQueue([a, b, { ...a, id: 'c' }], 0);
  f.store.getState().toggleShuffle();
  f.store.getState().nextTrack();
  assert.notEqual(f.store.getState().currentIndex, 0);
  f.store.getState().previousTrack();
  assert.equal(f.store.getState().currentIndex, 0);
});

test('pausing during repeat-one seek prevents delayed autoplay', async () => {
  const f = fixture({ deferSeek: true });
  f.store.getState().playTrack(a);
  f.pending[0].resolve('https://example.test/a');
  await tick();
  f.store.getState().toggleRepeat();
  f.store.getState().toggleRepeat();
  f.emit({ didJustFinish: true, playing: false });
  f.store.getState().pauseTrack();
  f.finishSeek();
  await tick();
  assert.equal(f.active(), false);
});

test('audio engine detaches the previous player and rejects its delayed events', async () => {
  const players = [];
  const received = [];
  const load = loader({
    'expo-audio': {
      setAudioModeAsync: async () => {},
      createAudioPlayer: () => {
        const player = {
          paused: false, removed: false, detached: false,
          addListener: (_name, listener) => { player.emit = listener; return { remove: () => { player.detached = true; } }; },
          play: () => {}, pause: () => { player.paused = true; },
          remove: () => { player.removed = true; },
          setActiveForLockScreen: () => {},
        };
        players.push(player);
        return player;
      },
    },
  });
  const engine = load('@/services/audioEngine');
  engine.setStatusListener((event) => received.push(event.id));
  assert.equal(players.length, 0);
  await engine.loadAndPlay('https://example.test/a', a, new AbortController().signal);
  await engine.loadAndPlay('https://example.test/b', b, new AbortController().signal);
  players[0].emit({ id: 'old', didJustFinish: true });
  players[1].emit({ id: 'new' });
  assert.deepEqual(received, ['new']);
  assert.equal(players[0].removed && players[0].paused && players[0].detached, true);
});

test('embedded playback uses the device player bridge without creating native audio', async () => {
  let nativePlayers = 0;
  const received = [];
  const load = loader({
    'expo-audio': {
      setAudioModeAsync: async () => {},
      createAudioPlayer: () => { nativePlayers++; },
    },
  });
  const engine = load('@/services/audioEngine');
  const playbackUrl = load('@/services/playbackUrl');
  engine.setStatusListener((event) => received.push(event));

  const url = playbackUrl.createEmbeddedPlaybackUrl('Uo_OSlQZlgY');
  assert.equal(playbackUrl.parseEmbeddedPlaybackUrl(url), 'Uo_OSlQZlgY');
  assert.equal(playbackUrl.parseEmbeddedPlaybackUrl('youtube-embed:bad'), null);
  assert.throws(() => playbackUrl.createEmbeddedPlaybackUrl('bad'));

  await engine.loadAndPlay(url, a, new AbortController().signal);
  assert.equal(nativePlayers, 0);
  assert.deepEqual(engine.getEmbeddedPlayback(), { videoId: 'Uo_OSlQZlgY', playing: true });
  assert.equal(received.at(-1).isLoaded, false);

  let seekPosition = null;
  engine.setEmbeddedPlayerController({ seekTo: (seconds) => { seekPosition = seconds; } });
  await engine.seekTo(42);
  assert.equal(seekPosition, 42);
  engine.reportEmbeddedReady(180);
  engine.reportEmbeddedState('ended');
  assert.equal(received.at(-1).didJustFinish, true);
  engine.reset();
  assert.equal(engine.getEmbeddedPlayback(), null);
});

test('YouTube Music provider rejects unavailable audio instead of claiming iframe playback succeeded', async () => {
  const load = loader({
    '@/services/youtubeMusic/innertubeClient': { postInnertube: async () => ({}) },
    '@/services/youtubeMusic/innertubeConfig': {
      getSignatureTimestamp: () => 1,
      SEARCH_FILTER_SONGS_PARAMS: 'songs',
    },
    '@/services/youtubeMusic/innertubeParsers': {
      parsePlayerResponse: () => ({ status: 'OK', reason: undefined, formats: [] }),
      selectBestAudioStream: () => null,
      parseLyricsBrowseId: () => null,
      parseLyricsText: () => null,
      parseSearchSongs: () => [],
    },
    '@/services/youtubeMusic/streamResolver': { resolveViaStreamProxy: async () => null },
  });
  const provider = load('@/services/youtubeMusic/YouTubeMusicProvider');
  await assert.rejects(provider.getAudioStream('Uo_OSlQZlgY'), /Search this song again/);
});

test('new catalog tracks use the existing audio engine and wait for real playback before entering history', async () => {
  const f = fixture();
  const track = { id: 'saavn:Yv-9NmYK', title: 'Besharam Rang', source: 'jiosaavn' };
  f.store.getState().playTrack(track);
  assert.equal(f.pending[0].id, track.id);
  f.pending[0].resolve('https://example.test/music/stream/Yv-9NmYK');
  await tick();
  assert.deepEqual(f.played, [track.id]);
  assert.equal(f.store.getState().isPlaying, false);
  assert.equal(f.store.getState().history.length, 0);
  f.emit();
  assert.equal(f.store.getState().isPlaying, true);
  assert.equal(f.store.getState().history[0].id, track.id);
  f.store.getState().pauseTrack();
});

test('catalog service preserves track identity, resolves fresh proxy URLs, and retains saved YouTube routing', async (t) => {
  const requests = [];
  const ytIds = [];
  const load = loader({
    '@/services/youtubeMusic/YouTubeMusicProvider': {
      getStreamUrlCached: async (id) => { ytIds.push(id); return 'https://example.test/old'; },
      invalidateStreamUrl: () => {}, getLyrics: async () => 'old lyrics',
    },
  });
  const track = { id: 'saavn:Yv-9NmYK', source: 'jiosaavn', title: 'Besharam Rang' };
  t.mock.method(globalThis, 'fetch', async (url) => {
    requests.push(new URL(url));
    return new Response(JSON.stringify(url.includes('/search?') ? { tracks: [track] } : { mimeType: 'audio/mp4' }));
  });
  const service = load('@/services/musicService');
  assert.deepEqual(await service.searchTracks('A & B'), [track]);
  assert.equal(requests[0].searchParams.get('q'), 'A & B');
  const first = await service.getStreamUrlCached(track.id);
  assert.match(first, /\/music\/stream\/Yv-9NmYK$/);
  assert.equal(await service.getStreamUrlCached(track.id, { forceRefresh: true }), first);
  assert.equal(requests.at(-1).searchParams.get('refresh'), 'true');
  assert.equal(requests.filter((url) => url.pathname.includes('/resolve/')).length, 2);
  await service.getStreamUrlCached('Uo_OSlQZlgY');
  assert.deepEqual(ytIds, ['Uo_OSlQZlgY']);
  await assert.rejects(service.getStreamUrlCached('saavn:invalid'), /Invalid song id/);
  assert.equal(ytIds.length, 1);
});

test('catalog cancellation never starts requests or falls back to a different song', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('must not fetch'); });
  const service = loader({ '@/services/youtubeMusic/YouTubeMusicProvider': {} })('@/services/musicService');
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(service.getStreamUrlCached('saavn:Yv-9NmYK', { signal: controller.signal }), /cancelled/);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('catalog rejects backend errors and unsupported media instead of returning a player URL', async (t) => {
  const service = loader({ '@/services/youtubeMusic/YouTubeMusicProvider': {} })('@/services/musicService');
  const mockFetch = t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 502 }));
  await assert.rejects(service.getStreamUrlCached('saavn:Yv-9NmYK'), /service is unavailable/);
  mockFetch.mock.mockImplementation(async () => new Response(JSON.stringify({ mimeType: 'text/html' })));
  await assert.rejects(service.getStreamUrlCached('saavn:Yv-9NmYK'), /no supported audio stream/);
});

test('an InnerTube network failure still attempts the backend for saved YouTube tracks', async () => {
  const ids = [];
  const provider = loader({
    '@/services/youtubeMusic/innertubeClient': { postInnertube: async () => { throw new Error('network failed'); } },
    '@/services/youtubeMusic/streamResolver': {
      resolveViaStreamProxy: async (id) => { ids.push(id); return { url: 'https://backend.test/stream/' + id }; },
    },
  })('@/services/youtubeMusic/YouTubeMusicProvider');
  const stream = await provider.getAudioStream('Uo_OSlQZlgY');
  assert.equal(stream.url, 'https://backend.test/stream/Uo_OSlQZlgY');
  assert.deepEqual(ids, ['Uo_OSlQZlgY']);
});

test('YouTube resolver is tried without a proxy health prerequisite and stops on cancellation', async (t) => {
  const load = loader({
    '@/services/youtubeMusic/innertubeConfig': {
      getSelfHostedResolverUrl: () => 'https://backend.test',
      getStreamResolverInstances: () => [],
      SELF_HOSTED_RESOLVER_TIMEOUT_MS: 1000,
    },
  });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(url);
    return new Response(JSON.stringify({ mimeType: 'audio/mp4' }));
  });
  const resolver = load('@/services/youtubeMusic/streamResolver');
  assert.equal((await resolver.resolveViaStreamProxy('Uo_OSlQZlgY')).url, 'https://backend.test/stream/Uo_OSlQZlgY');
  assert.deepEqual(calls, ['https://backend.test/resolve/Uo_OSlQZlgY']);
  const controller = new AbortController();
  controller.abort();
  assert.equal(await resolver.resolveViaStreamProxy('Uo_OSlQZlgY', controller.signal), null);
  assert.equal(calls.length, 1);
});
