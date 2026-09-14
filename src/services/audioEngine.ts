import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { parseEmbeddedPlaybackUrl } from '@/services/playbackUrl';
import type { Track } from '@/types/music';

export interface EmbeddedPlayback {
  videoId: string;
  playing: boolean;
}

export interface EmbeddedPlayerController {
  seekTo: (seconds: number) => void;
}

let player: AudioPlayer | null = null;
let subscription: { remove: () => void } | null = null;
let onStatus: ((status: AudioStatus) => void) | null = null;
let audioMode: Promise<void> | null = null;
let embeddedPlayback: EmbeddedPlayback | null = null;
let embeddedController: EmbeddedPlayerController | null = null;
let embeddedPosition = 0;
let embeddedDuration = 0;
const embeddedListeners = new Set<() => void>();

function notifyEmbedded(): void {
  embeddedListeners.forEach((listener) => listener());
}

function setEmbeddedPlaying(playing: boolean): void {
  if (!embeddedPlayback || embeddedPlayback.playing === playing) return;
  embeddedPlayback = { ...embeddedPlayback, playing };
  notifyEmbedded();
}

function emitEmbeddedStatus(overrides: Partial<AudioStatus> = {}): void {
  onStatus?.({
    currentTime: embeddedPosition,
    duration: embeddedDuration,
    playing: embeddedPlayback?.playing ?? false,
    isLoaded: true,
    isBuffering: false,
    didJustFinish: false,
    error: null,
    ...overrides,
  } as AudioStatus);
}

export function subscribeEmbeddedPlayback(listener: () => void): () => void {
  embeddedListeners.add(listener);
  return () => embeddedListeners.delete(listener);
}

export function getEmbeddedPlayback(): EmbeddedPlayback | null {
  return embeddedPlayback;
}

export function setEmbeddedPlayerController(controller: EmbeddedPlayerController | null): void {
  embeddedController = controller;
}

export function reportEmbeddedReady(duration: number): void {
  if (!embeddedPlayback) return;
  embeddedDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  emitEmbeddedStatus();
}

export function reportEmbeddedProgress(position: number, duration: number): void {
  if (!embeddedPlayback) return;
  embeddedPosition = Number.isFinite(position) ? Math.max(0, position) : embeddedPosition;
  embeddedDuration = Number.isFinite(duration) ? Math.max(0, duration) : embeddedDuration;
  emitEmbeddedStatus();
}

export function reportEmbeddedState(state: 'playing' | 'paused' | 'buffering' | 'ended'): void {
  if (!embeddedPlayback) return;
  if (state === 'playing') {
    setEmbeddedPlaying(true);
    emitEmbeddedStatus({ playing: true });
  } else if (state === 'paused') {
    setEmbeddedPlaying(false);
    emitEmbeddedStatus({ playing: false });
  } else if (state === 'buffering') {
    emitEmbeddedStatus({ isBuffering: true });
  } else {
    setEmbeddedPlaying(false);
    embeddedPosition = embeddedDuration;
    emitEmbeddedStatus({ playing: false, didJustFinish: true });
  }
}

export function reportEmbeddedError(message: string): void {
  if (embeddedPlayback) emitEmbeddedStatus({ playing: false, error: message });
}

export function setStatusListener(listener: (status: AudioStatus) => void): void {
  // Create audio only in response to a user action, never during web prerender.
  onStatus = listener;
}

export function reset(): void {
  const previous = player;
  player = null;
  subscription?.remove();
  subscription = null;
  if (previous) {
    previous.pause();
    previous.setActiveForLockScreen(false);
    previous.remove();
  }
  if (embeddedPlayback) {
    embeddedPlayback = null;
    embeddedController = null;
    embeddedPosition = 0;
    embeddedDuration = 0;
    notifyEmbedded();
  }
}

export async function loadAndPlay(streamUrl: string, track: Track, signal: AbortSignal): Promise<void> {
  const videoId = parseEmbeddedPlaybackUrl(streamUrl);
  if (videoId) {
    reset();
    if (signal.aborted) return;
    embeddedPlayback = { videoId, playing: true };
    embeddedPosition = 0;
    embeddedDuration = track.duration ?? 0;
    notifyEmbedded();
    emitEmbeddedStatus({ isLoaded: false, isBuffering: true });
    return;
  }

  audioMode ??= setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
  }).catch((error) => {
    audioMode = null;
    throw error;
  });
  await audioMode;
  if (signal.aborted) return;
  reset();
  const active = createAudioPlayer({ uri: streamUrl }, { updateInterval: 500 });
  player = active;
  subscription = active.addListener('playbackStatusUpdate', (status) => {
    // A delayed finish/error from the previous player cannot affect its replacement.
    if (player === active && !signal.aborted) onStatus?.(status);
  });
  active.setActiveForLockScreen(true, {
    title: track.title, artist: track.artist, albumTitle: track.album, artworkUrl: track.artwork,
  });
  active.play();
}

export function hasPlayer(): boolean { return player !== null || embeddedPlayback !== null; }
export function play(): void {
  if (embeddedPlayback) {
    setEmbeddedPlaying(true);
    emitEmbeddedStatus({ playing: true });
  } else player?.play();
}
export function pause(): void {
  if (embeddedPlayback) {
    setEmbeddedPlaying(false);
    emitEmbeddedStatus({ playing: false });
  } else player?.pause();
}
export async function seekTo(seconds: number): Promise<void> {
  if (embeddedPlayback) {
    embeddedPosition = seconds;
    embeddedController?.seekTo(seconds);
    emitEmbeddedStatus();
  } else await player?.seekTo(seconds);
}
