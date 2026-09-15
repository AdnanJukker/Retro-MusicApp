import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as audioEngine from '@/services/audioEngine';
import { getStreamUrlCached, invalidateStreamUrl } from '@/services/musicService';
import type { Track } from '@/types/music';
import { nextQueueIndex, validQueueIndex } from '@/utils/queue';

export type RepeatMode = 'off' | 'all' | 'one';

interface PlayerState {
  queue: Track[];
  currentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  position: number;
  duration: number;
  shuffle: boolean;
  repeat: RepeatMode;
  continueQueue: boolean;
  saveHistory: boolean;
  animateArtwork: boolean;
  compactRows: boolean;
  favorites: Track[];
  history: Track[];
  followedArtists: string[];
  error: string | null;
  playTrack: (track: Track, queue?: Track[]) => void;
  playQueue: (tracks: Track[], startIndex?: number) => void;
  pauseTrack: () => void;
  resumeTrack: () => void;
  togglePlayPause: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setRepeat: (mode: RepeatMode) => void;
  setContinueQueue: (value: boolean) => void;
  setSaveHistory: (value: boolean) => void;
  setAnimateArtwork: (value: boolean) => void;
  setCompactRows: (value: boolean) => void;
  resetPreferences: () => void;
  seekTo: (seconds: number) => void;
  toggleFavorite: (track: Track) => void;
  toggleFollowArtist: (id: string) => void;
  retryPlayback: () => void;
  clearHistory: () => void;
  clearFavorites: () => void;
}

let request: AbortController | null = null;
let autoRetried = false;
let recordedTrackId: string | null = null;
let navigationHistory: number[] = [];
let playIntentVersion = 0;
let loadTimeout: ReturnType<typeof setTimeout> | undefined;

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : "Couldn't play this track. Please try again.";
}

// Persist library data only; playback and expiring stream URLs start fresh.
let lastQueuedValue: string | null = null;
let storageWrite = Promise.resolve();
const libraryStorage = {
  getItem: (name: string) => AsyncStorage.getItem(name),
  setItem: (name: string, value: string) => {
    if (value === lastQueuedValue) return storageWrite;
    lastQueuedValue = value;
    storageWrite = storageWrite.then(() => AsyncStorage.setItem(name, value)).catch((error) => {
      lastQueuedValue = null;
      console.warn('Could not save the local library.', error);
    });
    return storageWrite;
  },
  removeItem: (name: string) => AsyncStorage.removeItem(name),
};

export const usePlayerStore = create<PlayerState>()(persist((set, get) => {
  function stopPending() {
    request?.abort();
    clearTimeout(loadTimeout);
    audioEngine.reset();
  }

  function fail(error: unknown) {
    stopPending();
    set({ isLoading: false, isPlaying: false, error: messageFor(error) });
  }

  async function resolveAndPlay(track: Track, forceRefresh: boolean) {
    stopPending();
    const controller = new AbortController();
    request = controller;
    set({ isLoading: true, isPlaying: false, error: null });
    if (track.source !== 'youtube-music' && track.source !== 'jiosaavn') {
      fail(new Error('This is a demo archive track. Find playable music in Search.'));
      return;
    }
    loadTimeout = setTimeout(() => {
      if (!controller.signal.aborted) fail(new Error('This track took too long to load. Please retry.'));
    }, 65000);
    try {
      const url = await getStreamUrlCached(track.id, { forceRefresh, signal: controller.signal });
      if (controller.signal.aborted) return;
      await audioEngine.loadAndPlay(url, track, controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) fail(error);
    }
  }

  function startPlayback(queue: Track[], index: number, keepNavigation = false) {
    if (!queue.length) return;
    if (!keepNavigation) navigationHistory = [];
    const currentIndex = validQueueIndex(queue.length, index);
    autoRetried = false;
    recordedTrackId = null;
    stopPending();
    set({ queue: [...queue], currentIndex, position: 0, duration: 0, isPlaying: false });
    void resolveAndPlay(queue[currentIndex], false);
  }

  audioEngine.setStatusListener((status) => {
    const state = get();
    const track = state.queue[state.currentIndex];
    if (!track) return;
    if (status.error) {
      invalidateStreamUrl(track.id);
      if (!autoRetried) {
        autoRetried = true;
        void resolveAndPlay(track, true);
      } else fail(new Error('Playback failed. Please retry.'));
      return;
    }
    if (status.isLoaded) clearTimeout(loadTimeout);
    set({
      position: Number.isFinite(status.currentTime) ? Math.max(0, status.currentTime) : 0,
      duration: Number.isFinite(status.duration) ? Math.max(0, status.duration) : 0,
      isPlaying: status.playing,
      isLoading: !status.isLoaded || status.isBuffering,
    });
    if (status.playing && state.saveHistory && recordedTrackId !== track.id) {
      recordedTrackId = track.id;
      set({ history: [track, ...get().history.filter((item) => item.id !== track.id)].slice(0, 40) });
    }
    if (status.didJustFinish) {
      if (state.repeat === 'one') {
        const activeRequest = request;
        const intent = playIntentVersion;
        void audioEngine.seekTo(0).then(() => {
          if (request === activeRequest && !activeRequest?.signal.aborted && intent === playIntentVersion) audioEngine.play();
        }).catch((error) => { if (request === activeRequest) fail(error); });
      } else if (state.continueQueue) get().nextTrack();
      else get().pauseTrack();
    }
  });

  return {
    queue: [], currentIndex: 0, isPlaying: false, isLoading: false,
    position: 0, duration: 0, shuffle: false, repeat: 'off',
    continueQueue: true, saveHistory: true, animateArtwork: true, compactRows: false,
    favorites: [], history: [], followedArtists: [], error: null,
    playTrack: (track, queue) => {
      const nextQueue = queue?.some((item) => item.id === track.id) ? queue : [track];
      startPlayback(nextQueue, nextQueue.findIndex((item) => item.id === track.id));
    },
    playQueue: (tracks, index = 0) => startPlayback(tracks, index),
    pauseTrack: () => {
      playIntentVersion++;
      if (get().isLoading) stopPending();
      else audioEngine.pause();
      set({ isPlaying: false, isLoading: false });
    },
    resumeTrack: () => {
      const state = get();
      if (!state.queue[state.currentIndex] || state.isLoading) return;
      if (state.error || !audioEngine.hasPlayer()) { get().retryPlayback(); return; }
      const activeRequest = request;
      const intent = ++playIntentVersion;
      if (state.duration > 0 && state.position >= state.duration - 0.5) {
        void audioEngine.seekTo(0).then(() => {
          if (request === activeRequest && !activeRequest?.signal.aborted && intent === playIntentVersion) audioEngine.play();
        }).catch((error) => { if (request === activeRequest) fail(error); });
      } else {
        try { audioEngine.play(); } catch (error) { fail(error); }
      }
    },
    togglePlayPause: () => {
      if (get().isPlaying || get().isLoading) get().pauseTrack();
      else get().resumeTrack();
    },
    nextTrack: () => {
      const { queue, currentIndex, shuffle, repeat } = get();
      if (!queue.length) return;
      const index = nextQueueIndex(queue.length, currentIndex, shuffle, repeat);
      if (index === null) { get().pauseTrack(); return; }
      navigationHistory = [...navigationHistory, currentIndex].slice(-100);
      startPlayback(queue, index, true);
    },
    previousTrack: () => {
      const { queue, currentIndex, position, repeat } = get();
      if (!queue.length) return;
      if (position > 3) { get().seekTo(0); return; }
      const previous = navigationHistory.pop() ?? (currentIndex > 0 ? currentIndex - 1 : repeat === 'all' ? queue.length - 1 : 0);
      startPlayback(queue, previous, true);
    },
    toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),
    toggleRepeat: () => set((state) => ({ repeat: state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off' })),
    setRepeat: (repeat) => set({ repeat }),
    setContinueQueue: (continueQueue) => set({ continueQueue }),
    setSaveHistory: (saveHistory) => set({ saveHistory }),
    setAnimateArtwork: (animateArtwork) => set({ animateArtwork }),
    setCompactRows: (compactRows) => set({ compactRows }),
    resetPreferences: () => set({ shuffle: false, repeat: 'off', continueQueue: true, saveHistory: true, animateArtwork: true, compactRows: false }),
    seekTo: (seconds) => {
      const { duration, isLoading } = get();
      if (!Number.isFinite(seconds) || duration <= 0 || isLoading) return;
      const clamped = Math.min(Math.max(0, seconds), duration);
      const activeRequest = request;
      void audioEngine.seekTo(clamped).then(() => {
        if (request === activeRequest && !activeRequest?.signal.aborted) set({ position: clamped });
      }).catch((error) => { if (request === activeRequest) fail(error); });
    },
    toggleFavorite: (track) => set((state) => ({
      favorites: state.favorites.some((item) => item.id === track.id)
        ? state.favorites.filter((item) => item.id !== track.id) : [track, ...state.favorites],
    })),
    toggleFollowArtist: (id) => set((state) => ({
      followedArtists: state.followedArtists.includes(id)
        ? state.followedArtists.filter((item) => item !== id) : [...state.followedArtists, id],
    })),
    retryPlayback: () => {
      const track = get().queue[get().currentIndex];
      if (!track || get().isLoading) return;
      autoRetried = false;
      invalidateStreamUrl(track.id);
      void resolveAndPlay(track, true);
    },
    clearHistory: () => {
      recordedTrackId = get().queue[get().currentIndex]?.id ?? null;
      set({ history: [] });
    },
    clearFavorites: () => set({ favorites: [] }),
  };
}, {
  name: 'hifi-library-v1',
  storage: createJSONStorage(() => libraryStorage),
  skipHydration: true,
  partialize: ({ favorites, history, followedArtists, shuffle, repeat, continueQueue, saveHistory, animateArtwork, compactRows }) => (
    { favorites, history, followedArtists, shuffle, repeat, continueQueue, saveHistory, animateArtwork, compactRows }
  ),
}));

export function useCurrentTrack(): Track | null {
  return usePlayerStore((state) => state.queue[state.currentIndex] ?? null);
}
export function useIsFavorite(trackId: string | undefined): boolean {
  return usePlayerStore((state) => Boolean(trackId && state.favorites.some((item) => item.id === trackId)));
}
